import random
from enum import Enum
from typing import Iterable, List


class ContextPlacementStrategy(str, Enum):
    RELEVANCE = "relevance"
    REVERSE = "reverse"
    RANDOM = "random"
    MIDDLE_INSERT = "middle_insert"


def build_prompt(
    chunks: Iterable[dict],
    strategy: str,
    random_seed: int | None = None,
) -> List[dict]:
    ordered = list(chunks)
    normalized = (strategy or ContextPlacementStrategy.REVERSE.value).lower()

    def _score(item: dict) -> float:
        return float(item.get("rerank_score", item.get("similarity_score", 0.0)) or 0.0)

    if normalized == ContextPlacementStrategy.RELEVANCE.value:
        return sorted(ordered, key=_score, reverse=True)

    if normalized == ContextPlacementStrategy.REVERSE.value:
        return sorted(ordered, key=_score, reverse=False)

    if normalized == ContextPlacementStrategy.RANDOM.value:
        rng = random.Random(random_seed) if random_seed is not None else random
        rng.shuffle(ordered)
        return ordered

    if normalized == ContextPlacementStrategy.MIDDLE_INSERT.value:
        if len(ordered) <= 2:
            return sorted(ordered, key=_score, reverse=True)

        ranked = sorted(ordered, key=_score, reverse=True)
        best = ranked.pop(0)
        mid = len(ranked) // 2
        ranked.insert(mid, best)
        return ranked

    return sorted(ordered, key=_score, reverse=False)
