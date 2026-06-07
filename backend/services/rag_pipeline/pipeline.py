import copy
import logging
import os
import re

logger = logging.getLogger(__name__)

MIN_CLAIM_LENGTH = 15

# Default imports (which can be overridden by dynamic patching)
try:
    from core.attention import calculate_attention_weights
    from core.context_placement import build_prompt
    from core.retrieval.embedding import _encode_texts
    from core.retrieval.keyword import _keyword_overlap_score, _normalized_words, _ordered_terms
    from core.retrieval.metrics import (
        compute_attention_waste,
        compute_retrieval_metrics,
        compute_retrieval_metrics_gold,
        compute_retrieval_usage_gap,
        detect_ignored_relevant,
        compute_faithfulness,
    )
    from core.retrieval.ranks import _assign_ranks, compute_rrf_scores
    from core.retrieval.rerank import rerank_chunks
    from core.tokenization import decode_tokens, get_tokens
    from query_transformers import transform_query
except ModuleNotFoundError:
    from backend.core.attention import calculate_attention_weights
    from backend.core.context_placement import build_prompt
    from backend.core.retrieval.embedding import _encode_texts
    from backend.core.retrieval.keyword import _keyword_overlap_score, _normalized_words, _ordered_terms
    from backend.core.retrieval.metrics import (
        compute_attention_waste,
        compute_retrieval_metrics,
        compute_retrieval_metrics_gold,
        compute_retrieval_usage_gap,
        detect_ignored_relevant,
        compute_faithfulness,
    )
    from backend.core.retrieval.ranks import _assign_ranks, compute_rrf_scores
    from backend.core.retrieval.rerank import rerank_chunks
    from backend.core.tokenization import decode_tokens, get_tokens
    from backend.query_transformers import transform_query

from services import rag_pipeline
from .diagnostics import _compute_root_cause_analysis
from .evaluation import _score_answer_quality, _build_controlled_context


