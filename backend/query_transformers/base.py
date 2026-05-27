from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class QueryVariant:
    text: str
    source: str


class QueryTransformer:
    name = "baseline"

    def transform(self, query: str, *, max_variants: int = 5) -> List[QueryVariant]:
        raise NotImplementedError


def normalize_query(query: str) -> str:
    return " ".join(query.strip().split())


def unique_variants(variants: List[QueryVariant], max_variants: int) -> List[QueryVariant]:
    seen = set()
    unique = []
    for variant in variants:
        text = normalize_query(variant.text)
        if not text:
            continue
        if text.lower() in seen:
            continue
        seen.add(text.lower())
        unique.append(QueryVariant(text=text, source=variant.source))
        if len(unique) >= max_variants:
            break
    return unique
