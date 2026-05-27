from functools import lru_cache
import copy
import re
from tokenizer_engine import decode_tokens
from context_simulator import calculate_attention_weights
from query_transformers import transform_query

WORD_PATTERN = re.compile(r"[A-Za-z0-9]+")
_EMBEDDING_MODEL = None
_CROSS_ENCODER_RERANKER = None


@lru_cache(maxsize=1)
def _load_default_sentence_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def set_sentence_embedding_model(model) -> None:
    global _EMBEDDING_MODEL
    _EMBEDDING_MODEL = model


def get_sentence_embedding_model():
    if _EMBEDDING_MODEL is not None:
        return _EMBEDDING_MODEL

    return _load_default_sentence_embedding_model()


@lru_cache(maxsize=1)
def _load_default_cross_encoder_reranker():
    try:
        from sentence_transformers import CrossEncoder

        return CrossEncoder(
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
            model_kwargs={"local_files_only": True},
        )
    except Exception:
        return None


def set_cross_encoder_reranker(model) -> None:
    global _CROSS_ENCODER_RERANKER
    _CROSS_ENCODER_RERANKER = model


def get_cross_encoder_reranker():
    if _CROSS_ENCODER_RERANKER is not None:
        return _CROSS_ENCODER_RERANKER

    return _load_default_cross_encoder_reranker()


def _normalized_words(text: str) -> set[str]:
    return {match.group(0).lower() for match in WORD_PATTERN.finditer(text)}


def _encode_texts(texts: list[str]):
    model = get_sentence_embedding_model()
    if model is None:
        return None

    try:
        return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    except Exception:
        return None


def _keyword_overlap_score(query: str, text: str) -> float:
    query_terms = _normalized_words(query)
    if not query_terms:
        return 0.0

    text_terms = _normalized_words(text)
    return round(len(query_terms & text_terms) / max(1, len(query_terms)), 3)


def compute_retrieval_usage_gap(chunks: list[dict]) -> dict:
    if not chunks:
        return {"retrieval_quality": 0.0, "usage_quality": 0.0, "gap": 0.0}

    # Now using rerank_score as the authoritative relevance signal
    retrieval_scores = [c.get("rerank_score", c.get("similarity_score", 0.0)) for c in chunks]
    usage_scores = [c.get("rerank_score", c.get("similarity_score", 0.0)) * c.get("attention_weight", 0.0) for c in chunks]

    retrieval_quality = sum(retrieval_scores) / len(retrieval_scores)
    usage_quality = sum(usage_scores) / len(usage_scores)
    gap = retrieval_quality - usage_quality

    return {
        "retrieval_quality": round(retrieval_quality, 3),
        "usage_quality": round(usage_quality, 3),
        "gap": round(gap, 3),
    }


def detect_ignored_relevant(chunks: list[dict], relevance_thresh: float = 0.5, attention_thresh: float = 0.3) -> list:
    ignored = []
    for c in chunks:
        # Use rerank_score if it exists, fallback to similarity_score
        score = c.get("rerank_score", c.get("similarity_score", 0.0))
        if score > relevance_thresh and c.get("attention_weight", 0.0) < attention_thresh:
            ignored.append(c.get("chunk_index"))
    return ignored


def compute_attention_waste(chunks: list[dict], threshold: float = 0.2) -> float:
    if not chunks:
        return 0.0
    low_attention = [c for c in chunks if c.get("attention_weight", 0.0) < threshold]
    waste_ratio = len(low_attention) / len(chunks)
    return round(waste_ratio, 3)


