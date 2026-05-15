from tokenizer_engine import decode_tokens
from context_simulator import calculate_attention_weights

def simulate_rag_pipeline(
    token_ids: list[int],
    chunk_size: int,
    overlap: int,
    tokenizer_name: str,
    top_k: int,
    retrieval_strategy: str,
    context_window: int
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

        all_chunks.append({
            "chunk_index": chunk_index,
            "start_token": start,
            "end_token": end,
            "token_count": len(chunk_tokens),
            "raw_tokens": chunk_tokens,
        })

        start += (chunk_size - overlap)
        chunk_index += 1

    total_chunks_created = len(all_chunks)

    # Calculate exact token waste
    total_chunked_tokens = sum(c["token_count"] for c in all_chunks)
    extra_tokens = max(0, total_chunked_tokens - total_tokens)

    # Deterministic similarity model: earlier chunks are more relevant.
    if total_chunks_created > 0:
        similarity_denominator = max(1, total_chunks_created - 1)
        for chunk in all_chunks:
            normalized_position = (chunk["chunk_index"] - 1) / similarity_denominator
            chunk["similarity_score"] = round(1.0 - (0.5 * normalized_position), 3)

    # 2. Retrieval Phase
    if retrieval_strategy == "relevance_sorted":
        all_chunks = sorted(all_chunks, key=lambda x: x["similarity_score"], reverse=True)

    # Truncate to Top-K
    retrieved_chunks = all_chunks[:top_k]

    # Context Window Protection (Drop chunks if Top-K exceeds model limits)
    valid_chunks = []
    current_prompt_tokens = 0
    for chunk in retrieved_chunks:
        if current_prompt_tokens + chunk["token_count"] <= context_window:
            valid_chunks.append(chunk)
            current_prompt_tokens += chunk["token_count"]
        else:
            break

    # 3. Prompt Injection Phase (Positional Attention)
    if not valid_chunks:
        return {
            "total_original_tokens": total_tokens,
            "total_chunks_created": total_chunks_created,
            "chunks_in_prompt": 0,
            "extra_tokens_due_to_overlap": extra_tokens,
            "chunks": [],
            "error": "context_window_overflow",
        }

    visible_positions = range(len(valid_chunks))
    positional_weights = calculate_attention_weights(
        visible_tokens=visible_positions,
        decay_power=2.0,
        recency_strength=0.5
    )

    # 4. Adaptive Thresholds & Final Importance
    final_importances = []
    for i, chunk in enumerate(valid_chunks):
        chunk["positional_weight"] = positional_weights[i]
        # Combine the model's position attention with the chunk's actual relevance
        chunk["final_importance"] = round(chunk["similarity_score"] * chunk["positional_weight"], 3)
        final_importances.append(chunk["final_importance"])

        # Decode only the chunks that actually made it into the prompt (Optimization)
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
                "chunks": valid_chunks
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
        "chunks": valid_chunks
    }