def simulate_rag_pipeline(
    token_ids: list[int],
    chunk_size: int,
    query: str,
    overlap: int,
    tokenizer_name: str,
    top_k: int,
    retrieval_strategy: str,
    context_window: int,
    budget_percent: int | None = 100,
    final_k: int | None = None,
    original_text: str | None = None,
    query_transformer: str | None = "baseline",
    query_variants_max: int = 5,
    relevance_labels: dict[int, int] | None = None,
    context_placement_strategy: str | None = "reverse",
    random_seed: int | None = None,
    gold_chunk_id: int | None = None,
    answer_chunk_position: int | str | None = None,
    gold_answer: str | None = None,
    reranker_enabled: bool = True,
    generation_mode: str = "synthetic",
) -> dict:
    # Resolve helper functions dynamically (supports chunk_simulator patching)
    active_decode_tokens = getattr(rag_pipeline, "decode_tokens", None) or decode_tokens
    active_get_tokens = getattr(rag_pipeline, "get_tokens", None) or get_tokens
    active_encode_texts = getattr(rag_pipeline, "_encode_texts", None) or _encode_texts
    active_keyword_overlap_score = getattr(rag_pipeline, "_keyword_overlap_score", None) or _keyword_overlap_score
    active_normalized_words = getattr(rag_pipeline, "_normalized_words", None) or _normalized_words
    active_ordered_terms = getattr(rag_pipeline, "_ordered_terms", None) or _ordered_terms
    active_transform_query = getattr(rag_pipeline, "transform_query", None) or transform_query
    active_rerank_chunks = getattr(rag_pipeline, "rerank_chunks", None) or rerank_chunks

    faithfulness = {"score": 0.0, "statements": [], "generated_answer": ""}

    if overlap > chunk_size * 0.5:
        overlap = int(chunk_size * 0.2)

    if chunk_size <= overlap:
        raise ValueError("Chunk size must be strictly greater than overlap.")

    normalized_budget_percent = 100 if budget_percent is None else max(1, min(100, int(budget_percent)))
    # Initial limit based on context window; will be refined if budget_percent is active
    budget_token_limit = context_window

    all_chunks = []
    start = 0
    total_tokens = len(token_ids)
    chunk_index = 1

    # 1. Chunking Phase (Creating the "Vector DB")
    while start < total_tokens:
        end = min(start + chunk_size, total_tokens)
        chunk_tokens = token_ids[start:end]
        decoded_text = active_decode_tokens(chunk_tokens, tokenizer_name)

        all_chunks.append(
            {
                "chunk_index": chunk_index,
                "start_token": start,
                "end_token": end,
                "token_count": len(chunk_tokens),
                "raw_tokens": chunk_tokens,
                "decoded_text": decoded_text,
            }
        )

        start += (chunk_size - overlap)
        chunk_index += 1

    total_chunks_created = len(all_chunks)

    # Calculate exact token waste
    total_chunked_tokens = sum(c["token_count"] for c in all_chunks)
    extra_tokens = max(0, total_chunked_tokens - total_tokens)

    # 2. Initial Retrieval Scoring
    retrieval_mode = "hybrid"
    variant_retrievals = []
    total_retrieved_chunks = 0
    unique_retrieved_chunks = 0
    retrieval_diversity = 0.0
    retrieval_overlap = 0.0
    hyde_document = None
    hyde_length_tokens = None
    hyde_generated_terms = None
    if total_chunks_created > 0:
        query = query or original_text or ""
        variants = active_transform_query(query, strategy=query_transformer, max_variants=query_variants_max) if query.strip() else []
        query_texts = [variant.text for variant in variants] or ([query] if query.strip() else [])
        query_terms_list = [active_normalized_words(text) for text in query_texts]
        query_embedding = active_encode_texts(query_texts) if query_texts else None
        chunk_texts = [chunk["decoded_text"] for chunk in all_chunks]
        chunk_terms_list = [active_normalized_words(text) for text in chunk_texts]
        chunk_embeddings = active_encode_texts(chunk_texts) if query_embedding is not None else None

        if query_transformer == "hyde" and variants:
            hyde_document = variants[0].text
            hyde_length_tokens = len(active_get_tokens(hyde_document, tokenizer_name))
            hyde_generated_terms = active_ordered_terms(hyde_document)

        if any(query_terms_list) or query_embedding is not None:
            for i, chunk in enumerate(all_chunks):
                chunk_terms = chunk_terms_list[i]
                keyword_scores = [
                    active_keyword_overlap_score(query_text, chunk["decoded_text"])
                    for query_text in query_texts
                ]
                keyword_score = max(keyword_scores) if keyword_scores else 0.0

                if query_embedding is not None and chunk_embeddings is not None:
                    embedding_scores = [float(chunk_embeddings[i] @ query_vector) for query_vector in query_embedding]
                    embedding_score = max(embedding_scores) if embedding_scores else 0.0
                else:
                    embedding_score = 0.0

                chunk["keyword_score"] = round(keyword_score, 3)
                chunk["embedding_score"] = (
                    round(embedding_score, 3) if query_embedding is not None and chunk_embeddings is not None else None
                )
                if chunk_embeddings is not None and query_embedding is not None:
                    chunk["similarity_score"] = round((0.5 * embedding_score) + (0.5 * keyword_score), 3)
                else:
                    chunk["similarity_score"] = round(keyword_score, 3)

            for variant_index, variant_text in enumerate(query_texts):
                variant_terms = query_terms_list[variant_index] if variant_index < len(query_terms_list) else set()
                variant_scores = []
                for i, chunk in enumerate(all_chunks):
                    chunk_terms = chunk_terms_list[i]
                    keyword_score = active_keyword_overlap_score(variant_text, chunk.get("decoded_text", ""))
                    if query_embedding is not None and chunk_embeddings is not None:
                        embedding_score = float(chunk_embeddings[i] @ query_embedding[variant_index])
                        score = 0.5 * embedding_score + 0.5 * keyword_score
                    else:
                        score = keyword_score
                    variant_scores.append({
                        "chunk_index": chunk.get("chunk_index"),
                        "score": round(score, 4),
                    })

                top_chunks = sorted(variant_scores, key=lambda item: item["score"], reverse=True)[:top_k]
                variant_retrievals.append({
                    "query": variant_text,
                    "top_chunks": top_chunks,
                })

            total_retrieved_chunks = sum(len(entry["top_chunks"]) for entry in variant_retrievals)
            unique_chunk_ids = {
                item["chunk_index"]
                for entry in variant_retrievals
                for item in entry["top_chunks"]
                if item["chunk_index"] is not None
            }
            unique_retrieved_chunks = len(unique_chunk_ids)
            if total_retrieved_chunks:
                retrieval_diversity = round(unique_retrieved_chunks / total_retrieved_chunks, 4)
                retrieval_overlap = round(1.0 - retrieval_diversity, 4)
        elif original_text:
            orig_terms = active_normalized_words(original_text)
            for chunk in all_chunks:
                chunk_terms = chunk_terms_list[chunk.get("chunk_index", 1) - 1]
                chunk["keyword_score"] = active_keyword_overlap_score(original_text, chunk.get("decoded_text", ""))
                chunk["embedding_score"] = None
                chunk["similarity_score"] = chunk["keyword_score"]
        else:
            retrieval_mode = "positional_fallback"
            similarity_denominator = max(1, total_chunks_created - 1)
            for chunk in all_chunks:
                normalized_position = (chunk["chunk_index"] - 1) / similarity_denominator
                chunk["keyword_score"] = None
                chunk["embedding_score"] = None
                chunk["similarity_score"] = round(1.0 - (0.5 * normalized_position), 3)

    # 3. Retrieval Phase
    dense_rank_map: dict[int, int] = {}
    keyword_rank_map: dict[int, int] = {}
    if any(chunk.get("embedding_score") is not None for chunk in all_chunks):
        dense_rank_map = _assign_ranks(all_chunks, "embedding_score")
    if any(chunk.get("keyword_score") is not None for chunk in all_chunks):
        keyword_rank_map = _assign_ranks(all_chunks, "keyword_score")
    for chunk in all_chunks:
        chunk_index = chunk.get("chunk_index")
        chunk["dense_score"] = chunk.get("embedding_score")
        chunk["dense_rank"] = dense_rank_map.get(chunk_index)
        chunk["keyword_rank"] = keyword_rank_map.get(chunk_index)

    if retrieval_strategy == "relevance_sorted":
        all_chunks = sorted(all_chunks, key=lambda x: x["similarity_score"], reverse=True)
    elif retrieval_strategy == "rrf_fused":
        retrieval_mode = "rrf_fused"
        # RRF only drives ranking; keep semantic scores intact for diagnostics.
        rrf_k = 60
        embedding_rank = sorted(
            all_chunks,
            key=lambda x: x.get("embedding_score") or 0.0,
            reverse=True,
        )
        keyword_rank = sorted(
            all_chunks,
            key=lambda x: x.get("keyword_score") or 0.0,
            reverse=True,
        )
        rankings = {
            "embedding": [c["chunk_index"] for c in embedding_rank],
            "keyword": [c["chunk_index"] for c in keyword_rank],
        }
        rrf_scores = compute_rrf_scores(rankings, k=rrf_k)
        for chunk in all_chunks:
            chunk_index = chunk.get("chunk_index")
            dense_rank = dense_rank_map.get(chunk_index)
            keyword_rank = keyword_rank_map.get(chunk_index)
            dense_contribution = (1.0 / (rrf_k + dense_rank)) if dense_rank else None
            keyword_contribution = (1.0 / (rrf_k + keyword_rank)) if keyword_rank else None
            chunk["dense_contribution"] = round(dense_contribution, 6) if dense_contribution is not None else None
            chunk["keyword_contribution"] = round(keyword_contribution, 6) if keyword_contribution is not None else None
            chunk["rrf_score"] = round(rrf_scores.get(chunk_index, 0.0), 6)
        all_chunks = sorted(all_chunks, key=lambda x: x["rrf_score"], reverse=True)

    for rank, chunk in enumerate(all_chunks, start=1):
        chunk["final_rank"] = rank

    retrieval_debug = [copy.deepcopy(chunk) for chunk in all_chunks]

    # Initial retrieval, then optionally rerank
    retrieved_chunks = all_chunks[:top_k]
    rerank_query = query or original_text or ""

    if reranker_enabled:
        reranked_chunks = active_rerank_chunks(rerank_query, retrieved_chunks)
    else:
        # If reranking disabled, use retrieved chunks as-is (treat retrieval score as rerank score)
        reranked_chunks = retrieved_chunks
        for chunk in reranked_chunks:
            chunk["rerank_score"] = chunk.get("similarity_score", 0.0)

    retrieval_metrics = compute_retrieval_metrics(all_chunks, reranked_chunks, top_k)
    retrieval_metrics_gold = None
    if relevance_labels:
        label_map = {int(k): int(v) for k, v in relevance_labels.items()}
        retrieval_metrics_gold = compute_retrieval_metrics_gold(reranked_chunks, label_map, top_k)

    # -------------------------------------------------------------
    # CONTEXT FILTERING (PRE-PROMPT)
    # -------------------------------------------------------------
    # Step 1: Threshold filtering (remove noise before LLM sees it)
    max_score = max((c.get("rerank_score", c.get("similarity_score", 0)) for c in reranked_chunks), default=1.0)

    # 🚨 FIX: "Garbage-in -> Garbage-kept" prevention
    if max_score < 0.3:
        # Fallback Strict Mode for weak-signal regimes
        # If the best chunk is still weak, only keep the absolute top 1-2 chunks to limit token waste
        # and prevent feeding the LLM 4 chunks of garbage.
        filtered_chunks = reranked_chunks[:2]
    else:
        # Standard Adaptive Threshold
        dynamic_threshold = max(0.2, max_score * 0.6)
        filtered_chunks = [c for c in reranked_chunks if c.get("rerank_score", c.get("similarity_score", 0)) > dynamic_threshold]

    if not filtered_chunks and reranked_chunks:
        filtered_chunks = reranked_chunks  # fallback if too aggressive

    # Step 2: Reranker cutoff (formalize top K selection pool)
    # final_k is an experiment control: if the caller asks for 7 chunks and
    # retrieval produced 7 candidates, placement strategies need all 7 to
    # make middle/reverse/relevance ordering observable.
    final_limit = max(1, min(final_k or 4, len(reranked_chunks)))

    if len(filtered_chunks) < final_limit:
        seen_indexes = {chunk.get("chunk_index") for chunk in filtered_chunks}
        for chunk in reranked_chunks:
            chunk_index_value = chunk.get("chunk_index")
            if chunk_index_value in seen_indexes:
                continue
            filtered_chunks.append(chunk)
            seen_indexes.add(chunk_index_value)
            if len(filtered_chunks) >= final_limit:
                break

    pool_for_diversity = filtered_chunks[: max(final_limit * 2, final_limit)]

    # Step 3: Diversity filtering (remove near-duplicates to maximize context utilization)
    diverse_chunks = []
    for c in pool_for_diversity:
        is_duplicate = False
        for d in diverse_chunks:
            # Reusing existing lexical overlap function to check chunk similarity
            overlap = active_keyword_overlap_score(c["decoded_text"], d["decoded_text"])
            if overlap > 0.8:  # 80% similar = duplicate
                is_duplicate = True
                break
        if not is_duplicate:
            diverse_chunks.append(c)
        if len(diverse_chunks) >= final_limit:
            break

    if len(diverse_chunks) < final_limit:
        seen_indexes = {chunk.get("chunk_index") for chunk in diverse_chunks}
        for chunk in filtered_chunks + reranked_chunks:
            chunk_index_value = chunk.get("chunk_index")
            if chunk_index_value in seen_indexes:
                continue
            diverse_chunks.append(chunk)
            seen_indexes.add(chunk_index_value)
            if len(diverse_chunks) >= final_limit:
                break

    if not diverse_chunks:
        diverse_chunks = reranked_chunks[:final_limit]

    rerank_scores = [round(chunk.get("rerank_score", 0.0), 4) for chunk in diverse_chunks]
    reranked = True

    # Calculate global relevance baseline for coverage calculations before budgeting prunes the results
    all_retrieved_scores = [c.get("rerank_score", 0.0) for c in diverse_chunks]
    global_retrieval_avg = sum(all_retrieved_scores) / len(all_retrieved_scores) if all_retrieved_scores else 0.0
    global_relevance_thresh = max(0.3, global_retrieval_avg * 0.8)
    total_relevant_retrieved = sum(1 for s in all_retrieved_scores if s >= global_relevance_thresh)

    pre_budget_token_count = sum(int(chunk.get("token_count", 0)) for chunk in diverse_chunks)
    if budget_percent is not None:
        # BUDGET FIX: Base limit on the retrieved pool tokens rather than the model window
        budget_token_limit = max(1, int(pre_budget_token_count * normalized_budget_percent / 100))

    budgeted_chunks = diverse_chunks
    budgeted_token_count = pre_budget_token_count
    if budget_percent is not None:
        budgeted_chunks = []
        budgeted_token_count = 0
        for chunk in diverse_chunks:
            chunk_tokens = int(chunk.get("token_count", 0))
            if budgeted_chunks and budgeted_token_count + chunk_tokens > budget_token_limit:
                break
            if not budgeted_chunks and chunk_tokens > budget_token_limit:
                break
            budgeted_chunks.append(chunk)
            budgeted_token_count += chunk_tokens

        diverse_chunks = budgeted_chunks
        rerank_scores = [round(chunk.get("rerank_score", 0.0), 4) for chunk in diverse_chunks]

    controlled_context = _build_controlled_context(
        all_chunks=all_chunks,
        gold_chunk_id=gold_chunk_id,
        answer_chunk_position=answer_chunk_position,
        final_k=final_k,
        top_k=top_k
    )
    if controlled_context is not None:
        final_limit = len(controlled_context)
        final_candidates = controlled_context
        inject_order = controlled_context
    else:
        # reorder prompt placement to measure placement impact independently of retrieval
        final_candidates = diverse_chunks
        inject_order = build_prompt(final_candidates, context_placement_strategy or "reverse", random_seed)

    if budget_percent is not None:
        budgeted_final_candidates = []
        budgeted_final_tokens = 0
        for chunk in final_candidates:
            chunk_tokens = int(chunk.get("token_count", 0))
            if budgeted_final_candidates and budgeted_final_tokens + chunk_tokens > budget_token_limit:
                break
            if not budgeted_final_candidates and chunk_tokens > budget_token_limit:
                break
            budgeted_final_candidates.append(chunk)
            budgeted_final_tokens += chunk_tokens

        final_candidates = budgeted_final_candidates
        inject_order = budgeted_final_candidates
        final_limit = len(budgeted_final_candidates)

    def _build_valid_from_candidates(candidate_chunks: list[dict]) -> list[dict]:
        # operate on copies to avoid mutating shared chunk dicts
        candidates = [copy.deepcopy(c) for c in candidate_chunks[:final_limit]]

        # Context Window Protection (Drop chunks if final set exceeds model limits)
        local_valid = []
        current_prompt_tokens = 0
        for chunk in candidates:
            if current_prompt_tokens + chunk.get("token_count", 0) <= context_window:
                local_valid.append(chunk)
                current_prompt_tokens += chunk.get("token_count", 0)
            else:
                break

        # assign positional weights and compute final importance
        visible_positions = range(len(local_valid))
        if local_valid:
            local_pos_weights = calculate_attention_weights(
                visible_tokens=visible_positions,
                decay_power=2.0,
                recency_strength=0.5,
            )
        else:
            local_pos_weights = []

        local_max_score = max((c.get("rerank_score", c.get("similarity_score", 0.0)) for c in local_valid), default=1.0)

        for i, chunk in enumerate(local_valid):
            chunk["positional_weight"] = local_pos_weights[i]

            # Use rerank_score if it exists, otherwise fallback to similarity
            primary_score = chunk.get("rerank_score", chunk.get("similarity_score", 0.0))
            chunk["relevance_score"] = primary_score
            chunk["attention_weight"] = local_pos_weights[i]
            chunk["used_by_model"] = local_pos_weights[i] > 0.3
            chunk["lost_reason"] = None
            chunk["risk_level"] = "safe (high retention)"

            if chunk["used_by_model"]:
                if primary_score < 0.4 or primary_score < 0.5 * local_max_score:
                    chunk["lost_reason"] = "noise_attended"
                    chunk["risk_level"] = "high_risk (irrelevant_but_attended)"
                elif primary_score < 0.4 and local_pos_weights[i] > 0.8:
                    chunk["lost_reason"] = None
                    chunk["risk_level"] = "high_risk (position_bias)"
                elif 0.3 < primary_score < 0.6:
                    chunk["lost_reason"] = "context_dilution"
                    chunk["risk_level"] = "medium_risk (context_dilution)"
                else:
                    chunk["lost_reason"] = None
            else:
                if primary_score > 0.5 and local_pos_weights[i] < 0.3:
                    chunk["lost_reason"] = "lost_in_middle"
                    chunk["risk_level"] = "high_risk (lost_in_middle)"
                elif primary_score < 0.4:
                    chunk["lost_reason"] = "low_relevance"
                    chunk["risk_level"] = "medium_risk (low_relevance)"

            chunk["final_importance"] = (
                round(
                    (0.7 * chunk.get("rerank_score", 0.0) + 0.3 * chunk.get("similarity_score", 0.0))
                    * chunk["positional_weight"],
                    3,
                )
                if "rerank_score" in chunk
                else round(primary_score * chunk["positional_weight"], 3)
            )
            snippet_start = active_decode_tokens(chunk.get("raw_tokens", [])[:5], tokenizer_name).strip()
            snippet_end = active_decode_tokens(chunk.get("raw_tokens", [])[-5:], tokenizer_name).strip()
            chunk["boundary_snippet"] = f"{snippet_start} ... {snippet_end}"

        return local_valid

    # build before/after valid chunk sets to measure reranker impact
    before_valid = _build_valid_from_candidates(retrieved_chunks[:final_limit])
    after_valid = _build_valid_from_candidates(inject_order)

    # compute reranker impact metrics
    before_metrics = compute_retrieval_usage_gap(before_valid, total_relevant_retrieved)
    after_metrics = compute_retrieval_usage_gap(after_valid, total_relevant_retrieved)
    
    ans_diff = after_metrics["answer_quality"] - before_metrics["answer_quality"]
    cov_diff = after_metrics["coverage"] - before_metrics["coverage"]
    
    if ans_diff > 0.02 or (ans_diff >= -0.02 and cov_diff > 0):
        net_effect = "positive"
    elif ans_diff < -0.02 or cov_diff < -0.1:
        net_effect = "negative"
    else:
        net_effect = "mixed"

    reranker_impact = {
        "before": before_metrics,
        "after": after_metrics,
        "net_effect": net_effect,
    }

    # use the after_valid set as the canonical valid_chunks for downstream analysis
    valid_chunks = after_valid

    # 4. Prompt Injection Phase (Positional Attention)
    if not valid_chunks:
        # compute empty metrics
        retrieval_analysis = compute_retrieval_usage_gap([], total_relevant_retrieved)
        answer_evaluation = _score_answer_quality([], gold_chunk_id, answer_chunk_position, gold_answer)
        if answer_evaluation:
            retrieval_analysis["answer_quality"] = answer_evaluation["answer_quality"]
        ignored_relevant_chunks = detect_ignored_relevant([])
        attention_waste = compute_attention_waste([])
        budget_metrics = None
        if budget_percent is not None:
            sel_tokens = 0.0
            ans_quality = retrieval_analysis.get("answer_quality", 0.0)
            budget_metrics = {
                "budget_percent": float(normalized_budget_percent),
                "budget_token_limit": float(budget_token_limit),
                "selected_chunk_count": 0.0,
                "selected_token_count": 0.0,
                "retrieval_quality": retrieval_analysis.get("retrieval_quality", 0.0),
                "answer_quality": ans_quality,
                "coverage": retrieval_analysis.get("coverage", 0.0),
                "quality_per_token": 0.0,
            }

        root_cause = _compute_root_cause_analysis(
            all_chunks=all_chunks,
            valid_chunks=[],
            retrieved_chunks=all_chunks[:top_k] if total_chunks_created > 0 else [],
            ignored_relevant_chunks=ignored_relevant_chunks,
            retrieval_analysis=retrieval_analysis,
            faithfulness=faithfulness,
        )

        # Build dummy Groundedness Result
        groundedness = {
            "groundedness_score": 0.0,
            "claims": []
        }

        if budget_percent is None:
            return {
                "total_original_tokens": total_tokens,
                "total_chunks_created": total_chunks_created,
                "chunks_in_prompt": 0,
                "extra_tokens_due_to_overlap": extra_tokens,
                "chunks": [],
                "retrieval_debug": retrieval_debug,
                "error": "context_window_overflow",
                "attention_curve": [],
                "retrieval_mode": retrieval_mode,
                "query_strategy": query_transformer,
                "query_variants": [variant.text for variant in variants] if total_chunks_created > 0 else [],
                "hyde_document": hyde_document,
                "hyde_length_tokens": hyde_length_tokens,
                "hyde_generated_terms": hyde_generated_terms,
                "variant_retrievals": variant_retrievals,
                "total_retrieved_chunks": total_retrieved_chunks,
                "unique_retrieved_chunks": unique_retrieved_chunks,
                "retrieval_diversity": retrieval_diversity,
                "retrieval_overlap": retrieval_overlap,
                "retrieval_metrics": retrieval_metrics,
                "retrieval_metrics_gold": retrieval_metrics_gold,
                "reranked": reranked,
                "rerank_scores": rerank_scores,
                "retrieval_analysis": retrieval_analysis,
                "answer_evaluation": answer_evaluation,
                "ignored_relevant_chunks": ignored_relevant_chunks,
                "attention_waste": attention_waste,
                "reranker_impact": reranker_impact,
                "context_placement_strategy": context_placement_strategy or "reverse",
                "faithfulness": faithfulness,
                "groundedness": groundedness,
                "root_cause": root_cause,
            }

        return {
            "total_original_tokens": total_tokens,
            "total_chunks_created": total_chunks_created,
            "chunks_in_prompt": 0,
            "extra_tokens_due_to_overlap": extra_tokens,
            "chunks": [],
            "retrieval_debug": retrieval_debug,
            "budget_percent": normalized_budget_percent,
            "budget_token_limit": budget_token_limit,
            "budget_metrics": budget_metrics,
            "attention_curve": [],
            "retrieval_mode": retrieval_mode,
            "query_strategy": query_transformer,
            "query_variants": [variant.text for variant in variants] if total_chunks_created > 0 else [],
            "hyde_document": hyde_document,
            "hyde_length_tokens": hyde_length_tokens,
            "hyde_generated_terms": hyde_generated_terms,
            "variant_retrievals": variant_retrievals,
            "total_retrieved_chunks": total_retrieved_chunks,
            "unique_retrieved_chunks": unique_retrieved_chunks,
            "retrieval_diversity": retrieval_diversity,
            "retrieval_overlap": retrieval_overlap,
            "retrieval_metrics": retrieval_metrics,
            "retrieval_metrics_gold": retrieval_metrics_gold,
            "reranked": reranked,
            "rerank_scores": rerank_scores,
            "retrieval_analysis": retrieval_analysis,
            "answer_evaluation": answer_evaluation,
            "ignored_relevant_chunks": ignored_relevant_chunks,
            "attention_waste": attention_waste,
            "reranker_impact": reranker_impact,
            "context_placement_strategy": context_placement_strategy or "reverse",
            "faithfulness": faithfulness,
            "groundedness": groundedness,
            "root_cause": root_cause,
        }

    # 5.5 Faithfulness Evaluation Pipeline
    def _split_sentences(text: str) -> list[str]:
        raw_sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in raw_sentences if s.strip()]

    # If gold_answer is not provided, generate a simulated response
    active_gold_answer = gold_answer
    resolved_generation_mode = "synthetic"

    if active_gold_answer and active_gold_answer.strip():
        resolved_generation_mode = "llm"  # Explicitly provided answers are treated as real/LLM answers
    else:
        if generation_mode == "llm":
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                logger.warning("GEMINI_API_KEY is not set. Falling back to synthetic generation mode.")
            else:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=api_key)
                    
                    context_str = ""
                    for c in valid_chunks:
                        context_str += f"Context Chunk {c.get('chunk_index')}:\n{c.get('decoded_text')}\n\n"
                    
                    prompt = (
                        "You are a technical question-answering assistant.\n"
                        "Instructions:\n"
                        "- Answer the question using ONLY facts stated directly in the context chunks below.\n"
                        "- Do not make up facts or extrapolate.\n"
                        "- If the question cannot be answered from the context chunks, say: 'I cannot answer this based on the provided context.'\n\n"
                        f"Context Chunks:\n{context_str}"
                        f"Question: {query or 'Summarize the context chunks.'}\n\n"
                        "Answer:"
                    )
                    
                    model = genai.GenerativeModel("gemini-2.5-flash")
                    response = model.generate_content(
                        prompt, 
                        generation_config=genai.types.GenerationConfig(
                            max_output_tokens=300,
                            temperature=0.2
                        )
                    )
                    
                    text = getattr(response, "text", None)
                    if not text and hasattr(response, "candidates") and response.candidates:
                        c0 = response.candidates[0]
                        if hasattr(c0, "content") and c0.content and hasattr(c0.content, "parts") and c0.content.parts:
                            text = "".join(getattr(part, "text", "") for part in c0.content.parts)
                    
                    if text and text.strip():
                        active_gold_answer = text.strip()
                        resolved_generation_mode = "llm"
                        logger.info("Successfully generated real LLM answer.")
                    else:
                        logger.warning("Gemini API returned empty text. Falling back to synthetic mode.")
                except Exception as e:
                    logger.exception("Error generating LLM answer: %s. Falling back to synthetic mode.", e)

        if not active_gold_answer or not active_gold_answer.strip():
            # Let's generate a partially-faithful simulated answer to demonstrate the evaluation flow
            faithful_sentence = ""
            for chunk in valid_chunks:
                chunk_text = chunk.get("decoded_text", "").strip()
                if chunk_text:
                    sentences = _split_sentences(chunk_text)
                    if sentences:
                        for s in sentences:
                            if len(s) > MIN_CLAIM_LENGTH:
                                faithful_sentence = s
                                break
                        if faithful_sentence:
                            break

            # Now find a sentence from the non-retrieved chunks (or other chunks not in valid_chunks)
            unfaithful_sentence = ""
            valid_chunk_indices = {c.get("chunk_index") for c in valid_chunks}
            non_retrieved_chunks = [c for c in all_chunks if c.get("chunk_index") not in valid_chunk_indices]
            for chunk in non_retrieved_chunks:
                chunk_text = chunk.get("decoded_text", "").strip()
                if chunk_text:
                    sentences = _split_sentences(chunk_text)
                    if sentences:
                        for s in sentences:
                            if len(s) > MIN_CLAIM_LENGTH:
                                unfaithful_sentence = s
                                break
                        if unfaithful_sentence:
                            break

            if not unfaithful_sentence:
                unfaithful_sentence = "Additionally, the system performs external web scraping to retrieve unrelated base statistics."

            if faithful_sentence:
                active_gold_answer = f"{faithful_sentence} {unfaithful_sentence}"
            else:
                active_gold_answer = unfaithful_sentence

    # Compute Faithfulness
    faithfulness = compute_faithfulness(
        answer=active_gold_answer,
        context_chunks=valid_chunks,
        encode_fn=active_encode_texts,
        keyword_score_fn=active_keyword_overlap_score,
    )
    faithfulness["generated_answer"] = active_gold_answer
    faithfulness["generation_mode"] = resolved_generation_mode

    # Build Groundedness Result
    groundedness_claims = []
    for c in faithfulness.get("claims", []):
        groundedness_claims.append({
            "claim": c.get("claim"),
            "grounded": c.get("supported", False),
            "chunk_index": c.get("supporting_chunk_index") if c.get("supported", False) else None,
            "evidence": c.get("supporting_snippet") if c.get("supported", False) else None,
            "evidence_similarity": c.get("max_similarity") if c.get("supported", False) else None
        })
    groundedness = {
        "groundedness_score": faithfulness.get("score", 1.0),
        "claims": groundedness_claims
    }

    visible_positions = range(len(valid_chunks))
    positional_weights = calculate_attention_weights(
        visible_tokens=visible_positions,
        decay_power=2.0,
        recency_strength=0.5,
    )

    # 5. Adaptive Thresholds & Final Importance
    final_importances = []
    global_max_score = max((c.get("rerank_score", c.get("similarity_score", 0.0)) for c in valid_chunks), default=1.0)
    for i, chunk in enumerate(valid_chunks):
        chunk["positional_weight"] = positional_weights[i]

        primary_score = chunk.get("rerank_score", chunk.get("similarity_score", 0.0))
        chunk["relevance_score"] = primary_score
        chunk["attention_weight"] = positional_weights[i]
        chunk["used_by_model"] = positional_weights[i] > 0.3
        chunk["lost_reason"] = None
        chunk["risk_level"] = "safe (high retention)"

        if chunk["used_by_model"]:
            if primary_score < 0.4 or primary_score < 0.5 * global_max_score:
                chunk["lost_reason"] = "noise_attended"
                chunk["risk_level"] = "high_risk (irrelevant_but_attended)"
            elif primary_score < 0.4 and positional_weights[i] > 0.8:
                chunk["lost_reason"] = None
                chunk["risk_level"] = "high_risk (position_bias)"
            elif 0.3 < primary_score < 0.6:
                chunk["lost_reason"] = "context_dilution"
                chunk["risk_level"] = "medium_risk (context_dilution)"
            else:
                chunk["lost_reason"] = None
        else:
            if primary_score > 0.5 and positional_weights[i] < 0.3:
                chunk["lost_reason"] = "lost_in_middle"
                chunk["risk_level"] = "high_risk (lost_in_middle)"
            elif primary_score < 0.4:
                chunk["lost_reason"] = "low_relevance"
                chunk["risk_level"] = "medium_risk (low_relevance)"

        chunk["final_importance"] = (
            round(
                (0.7 * chunk.get("rerank_score", 0.0) + 0.3 * chunk.get("similarity_score", 0.0))
                * chunk["positional_weight"],
                3,
            )
            if "rerank_score" in chunk
            else round(primary_score * chunk["positional_weight"], 3)
        )
        final_importances.append(chunk["final_importance"])

        snippet_start = active_decode_tokens(chunk.get("raw_tokens", [])[:5], tokenizer_name).strip()
        snippet_end = active_decode_tokens(chunk.get("raw_tokens", [])[-5:], tokenizer_name).strip()
        chunk["boundary_snippet"] = f"{snippet_start} ... {snippet_end}"

    # Adaptive Risk Assessment
    if final_importances:
        min_imp = min(final_importances)
        max_imp = max(final_importances)
        range_imp = max_imp - min_imp

        if len(valid_chunks) == 1 or range_imp == 0:
            for chunk in valid_chunks:
                if chunk.get("lost_reason") == "noise_attended":
                    chunk["risk_level"] = "high_risk (position_bias)"
                elif chunk.get("lost_reason") == "position_bias":
                    chunk["risk_level"] = "high_risk (position_bias)"
                elif chunk.get("lost_reason") == "lost_in_middle":
                    chunk["risk_level"] = "high_risk (lost_in_middle)"
                elif chunk.get("lost_reason") == "low_relevance":
                    chunk["risk_level"] = "medium_risk (low_relevance)"
                else:
                    chunk["risk_level"] = "safe (high retention)"

            retrieval_analysis = compute_retrieval_usage_gap(valid_chunks, total_relevant_retrieved)
            answer_evaluation = _score_answer_quality(valid_chunks, gold_chunk_id, answer_chunk_position, gold_answer)
            if answer_evaluation:
                retrieval_analysis["answer_quality"] = answer_evaluation["answer_quality"]
            ignored_relevant_chunks = detect_ignored_relevant(valid_chunks)
            attention_waste = compute_attention_waste(valid_chunks)

            budget_metrics = None
            if budget_percent is not None:
                sel_tokens = float(sum(chunk.get("token_count", 0) for chunk in valid_chunks))
                ans_quality = retrieval_analysis.get("answer_quality", 0.0)
                budget_metrics = {
                    "budget_percent": float(normalized_budget_percent),
                    "budget_token_limit": float(budget_token_limit),
                    "selected_chunk_count": float(len(valid_chunks)),
                    "selected_token_count": sel_tokens,
                    "retrieval_quality": retrieval_analysis.get("retrieval_quality", 0.0),
                    "answer_quality": ans_quality,
                    "coverage": retrieval_analysis.get("coverage", 0.0),
                    "quality_per_token": round(ans_quality / sel_tokens, 6) if sel_tokens > 0 else 0.0,
                }

            root_cause = _compute_root_cause_analysis(
                all_chunks=all_chunks,
                valid_chunks=valid_chunks,
                retrieved_chunks=all_chunks[:top_k] if total_chunks_created > 0 else [],
                ignored_relevant_chunks=ignored_relevant_chunks,
                retrieval_analysis=retrieval_analysis,
                faithfulness=faithfulness,
            )
            return {
                "total_original_tokens": total_tokens,
                "total_chunks_created": total_chunks_created,
                "chunks_in_prompt": len(valid_chunks),
                "extra_tokens_due_to_overlap": extra_tokens,
                "chunks": valid_chunks,
                "retrieval_debug": retrieval_debug,
                "budget_percent": normalized_budget_percent,
                "budget_token_limit": budget_token_limit,
                "budget_metrics": budget_metrics,
                "attention_curve": [round(w, 3) for w in positional_weights],
                "retrieval_mode": retrieval_mode,
                "query_strategy": query_transformer,
                "query_variants": [variant.text for variant in variants] if total_chunks_created > 0 else [],
                "hyde_document": hyde_document,
                "hyde_length_tokens": hyde_length_tokens,
                "hyde_generated_terms": hyde_generated_terms,
                "variant_retrievals": variant_retrievals,
                "total_retrieved_chunks": total_retrieved_chunks,
                "unique_retrieved_chunks": unique_retrieved_chunks,
                "retrieval_diversity": retrieval_diversity,
                "retrieval_overlap": retrieval_overlap,
                "retrieval_metrics": retrieval_metrics,
                "retrieval_metrics_gold": retrieval_metrics_gold,
                "reranked": reranked,
                "rerank_scores": rerank_scores,
                "retrieval_analysis": retrieval_analysis,
                "answer_evaluation": answer_evaluation,
                "ignored_relevant_chunks": ignored_relevant_chunks,
                "attention_waste": attention_waste,
                "reranker_impact": reranker_impact,
                "context_placement_strategy": context_placement_strategy or "reverse",
                "faithfulness": faithfulness,
                "groundedness": groundedness,
                "root_cause": root_cause,
            }

        thresh_critical = min_imp + (0.3 * range_imp)
        thresh_medium = min_imp + (0.6 * range_imp)

        for chunk in valid_chunks:
            if chunk.get("lost_reason") in ("noise_attended", "position_bias", "lost_in_middle"):
                continue

            if chunk["final_importance"] <= thresh_critical:
                chunk["risk_level"] = "critical (low position + low relevance)"
            elif chunk["final_importance"] <= thresh_medium:
                chunk["risk_level"] = "medium risk"
            else:
                chunk["risk_level"] = "safe (high retention)"

    retrieval_analysis = compute_retrieval_usage_gap(valid_chunks, total_relevant_retrieved)
    answer_evaluation = _score_answer_quality(valid_chunks, gold_chunk_id, answer_chunk_position, gold_answer)
    if answer_evaluation:
        retrieval_analysis["answer_quality"] = answer_evaluation["answer_quality"]
    ignored_relevant_chunks = detect_ignored_relevant(valid_chunks)
    attention_waste = compute_attention_waste(valid_chunks)
    budget_metrics = None
    if budget_percent is not None:
        sel_tokens = float(sum(chunk.get("token_count", 0) for chunk in valid_chunks))
        ans_quality = retrieval_analysis.get("answer_quality", 0.0)
        budget_metrics = {
            "budget_percent": float(normalized_budget_percent),
            "budget_token_limit": float(budget_token_limit),
            "selected_chunk_count": float(len(valid_chunks)),
            "selected_token_count": sel_tokens,
            "retrieval_quality": retrieval_analysis.get("retrieval_quality", 0.0),
            "answer_quality": ans_quality,
            "coverage": retrieval_analysis.get("coverage", 0.0),
            "quality_per_token": round(ans_quality / sel_tokens, 6) if sel_tokens > 0 else 0.0,
        }

    root_cause = _compute_root_cause_analysis(
        all_chunks=all_chunks,
        valid_chunks=valid_chunks,
        retrieved_chunks=all_chunks[:top_k] if total_chunks_created > 0 else [],
        ignored_relevant_chunks=ignored_relevant_chunks,
        retrieval_analysis=retrieval_analysis,
        faithfulness=faithfulness,
    )

    return {
        "total_original_tokens": total_tokens,
        "total_chunks_created": total_chunks_created,
        "chunks_in_prompt": len(valid_chunks),
        "extra_tokens_due_to_overlap": extra_tokens,
        "chunks": valid_chunks,
        "retrieval_debug": retrieval_debug,
        "budget_percent": normalized_budget_percent,
        "budget_token_limit": budget_token_limit,
        "budget_metrics": budget_metrics,
        "attention_curve": [round(w, 3) for w in positional_weights],
        "retrieval_mode": retrieval_mode,
        "query_strategy": query_transformer,
        "query_variants": [variant.text for variant in variants] if total_chunks_created > 0 else [],
        "hyde_document": hyde_document,
        "hyde_length_tokens": hyde_length_tokens,
        "hyde_generated_terms": hyde_generated_terms,
        "variant_retrievals": variant_retrievals,
        "total_retrieved_chunks": total_retrieved_chunks,
        "unique_retrieved_chunks": unique_retrieved_chunks,
        "retrieval_diversity": retrieval_diversity,
        "retrieval_overlap": retrieval_overlap,
        "retrieval_metrics": retrieval_metrics,
        "retrieval_metrics_gold": retrieval_metrics_gold,
        "reranked": reranked,
        "rerank_scores": rerank_scores,
        "retrieval_analysis": retrieval_analysis,
        "answer_evaluation": answer_evaluation,
        "ignored_relevant_chunks": ignored_relevant_chunks,
        "attention_waste": attention_waste,
        "reranker_impact": reranker_impact,
        "context_placement_strategy": context_placement_strategy or "reverse",
        "faithfulness": faithfulness,
        "groundedness": groundedness,
        "root_cause": root_cause,
    }