def rerank_chunks(query: str, chunks: list[dict]) -> list[dict]:
    reranker = get_cross_encoder_reranker()

    if reranker is not None and chunks:
        pairs = [(query, chunk.get("decoded_text", "")) for chunk in chunks]
        try:
            rerank_scores = reranker.predict(pairs)
            for chunk, score in zip(chunks, rerank_scores):
                chunk["cross_encoder_score"] = round(float(score), 4)
                chunk["rerank_score"] = min(1.0, round(float(score), 4))

            return sorted(
                chunks,
                key=lambda item: (item.get("rerank_score", 0.0), item.get("similarity_score", 0.0), item.get("token_count", 0)),
                reverse=True,
            )
        except Exception:
            # fall back to hybrid keyword scoring if the cross-encoder is unavailable at runtime
            pass

    query_terms = _normalized_words(query)

    for chunk in chunks:
        text_terms = _normalized_words(chunk.get("decoded_text", ""))
        keyword_score = len(query_terms & text_terms) / max(1, len(query_terms)) if query_terms else 0.0
        chunk["cross_encoder_score"] = None
        chunk["rerank_score"] = min(1.0, round(chunk.get("similarity_score", 0.0) + (0.05 * len(query_terms & text_terms)), 4))
        chunk["keyword_score"] = round(keyword_score, 3)

    return sorted(
        chunks,
        key=lambda item: (item.get("rerank_score", 0.0), item.get("similarity_score", 0.0), item.get("token_count", 0)),
        reverse=True,
    )


