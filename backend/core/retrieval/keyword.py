import re

WORD_PATTERN = re.compile(r"[A-Za-z0-9]+")


def _normalized_words(text: str) -> set[str]:
    return {match.group(0).lower() for match in WORD_PATTERN.finditer(text)}


def _ordered_terms(text: str, limit: int = 12) -> list[str]:
    terms = []
    seen = set()
    for match in WORD_PATTERN.finditer(text):
        term = match.group(0).lower()
        if term in seen:
            continue
        seen.add(term)
        terms.append(term)
        if len(terms) >= limit:
            break
    return terms


def _keyword_overlap_score(query: str, text: str) -> float:
    query_terms = _normalized_words(query)
    if not query_terms:
        return 0.0

    matching_terms = [
        match.group(0).lower()
        for match in WORD_PATTERN.finditer(text)
        if match.group(0).lower() in query_terms
    ]
    return round(min(1.0, len(matching_terms) / max(1, len(query_terms))), 3)
