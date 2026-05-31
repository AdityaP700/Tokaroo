try:
    from core.retrieval.embedding import (
        _encode_texts,
        _load_default_sentence_embedding_model,
        get_sentence_embedding_model,
        set_sentence_embedding_model,
    )
    from core.retrieval.keyword import _keyword_overlap_score, _normalized_words, _ordered_terms
    from core.retrieval.metrics import (
        compute_attention_waste,
        compute_retrieval_metrics,
        compute_retrieval_metrics_gold,
        compute_retrieval_usage_gap,
        detect_ignored_relevant,
    )
    from core.retrieval.ranks import _assign_ranks, compute_rrf_scores
    from core.retrieval.rerank import (
        _load_default_cross_encoder_reranker,
        get_cross_encoder_reranker,
        rerank_chunks,
        set_cross_encoder_reranker,
    )
    from core.tokenization import decode_tokens, get_tokens
    from query_transformers import transform_query
    from services import rag_pipeline as _rag_pipeline
except ModuleNotFoundError:
    from backend.core.retrieval.embedding import (
        _encode_texts,
        _load_default_sentence_embedding_model,
        get_sentence_embedding_model,
        set_sentence_embedding_model,
    )
    from backend.core.retrieval.keyword import _keyword_overlap_score, _normalized_words, _ordered_terms
    from backend.core.retrieval.metrics import (
        compute_attention_waste,
        compute_retrieval_metrics,
        compute_retrieval_metrics_gold,
        compute_retrieval_usage_gap,
        detect_ignored_relevant,
    )
    from backend.core.retrieval.ranks import _assign_ranks, compute_rrf_scores
    from backend.core.retrieval.rerank import (
        _load_default_cross_encoder_reranker,
        get_cross_encoder_reranker,
        rerank_chunks,
        set_cross_encoder_reranker,
    )
    from backend.core.tokenization import decode_tokens, get_tokens
    from backend.query_transformers import transform_query
    from backend.services import rag_pipeline as _rag_pipeline


_DEFAULT_ENCODE_TEXTS = _encode_texts
_get_sentence_embedding_model = get_sentence_embedding_model


def _encode_with_configured_model(texts: list[str]):
    model = _get_sentence_embedding_model()
    if model is None:
        return None
    try:
        return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    except Exception:
        return None


def simulate_rag_pipeline(**kwargs):
    kwargs.setdefault("query", "")

    _rag_pipeline.decode_tokens = decode_tokens
    _rag_pipeline.get_tokens = get_tokens
    _rag_pipeline._encode_texts = _encode_texts if _encode_texts is not _DEFAULT_ENCODE_TEXTS else _encode_with_configured_model
    _rag_pipeline._keyword_overlap_score = _keyword_overlap_score
    _rag_pipeline._normalized_words = _normalized_words
    _rag_pipeline._ordered_terms = _ordered_terms
    _rag_pipeline.transform_query = transform_query
    _rag_pipeline.rerank_chunks = rerank_chunks

    return _rag_pipeline.simulate_rag_pipeline(**kwargs)