def simulate_rag_pipeline(
    token_ids: list[int],
    chunk_size: int,
    query: str,
    overlap: int,
    tokenizer_name: str,
    top_k: int,
    retrieval_strategy: str,
    context_window: int,
    final_k: int | None = None,
    original_text: str | None = None,
    query_transformer: str | None = "baseline",
    query_variants_max: int = 5,
) -> dict:
    if overlap > chunk_size * 0.5:
        overlap = int(chunk_size * 0.2)

    if chunk_size <= overlap:
        raise ValueError("Chunk size must be strictly greater than overlap.")

    all_chunks = []
    start = 0
    total_tokens = len(token_ids)
    chunk_index = 1

    # 1. Chunking Phase (Creating the "Vector DB")
    while start < total_tokens:
        end = min(start + chunk_size, total_tokens)
        chunk_tokens = token_ids[start:end]
        decoded_text = decode_tokens(chunk_tokens, tokenizer_name)

        all_chunks.append({
            "chunk_index": chunk_index,
            "start_token": start,
            "end_token": end,
            "token_count": len(chunk_tokens),
            "raw_tokens": chunk_tokens,
            "decoded_text": decoded_text,
        })

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
    if total_chunks_created > 0:
        query = query or original_text or ""
        variants = transform_query(query, strategy=query_transformer, max_variants=query_variants_max)
        query_texts = [variant.text for variant in variants] or [query]
        query_terms_list = [_normalized_words(text) for text in query_texts]
        query_embedding = _encode_texts(query_texts) if query_texts else None
        chunk_texts = [chunk["decoded_text"] for chunk in all_chunks]
        chunk_terms_list = [_normalized_words(text) for text in chunk_texts]
        chunk_embeddings = _encode_texts(chunk_texts) if query_embedding is not None else None

        if any(query_terms_list) or query_embedding is not None:
            for i, chunk in enumerate(all_chunks):
                chunk_terms = chunk_terms_list[i]
                keyword_scores = [
                    len(query_terms & chunk_terms) / max(1, len(query_terms)) if query_terms else 0.0
                    for query_terms in query_terms_list
                ]
                keyword_score = max(keyword_scores) if keyword_scores else 0.0

                if query_embedding is not None and chunk_embeddings is not None:
                    embedding_scores = [float(chunk_embeddings[i] @ query_vector) for query_vector in query_embedding]
                    embedding_score = max(embedding_scores) if embedding_scores else 0.0
                else:
                    embedding_score = 0.0

                chunk["keyword_score"] = round(keyword_score, 3)
                chunk["embedding_score"] = round(embedding_score, 3) if query_embedding is not None and chunk_embeddings is not None else None
                if chunk_embeddings is not None and query_embedding is not None:
                    chunk["similarity_score"] = round((0.5 * embedding_score) + (0.5 * keyword_score), 3)
                else:
                    chunk["similarity_score"] = round(keyword_score, 3)

            for variant_index, variant_text in enumerate(query_texts):
                variant_terms = query_terms_list[variant_index] if variant_index < len(query_terms_list) else set()
                variant_scores = []
                for i, chunk in enumerate(all_chunks):
                    chunk_terms = chunk_terms_list[i]
                    keyword_score = len(variant_terms & chunk_terms) / max(1, len(variant_terms)) if variant_terms else 0.0
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
            orig_terms = _normalized_words(original_text)
            for chunk in all_chunks:
                chunk_terms = chunk_terms_list[chunk.get("chunk_index", 1) - 1]
                chunk["keyword_score"] = round(len(orig_terms & chunk_terms) / max(1, len(orig_terms)), 3)
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
    if retrieval_strategy == "relevance_sorted":
        all_chunks = sorted(all_chunks, key=lambda x: x["similarity_score"], reverse=True)

    # Initial retrieval, then rerank
    retrieved_chunks = all_chunks[:top_k]
    rerank_query = query or original_text or ""
    reranked_chunks = rerank_chunks(rerank_query, retrieved_chunks)

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
         filtered_chunks = reranked_chunks # fallback if too aggressive

    # Step 2: Reranker cutoff (formalize top K selection pool)
    final_limit = max(1, min(final_k or 4, len(filtered_chunks)))
    pool_for_diversity = filtered_chunks[:final_limit * 2] # take extra for diversity buffer

    # Step 3: Diversity filtering (remove near-duplicates to maximize context utilization)
    diverse_chunks = []
    for c in pool_for_diversity:
        is_duplicate = False
        for d in diverse_chunks:
            # Reusing existing lexical overlap function to check chunk similarity
            overlap = _keyword_overlap_score(c["decoded_text"], d["decoded_text"])
            if overlap > 0.8: # 80% similar = duplicate
                is_duplicate = True
                break
        if not is_duplicate:
            diverse_chunks.append(c)
        if len(diverse_chunks) >= final_limit:
            break

    if not diverse_chunks:
        diverse_chunks = reranked_chunks[:final_limit]

    rerank_scores = [round(chunk.get("rerank_score", 0.0), 4) for chunk in diverse_chunks]
    reranked = True

    # reorder to put best chunks at the end (lost-in-middle mitigation)
    final_candidates = diverse_chunks
    if len(final_candidates) > 1:
         # Sort by rerank score descending, then reverse so highest is last
         important = sorted(final_candidates, key=lambda x: x.get("rerank_score", 0.0), reverse=True)
         inject_order = important[::-1]
    else:
         inject_order = final_candidates

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

            chunk["final_importance"] = round((0.7 * chunk.get("rerank_score", 0.0) + 0.3 * chunk.get("similarity_score", 0.0)) * chunk["positional_weight"], 3) if "rerank_score" in chunk else round(primary_score * chunk["positional_weight"], 3)
            snippet_start = decode_tokens(chunk.get("raw_tokens", [])[:5], tokenizer_name).strip()
            snippet_end = decode_tokens(chunk.get("raw_tokens", [])[-5:], tokenizer_name).strip()
            chunk["boundary_snippet"] = f"{snippet_start} ... {snippet_end}"

        return local_valid

    # build before/after valid chunk sets to measure reranker impact
    before_valid = _build_valid_from_candidates(retrieved_chunks[:final_limit])
    after_valid = _build_valid_from_candidates(inject_order)

    # compute reranker impact metrics
    reranker_impact = {
        "before": compute_retrieval_usage_gap(before_valid),
        "after": compute_retrieval_usage_gap(after_valid),
    }

    # use the after_valid set as the canonical valid_chunks for downstream analysis
    valid_chunks = after_valid

    # 4. Prompt Injection Phase (Positional Attention)
    if not valid_chunks:
        # compute empty metrics
        retrieval_analysis = compute_retrieval_usage_gap([])
        ignored_relevant_chunks = detect_ignored_relevant([])
        attention_waste = compute_attention_waste([])

        return {
            "total_original_tokens": total_tokens,
            "total_chunks_created": total_chunks_created,
            "chunks_in_prompt": 0,
            "extra_tokens_due_to_overlap": extra_tokens,
            "chunks": [],
            "error": "context_window_overflow",
            "attention_curve": [],
            "retrieval_mode": retrieval_mode,
            "query_strategy": query_transformer,
            "query_variants": [variant.text for variant in variants] if total_chunks_created > 0 else [],
            "variant_retrievals": variant_retrievals,
            "total_retrieved_chunks": total_retrieved_chunks,
            "unique_retrieved_chunks": unique_retrieved_chunks,
            "retrieval_diversity": retrieval_diversity,
            "retrieval_overlap": retrieval_overlap,
            "reranked": reranked,
            "rerank_scores": rerank_scores,
            "retrieval_analysis": retrieval_analysis,
            "ignored_relevant_chunks": ignored_relevant_chunks,
            "attention_waste": attention_waste,
            "reranker_impact": reranker_impact,
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

        chunk["final_importance"] = round((0.7 * chunk.get("rerank_score", 0.0) + 0.3 * chunk.get("similarity_score", 0.0)) * chunk["positional_weight"], 3) if "rerank_score" in chunk else round(primary_score * chunk["positional_weight"], 3)
        final_importances.append(chunk["final_importance"])

        snippet_start = decode_tokens(chunk["raw_tokens"][:5], tokenizer_name).strip()
        snippet_end = decode_tokens(chunk["raw_tokens"][-5:], tokenizer_name).strip()
        chunk["boundary_snippet"] = f"{snippet_start} ... {snippet_end}"

    # Adaptive Risk Assessment
    if final_importances:
        min_imp = min(final_importances)
        max_imp = max(final_importances)
        range_imp = max_imp - min_imp

        if len(valid_chunks) == 1 or range_imp == 0:
            for chunk in valid_chunks:
                if chunk.get("lost_reason") == "position_bias":
                    chunk["risk_level"] = "high_risk (position_bias)"
                elif chunk.get("lost_reason") == "lost_in_middle":
                    chunk["risk_level"] = "high_risk (lost_in_middle)"
                elif chunk.get("lost_reason") == "low_relevance":
                    chunk["risk_level"] = "medium_risk (low_relevance)"
                else:
                    chunk["risk_level"] = "safe (high retention)"

            retrieval_analysis = compute_retrieval_usage_gap(valid_chunks)
            ignored_relevant_chunks = detect_ignored_relevant(valid_chunks)
            attention_waste = compute_attention_waste(valid_chunks)

            return {
                "total_original_tokens": total_tokens,
                "total_chunks_created": total_chunks_created,
                "chunks_in_prompt": len(valid_chunks),
                "extra_tokens_due_to_overlap": extra_tokens,
                "chunks": valid_chunks,
                "attention_curve": [round(w, 3) for w in positional_weights],
                "retrieval_mode": retrieval_mode,
                "query_strategy": query_transformer,
                "query_variants": [variant.text for variant in variants] if total_chunks_created > 0 else [],
                "variant_retrievals": variant_retrievals,
                "total_retrieved_chunks": total_retrieved_chunks,
                "unique_retrieved_chunks": unique_retrieved_chunks,
                "retrieval_diversity": retrieval_diversity,
                "retrieval_overlap": retrieval_overlap,
                "reranked": reranked,
                "rerank_scores": rerank_scores,
                "retrieval_analysis": retrieval_analysis,
                "ignored_relevant_chunks": ignored_relevant_chunks,
                "attention_waste": attention_waste,
                "reranker_impact": reranker_impact,
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

    retrieval_analysis = compute_retrieval_usage_gap(valid_chunks)
    ignored_relevant_chunks = detect_ignored_relevant(valid_chunks)
    attention_waste = compute_attention_waste(valid_chunks)

    return {
        "total_original_tokens": total_tokens,
        "total_chunks_created": total_chunks_created,
        "chunks_in_prompt": len(valid_chunks),
        "extra_tokens_due_to_overlap": extra_tokens,
        "chunks": valid_chunks,
        "attention_curve": [round(w, 3) for w in positional_weights],
        "retrieval_mode": retrieval_mode,
        "query_strategy": query_transformer,
        "query_variants": [variant.text for variant in variants] if total_chunks_created > 0 else [],
        "variant_retrievals": variant_retrievals,
        "total_retrieved_chunks": total_retrieved_chunks,
        "unique_retrieved_chunks": unique_retrieved_chunks,
        "retrieval_diversity": retrieval_diversity,
        "retrieval_overlap": retrieval_overlap,
        "reranked": reranked,
        "rerank_scores": rerank_scores,
        "retrieval_analysis": retrieval_analysis,
        "ignored_relevant_chunks": ignored_relevant_chunks,
        "attention_waste": attention_waste,
        "reranker_impact": reranker_impact,
    }