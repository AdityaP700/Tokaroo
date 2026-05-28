from __future__ import annotations

from typing import List

from .base import QueryTransformer, QueryVariant
from .baseline import BaselineTransformer
from .hyde import HyDETransformer
from .multi_query import MultiQueryTransformer

_TRANSFORMERS = {
    "baseline": BaselineTransformer(),
    "hyde": HyDETransformer(),
    "multi_query": MultiQueryTransformer(),
}


def get_query_transformer(name: str | None) -> QueryTransformer:
    if not name:
        return _TRANSFORMERS["baseline"]

    key = name.strip().lower()
    return _TRANSFORMERS.get(key, _TRANSFORMERS["baseline"])


def transform_query(query: str, *, strategy: str | None, max_variants: int = 5) -> List[QueryVariant]:
    transformer = get_query_transformer(strategy)
    return transformer.transform(query, max_variants=max_variants)
