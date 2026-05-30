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
    from services.rag_pipeline import simulate_rag_pipeline
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
    from backend.services.rag_pipeline import simulate_rag_pipeline