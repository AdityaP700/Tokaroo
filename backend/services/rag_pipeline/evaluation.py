from services import rag_pipeline

def _target_position_index(position: int | str | None, prompt_size: int) -> int:
    if prompt_size <= 1:
        return 0
    if isinstance(position, str):
        normalized = position.strip().lower()
        if normalized == "first":
            return 0
        if normalized == "middle":
            return prompt_size // 2
        if normalized == "last":
            return prompt_size - 1
        try:
            position = int(normalized)
        except ValueError:
            return prompt_size // 2
    if isinstance(position, int):
        return max(0, min(prompt_size - 1, position - 1))
    return prompt_size // 2

def _build_controlled_context(
    all_chunks: list[dict],
    gold_chunk_id: int | None,
    answer_chunk_position: int | str | None,
    final_k: int | None,
    top_k: int,
    gold_chunk_ids: list[int] | None = None,
) -> list[dict] | None:
    resolved_gold_ids = gold_chunk_ids or ([gold_chunk_id] if gold_chunk_id is not None else [])
    if not resolved_gold_ids or answer_chunk_position is None:
        return None

    primary_gold_id = resolved_gold_ids[0]
    gold_chunk = next((chunk for chunk in all_chunks if chunk.get("chunk_index") == primary_gold_id), None)
    if gold_chunk is None:
        return None

    prompt_size = max(1, min(final_k or top_k or len(all_chunks), len(all_chunks)))
    target_index = _target_position_index(answer_chunk_position, prompt_size)
    other_chunks = sorted(
        (chunk for chunk in all_chunks if chunk.get("chunk_index") not in resolved_gold_ids),
        key=lambda item: item.get("chunk_index", 0),
    )[: max(0, prompt_size - 1)]
    controlled = other_chunks[:]
    controlled.insert(target_index, gold_chunk)
    return controlled[:prompt_size]

def _score_answer_quality(
    chunks: list[dict],
    gold_chunk_id: int | None,
    answer_chunk_position: int | str | None,
    gold_answer: str | None,
    gold_chunk_ids: list[int] | None = None,
) -> dict | None:
    resolved_gold_ids = gold_chunk_ids or ([gold_chunk_id] if gold_chunk_id is not None else [])
    if not resolved_gold_ids:
        return None

    # Find gold chunks in the prompt
    gold_chunks = [c for c in chunks if c.get("chunk_index") in resolved_gold_ids]
    
    gold_prompt_position = None
    gold_chunk = None
    if gold_chunks:
        gold_chunk = gold_chunks[0]
        for index, chunk in enumerate(chunks, start=1):
            if chunk.get("chunk_index") == gold_chunk.get("chunk_index"):
                gold_prompt_position = index
                break
    else:
        gold_chunk = {"chunk_index": resolved_gold_ids[0]}

    attention_score = float(gold_chunk.get("attention_weight", 0.0)) if "attention_weight" in gold_chunk else 0.0
    semantic_support = float(gold_chunk.get("relevance_score", gold_chunk.get("similarity_score", 0.0))) if "similarity_score" in gold_chunk else 0.0

    if gold_answer and gold_chunk.get("decoded_text"):
        encode_fn = getattr(rag_pipeline, "_encode_texts", None)
        keyword_score_fn = getattr(rag_pipeline, "_keyword_overlap_score", None)
        encoded = encode_fn([gold_answer, gold_chunk.get("decoded_text", "")]) if encode_fn else None
        if encoded is not None and len(encoded) == 2:
            semantic_support = max(0.0, min(1.0, float(encoded[0] @ encoded[1])))
        elif keyword_score_fn:
            semantic_support = keyword_score_fn(gold_answer, gold_chunk.get("decoded_text", ""))

    answer_quality = round(attention_score * semantic_support, 3)
    return {
        "gold_chunk_id": resolved_gold_ids[0],
        "gold_chunk_ids": resolved_gold_ids,
        "answer_chunk_position": answer_chunk_position,
        "actual_position": gold_prompt_position,
        "gold_chunk_in_prompt": gold_chunk is not None and "decoded_text" in gold_chunk,
        "gold_attention_weight": round(attention_score, 3),
        "semantic_support": round(semantic_support, 3),
        "answer_quality": answer_quality,
    }
