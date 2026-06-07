# Default static imports
try:
    from core.retrieval.embedding import _encode_texts as _default_encode_texts
    from core.retrieval.keyword import (
        _keyword_overlap_score as _default_keyword_overlap_score,
        _normalized_words as _default_normalized_words,
        _ordered_terms as _default_ordered_terms,
    )
    from core.retrieval.rerank import rerank_chunks as _default_rerank_chunks
    from core.tokenization import decode_tokens as _default_decode_tokens, get_tokens as _default_get_tokens
    from query_transformers import transform_query as _default_transform_query
except ModuleNotFoundError:
    from backend.core.retrieval.embedding import _encode_texts as _default_encode_texts
    from backend.core.retrieval.keyword import (
        _keyword_overlap_score as _default_keyword_overlap_score,
        _normalized_words as _default_normalized_words,
        _ordered_terms as _default_ordered_terms,
    )
    from backend.core.retrieval.rerank import rerank_chunks as _default_rerank_chunks
    from backend.core.tokenization import decode_tokens as _default_decode_tokens, get_tokens as _default_get_tokens
    from backend.query_transformers import transform_query as _default_transform_query

# Module-level attributes that chunk_simulator.py patches at runtime
decode_tokens = _default_decode_tokens
get_tokens = _default_get_tokens
_encode_texts = _default_encode_texts
_keyword_overlap_score = _default_keyword_overlap_score
_normalized_words = _default_normalized_words
_ordered_terms = _default_ordered_terms
transform_query = _default_transform_query
rerank_chunks = _default_rerank_chunks

from .pipeline import simulate_rag_pipeline

__all__ = [
    "simulate_rag_pipeline",
    "decode_tokens",
    "get_tokens",
    "_encode_texts",
    "_keyword_overlap_score",
    "_normalized_words",
    "_ordered_terms",
    "transform_query",
    "rerank_chunks",
]
