from __future__ import annotations

from typing import List

from .base import QueryTransformer, QueryVariant, normalize_query, unique_variants


class BaselineTransformer(QueryTransformer):
    name = "baseline"

    def transform(self, query: str, *, max_variants: int = 5) -> List[QueryVariant]:
        normalized = normalize_query(query)
        variants = [QueryVariant(text=normalized, source="baseline")]
        return unique_variants(variants, max_variants)
