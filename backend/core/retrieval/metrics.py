import math


def compute_retrieval_usage_gap(chunks: list[dict]) -> dict:
    if not chunks:
        return {"retrieval_quality": 0.0, "usage_quality": 0.0, "gap": 0.0}

    # Now using rerank_score as the authoritative relevance signal
    retrieval_scores = [c.get("rerank_score", c.get("similarity_score", 0.0)) for c in chunks]
    usage_scores = [
        c.get("rerank_score", c.get("similarity_score", 0.0)) * c.get("attention_weight", 0.0)
        for c in chunks
    ]

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


def compute_retrieval_metrics(all_chunks: list[dict], ranked_chunks: list[dict], k: int) -> dict:
    if not all_chunks or not ranked_chunks or k <= 0:
        return {"recall_at_k": 0.0, "mrr": 0.0, "hit_rate": 0.0, "ndcg": 0.0}

    relevance_scores = [c.get("relevance_score", c.get("similarity_score", 0.0)) for c in all_chunks]
    avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.0
    relevant_threshold = max(0.3, avg_relevance * 0.8)
    relevant_ids = {
        c.get("chunk_index")
        for c in all_chunks
        if c.get("relevance_score", c.get("similarity_score", 0.0)) >= relevant_threshold
    }
    total_relevant = len(relevant_ids)

    top_k = ranked_chunks[: max(1, min(k, len(ranked_chunks)))]
    hits = [c for c in top_k if c.get("chunk_index") in relevant_ids]
    recall_at_k = len(hits) / total_relevant if total_relevant else 0.0
    hit_rate = 1.0 if hits else 0.0

    mrr = 0.0
    for rank, chunk in enumerate(top_k, start=1):
        if chunk.get("chunk_index") in relevant_ids:
            mrr = 1.0 / rank
            break

    def _dcg(values: list[float]) -> float:
        return sum((rel / (math.log2(idx + 2))) for idx, rel in enumerate(values))

    gains = [c.get("relevance_score", c.get("similarity_score", 0.0)) for c in top_k]
    dcg = _dcg(gains)
    ideal_gains = sorted(relevance_scores, reverse=True)[: len(top_k)]
    idcg = _dcg(ideal_gains)
    ndcg = (dcg / idcg) if idcg > 0 else 0.0

    return {
        "recall_at_k": round(recall_at_k, 4),
        "mrr": round(mrr, 4),
        "hit_rate": round(hit_rate, 4),
        "ndcg": round(ndcg, 4),
    }


def compute_retrieval_metrics_gold(ranked_chunks: list[dict], labels: dict[int, int], k: int) -> dict:
    if not labels or not ranked_chunks or k <= 0:
        return {"recall_at_k": 0.0, "mrr": 0.0, "hit_rate": 0.0, "ndcg": 0.0}

    relevant_ids = {chunk_id for chunk_id, grade in labels.items() if grade > 0}
    total_relevant = len(relevant_ids)
    top_k = ranked_chunks[: max(1, min(k, len(ranked_chunks)))]

    hits = [c for c in top_k if c.get("chunk_index") in relevant_ids]
    recall_at_k = len(hits) / total_relevant if total_relevant else 0.0
    hit_rate = 1.0 if hits else 0.0

    mrr = 0.0
    for rank, chunk in enumerate(top_k, start=1):
        if chunk.get("chunk_index") in relevant_ids:
            mrr = 1.0 / rank
            break

    gains = [labels.get(c.get("chunk_index"), 0) for c in top_k]
    dcg = sum((rel / (math.log2(idx + 2))) for idx, rel in enumerate(gains))
    ideal_gains = sorted(labels.values(), reverse=True)[: len(top_k)]
    idcg = sum((rel / (math.log2(idx + 2))) for idx, rel in enumerate(ideal_gains))
    ndcg = (dcg / idcg) if idcg > 0 else 0.0

    return {
        "recall_at_k": round(recall_at_k, 4),
        "mrr": round(mrr, 4),
        "hit_rate": round(hit_rate, 4),
        "ndcg": round(ndcg, 4),
    }
