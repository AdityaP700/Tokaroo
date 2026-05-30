def _assign_ranks(chunks: list[dict], score_key: str) -> dict[int, int]:
    ranked = sorted(
        chunks,
        key=lambda item: item.get(score_key) if item.get(score_key) is not None else float("-inf"),
        reverse=True,
    )
    return {chunk.get("chunk_index"): rank for rank, chunk in enumerate(ranked, start=1)}


def compute_rrf_scores(rankings: dict[str, list[int]], k: int = 60) -> dict[int, float]:
    rrf_scores: dict[int, float] = {}
    for ranked_ids in rankings.values():
        for rank, chunk_id in enumerate(ranked_ids, start=1):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (k + rank))
    return rrf_scores
