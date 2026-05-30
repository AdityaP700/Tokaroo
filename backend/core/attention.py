def calculate_attention_weights(
    visible_tokens: list[int],
    min_attention: float = 0.1,
    decay_power: float = 2.0,
    recency_strength: float = 0.3,
) -> list[float]:
    """
    Simulates LLM attention decay with asymmetric recency bias and adjustable curves.
    """
    n = len(visible_tokens)

    if n <= 2:
        return [1.0] * n

    raw_weights = []

    for i in range(n):
        # 1. Normalize position x to [0, 1]
        x = i / (n - 1)

        # We use |2x - 1| to map x from [0, 1] to a [-1, 1] scale,
        # so the absolute value centers the drop exactly at 0.5
        base_weight = min_attention + (1 - min_attention) * (abs(2 * x - 1) ** decay_power)

        # 3. Recency Bias (Asymmetry)
        recency_boost = x ** (1 + recency_strength)

        # Combine
        w = base_weight * (1 + recency_boost)
        raw_weights.append(w)

    max_w = max(raw_weights)
    normalized_weights = [round(w / max_w, 4) for w in raw_weights]

    return normalized_weights
