from __future__ import annotations

import re
from typing import List

from .base import QueryTransformer, QueryVariant, normalize_query, unique_variants

_WORD_PATTERN = re.compile(r"[A-Za-z0-9]+")
_STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "to",
    "of",
    "for",
    "in",
    "on",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "how",
    "what",
    "why",
    "when",
    "where",
    "which",
    "about",
}


def _keywords(query: str) -> str:
    tokens = [m.group(0).lower() for m in _WORD_PATTERN.finditer(query)]
    keywords = [t for t in tokens if t not in _STOPWORDS]
    return " ".join(keywords[:6])


class MultiQueryTransformer(QueryTransformer):
    name = "multi_query"

    def transform(self, query: str, *, max_variants: int = 5) -> List[QueryVariant]:
        normalized = normalize_query(query)
        trimmed = normalized.rstrip(" ?")
        keyword_phrase = _keywords(normalized)

        variants = [QueryVariant(text=normalized, source="multi_query")]

        angle_templates = [
            f"explain {trimmed}",
            f"definition of {trimmed}",
            f"what causes {trimmed}",
            f"why does {trimmed} happen",
            f"how does attention bias affect {trimmed}",
            f"positional bias in long context: {trimmed}",
            f"long context failure modes for {trimmed}",
            f"retrieval noise impact on {trimmed}",
            f"how do transformers handle long context for {trimmed}",
            f"context ordering effects on {trimmed}",
        ]

        variants.extend(QueryVariant(text=text, source="multi_query") for text in angle_templates)

        if not normalized.endswith("?"):
            variants.append(QueryVariant(text=f"what is {trimmed}?", source="multi_query"))

        if keyword_phrase:
            variants.append(QueryVariant(text=f"key terms {keyword_phrase}", source="multi_query"))

        return unique_variants(variants, max_variants)
