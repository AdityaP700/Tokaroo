def calculate_attention_weights(visible_tokens: list[int], min_attention: float = 0.1) -> list[float]:
    n = len(visible_tokens)

    # If the text is incredibly short, attention is perfect
    if n <= 2:
        return [1.0] * n

    weights = []
    for i in range(n):
        # Normalize position to [0, 1]
        x = i / (n - 1)
        # Calculate U-shape: 1.0 at edges, min_attention at exact center (0.5)
        w = min_attention + (1 - min_attention) * 4 * ((x - 0.5) ** 2)
        weights.append(round(w, 4))

    return weights