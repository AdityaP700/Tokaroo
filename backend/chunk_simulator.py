from functools import lru_cache
import re
from tokenizer_engine import decode_tokens
from context_simulator import calculate_attention_weights

WORD_PATTERN = re.compile(r"[A-Za-z0-9]+")


@lru_cache(maxsize=1)
def _get_sentence_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def _normalized_words(text: str) -> set[str]:
    return {match.group(0).lower() for match in WORD_PATTERN.finditer(text)}


def _encode_texts(texts: list[str]):
    model = _get_sentence_embedding_model()
    if model is None:
        return None

    try:
        return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    except Exception:
        return None


def rerank_chunks(query: str, chunks: list[dict]) -> list[dict]:
    query_terms = _normalized_words(query)

    for chunk in chunks:
        text_terms = _normalized_words(chunk.get("decoded_text", ""))
        keyword_bonus = sum(1 for term in query_terms if term in text_terms)
        chunk["rerank_score"] = round(chunk.get("similarity_score", 0.0) + (0.05 * keyword_bonus), 4)

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
) -> dict:
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
    if total_chunks_created > 0:
        query = query or original_text or ""
        query_embedding = _encode_texts([query]) if query else None
        chunk_texts = [chunk["decoded_text"] for chunk in all_chunks]
        chunk_embeddings = _encode_texts(chunk_texts) if query_embedding is not None else None

        if query_embedding is not None and chunk_embeddings is not None:
            # embeddings are normalized, so dot product acts like cosine similarity
            query_vector = query_embedding[0]
            for i, chunk in enumerate(all_chunks):
                chunk["similarity_score"] = round(float(chunk_embeddings[i] @ query_vector), 3)
        else:
            query_terms = _normalized_words(query)
            if query_terms:
                for chunk in all_chunks:
                    chunk_terms = _normalized_words(chunk["decoded_text"])
                    chunk["similarity_score"] = round(len(query_terms & chunk_terms) / max(1, len(query_terms)), 3)
            elif original_text:
                orig_terms = _normalized_words(original_text)
                for chunk in all_chunks:
                    chunk_terms = _normalized_words(chunk["decoded_text"])
                    chunk["similarity_score"] = round(len(orig_terms & chunk_terms) / max(1, len(orig_terms)), 3)
            else:
                similarity_denominator = max(1, total_chunks_created - 1)
                for chunk in all_chunks:
                    normalized_position = (chunk["chunk_index"] - 1) / similarity_denominator
                    chunk["similarity_score"] = round(1.0 - (0.5 * normalized_position), 3)

    # 3. Retrieval Phase
    if retrieval_strategy == "relevance_sorted":
        all_chunks = sorted(all_chunks, key=lambda x: x["similarity_score"], reverse=True)

    # Initial retrieval, then rerank, then reduce to final_k
    retrieved_chunks = all_chunks[:top_k]
    reranked_chunks = rerank_chunks(query or original_text or "", retrieved_chunks)
    final_limit = max(1, min(final_k or 4, len(reranked_chunks)))
    final_chunks = reranked_chunks[:final_limit]

    # Context Window Protection (Drop chunks if final set exceeds model limits)
    valid_chunks = []
    current_prompt_tokens = 0
    for chunk in final_chunks:
        if current_prompt_tokens + chunk["token_count"] <= context_window:
            valid_chunks.append(chunk)
            current_prompt_tokens += chunk["token_count"]
        else:
            break

    # 4. Prompt Injection Phase (Positional Attention)
    if not valid_chunks:
        return {
            "total_original_tokens": total_tokens,
            "total_chunks_created": total_chunks_created,
            "chunks_in_prompt": 0,
            "extra_tokens_due_to_overlap": extra_tokens,
            "chunks": [],
            "error": "context_window_overflow",
            "attention_curve": [],
        }

    visible_positions = range(len(valid_chunks))
    positional_weights = calculate_attention_weights(
        visible_tokens=visible_positions,
        decay_power=2.0,
        recency_strength=0.5,
    )

    # 5. Adaptive Thresholds & Final Importance
    final_importances = []
    for i, chunk in enumerate(valid_chunks):
        chunk["positional_weight"] = positional_weights[i]
        chunk["final_importance"] = round(chunk["similarity_score"] * chunk["positional_weight"], 3)
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
                chunk["risk_level"] = "safe (high retention)"
            return {
                "total_original_tokens": total_tokens,
                "total_chunks_created": total_chunks_created,
                "chunks_in_prompt": len(valid_chunks),
                "extra_tokens_due_to_overlap": extra_tokens,
                "chunks": valid_chunks,
                "attention_curve": [round(w, 3) for w in positional_weights],
            }

        thresh_critical = min_imp + (0.3 * range_imp)
        thresh_medium = min_imp + (0.6 * range_imp)

        for chunk in valid_chunks:
            if chunk["final_importance"] <= thresh_critical:
                chunk["risk_level"] = "critical (low position + low relevance)"
            elif chunk["final_importance"] <= thresh_medium:
                chunk["risk_level"] = "medium risk"
            else:
                chunk["risk_level"] = "safe (high retention)"

    return {
        "total_original_tokens": total_tokens,
        "total_chunks_created": total_chunks_created,
        "chunks_in_prompt": len(valid_chunks),
        "extra_tokens_due_to_overlap": extra_tokens,
        "chunks": valid_chunks,
        "attention_curve": [round(w, 3) for w in positional_weights],
    }