import math
import logging

logger = logging.getLogger(__name__)


def compute_retrieval_usage_gap(chunks: list[dict], total_relevant_count: int | None = None) -> dict:
    if not chunks:
        return {
            "retrieval_quality": 0.0,
            "usage_quality": 0.0,
            "answer_quality": 0.0,
            "coverage": 0.0,
            "gap": 0.0,
        }

    # Now using rerank_score as the authoritative relevance signal
    retrieval_scores = [c.get("rerank_score", c.get("similarity_score", 0.0)) for c in chunks]
    usage_scores = [
        c.get("rerank_score", c.get("similarity_score", 0.0)) * c.get("attention_weight", 0.0)
        for c in chunks
    ]

    retrieval_quality = sum(retrieval_scores) / len(retrieval_scores)
    usage_quality = sum(usage_scores) / len(usage_scores)
    gap = retrieval_quality - usage_quality

    attention_total = sum(c.get("attention_weight", 0.0) for c in chunks)
    attended_relevance = (
        sum(
            c.get("rerank_score", c.get("similarity_score", 0.0)) * c.get("attention_weight", 0.0)
            for c in chunks
        )
        / attention_total
        if attention_total > 0
        else 0.0
    )
    relevance_threshold = max(0.3, retrieval_quality * 0.8)
    relevant_chunks = [score for score in retrieval_scores if score >= relevance_threshold]
    used_relevant_chunks = [
        c
        for c in chunks
        if c.get("rerank_score", c.get("similarity_score", 0.0)) >= relevance_threshold
        and c.get("attention_weight", 0.0) >= 0.3
    ]

    denominator = total_relevant_count if total_relevant_count is not None else len(relevant_chunks)
    relevant_coverage = len(used_relevant_chunks) / denominator if denominator > 0 else 0.0
    answer_quality = (0.45 * usage_quality) + (0.35 * attended_relevance) + (0.2 * relevant_coverage)

    return {
        "retrieval_quality": round(retrieval_quality, 3),
        "usage_quality": round(usage_quality, 3),
        "answer_quality": round(answer_quality, 3),
        "coverage": round(relevant_coverage, 3),
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


def compute_faithfulness(
    #accepts ans as string
    answer: str,
    #accept retrieved context chunks as dict
    #but we can later expand it to pydantic,typeDict,dataclass
    context_chunks: list[dict],
    encode_fn=None,
    keyword_score_fn=None,
    embedding_threshold: float = 0.6,
    keyword_threshold: float = 0.4,
) -> dict:
    """
    Computes faithfulness/groundedness of an answer against retrieved context chunks.
    Splits the answer into sentences/statements.
    For each sentence, computes its support score against each chunk.
    If the max support score exceeds a threshold, the statement is supported.
    """
    import re
    if not answer or not answer.strip():
        return {
            "score": 0.0,
            "supported_claims": 0,
            "unsupported_claims": 0,
            "failure_type": "claim_extraction",
            "claims": [],
            "statements": [],
        }

    # Split answer into sentences/statements
    # Match sentence endings (. ! ?) followed by space or end of line
    raw_statements = re.split(r'(?<=[.!?])\s+', answer.strip())
    statements = [s.strip() for s in raw_statements if s.strip()]
    if not statements:
        return {
            "score": 1.0,
            "supported_claims": 0,
            "unsupported_claims": 0,
            "failure_type": "claim_extraction",
            "claims": [],
            "statements": [],
        }

    claim_details = []
    supported_count = 0

    chunk_texts = [c.get("decoded_text", "") for c in context_chunks]

    # Pre-encode chunk texts if encode_fn is available and we have chunk texts
    chunk_embeddings = None
    if encode_fn and chunk_texts:
        try:
            chunk_embeddings = encode_fn(chunk_texts)
        except Exception as e:
            logger.exception("Failed to encode chunk texts during faithfulness evaluation: %s", e)
            chunk_embeddings = None

    # Load keyword score function if not provided
    if keyword_score_fn is None:
        try:
            from core.retrieval.keyword import _keyword_overlap_score as kw_fn
        except ModuleNotFoundError:
            from backend.core.retrieval.keyword import _keyword_overlap_score as kw_fn
        keyword_score_fn = kw_fn

    for stmt in statements:
        #tracks the best evidence found so far
        max_sim = 0.0
        supporting_idx = None
        support_type = "none"

        # Check embedding similarity if encode_fn and chunk_embeddings are available
        stmt_embedding = None
        if encode_fn and chunk_embeddings is not None:
            try:
                #embedding apis expect list[str] and returns N*D matrix
                stmt_embedding = encode_fn([stmt])
            except Exception as e:
                logger.exception("Failed to encode statement during faithfulness evaluation: %s", e)
                stmt_embedding = None

            if stmt_embedding is not None and len(stmt_embedding) > 0:
                # Calculate cosine similarity with all chunks
                # stmt_embedding is shape (1, D), chunk_embeddings is shape (N, D)
                for idx, chunk_emb in enumerate(chunk_embeddings):
                    try:
                        #similarity comparision
                        #this assumes embeddings are normalized
                        sim = float(stmt_embedding[0] @ chunk_emb)
                    except Exception as e:
                        logger.exception("Error computing dot product between statement and chunk embedding: %s", e)
                        sim = 0.0
                    if sim > max_sim:
                        max_sim = sim
                        supporting_idx = context_chunks[idx].get("chunk_index")
                        support_type = "embedding"

        # If embedding similarity is low or not available, check keyword overlap
        if support_type == "none" or max_sim < embedding_threshold:
            for idx, chunk in enumerate(context_chunks):
                kw_sim = 0.0
                if keyword_score_fn:
                    try:
                        kw_sim = keyword_score_fn(stmt, chunk.get("decoded_text", ""))
                    except Exception as e:
                        logger.exception("Error computing keyword overlap score for statement: %s", e)
                        pass

                # If we didn't use embeddings or embedding similarity is lower than keyword similarity
                if kw_sim > max_sim:
                    max_sim = kw_sim
                    supporting_idx = chunk.get("chunk_index")
                    support_type = "keyword"

        # Determine support status
        is_supported = False
        if support_type == "embedding" and max_sim >= embedding_threshold:
            is_supported = True
        elif support_type == "keyword" and max_sim >= keyword_threshold:
            is_supported = True

        if is_supported:
            supported_count += 1

        claim_detail = {
            "claim": stmt,
            "statement": stmt,  # backward compatibility
            "supported": is_supported,
            "max_similarity": round(max_sim, 3),
            "supporting_chunk_index": supporting_idx if is_supported else None,
            "support_type": support_type if is_supported else "none",
        }
        claim_details.append(claim_detail)

    score = round(supported_count / len(statements), 3) if statements else 1.0
    unsupported_count = len(statements) - supported_count

    if unsupported_count > 0:
        failure_type = "unsupported_claims"
    else:
        failure_type = "none"

    return {
        "score": score,
        "supported_claims": supported_count,
        "unsupported_claims": unsupported_count,
        "failure_type": failure_type,
        "claims": claim_details,
        "statements": claim_details,
    }

