from functools import lru_cache
import logging
import math

from .keyword import _normalized_words

logger = logging.getLogger(__name__)

_CROSS_ENCODER_RERANKER = None


def _sigmoid(x: float) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-x))
    except OverflowError:
        return 0.0 if x < 0 else 1.0


@lru_cache(maxsize=1)
def _load_default_cross_encoder_reranker():
    try:
        from sentence_transformers import CrossEncoder
    except (ModuleNotFoundError, ImportError) as e:
        logger.warning("sentence_transformers not installed, falling back to keyword scoring: %s", e)
        return None

    try:
        return CrossEncoder(
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
            model_kwargs={"local_files_only": True},
        )
    except Exception:
        logger.info("Model cross-encoder/ms-marco-MiniLM-L-6-v2 not found locally. Attempting to download...")
        try:
            return CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        except Exception as e:
            logger.exception("Failed to download or load cross encoder reranker: %s", e)
            return None


def set_cross_encoder_reranker(model) -> None:
    global _CROSS_ENCODER_RERANKER
    _CROSS_ENCODER_RERANKER = model


def get_cross_encoder_reranker():
    if _CROSS_ENCODER_RERANKER is not None:
        return _CROSS_ENCODER_RERANKER

    return _load_default_cross_encoder_reranker()


def rerank_chunks(query: str, chunks: list[dict]) -> list[dict]:
    reranker = get_cross_encoder_reranker()

    if reranker is not None and chunks:
        pairs = [(query, chunk.get("decoded_text", "")) for chunk in chunks]
        try:
            rerank_scores = reranker.predict(pairs)
            for chunk, score in zip(chunks, rerank_scores):
                chunk["cross_encoder_score"] = round(float(score), 4)
                chunk["rerank_score"] = round(_sigmoid(float(score)), 4)

            return sorted(
                chunks,
                key=lambda item: (
                    item.get("rerank_score", 0.0),
                    item.get("similarity_score", 0.0),
                    item.get("token_count", 0),
                ),
                reverse=True,
            )
        except Exception as e:
            logger.exception("Error predicting rerank scores: %s", e)
            # fall back to hybrid keyword scoring if the cross-encoder is unavailable at runtime
            pass

    query_terms = _normalized_words(query)

    for chunk in chunks:
        text_terms = _normalized_words(chunk.get("decoded_text", ""))
        keyword_score = len(query_terms & text_terms) / max(1, len(query_terms)) if query_terms else 0.0
        chunk["cross_encoder_score"] = None
        chunk["rerank_score"] = min(
            1.0,
            round(chunk.get("similarity_score", 0.0) + (0.05 * len(query_terms & text_terms)), 4),
        )
        chunk["keyword_score"] = round(keyword_score, 3)

    return sorted(
        chunks,
        key=lambda item: (
            item.get("rerank_score", 0.0),
            item.get("similarity_score", 0.0),
            item.get("token_count", 0),
        ),
        reverse=True,
    )
