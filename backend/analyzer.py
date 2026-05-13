def analyze_prompt_failure(token_count: int, context_window: int, attention_weights: list[float]) -> dict:
    """
    Analyzes the prompt's token footprint and attention distribution
    to predict where and why an LLM might fail.
    """
    # 1. Base Metrics
    utilization = token_count / context_window
    overflow = max(0, token_count - context_window)
    overflow_percent = overflow / token_count if token_count > 0 else 0.0

    # 2. Middle Risk Detection
    # Look at the bottom 20% of the attention curve to see how bad the drop is
    mid_idx = len(attention_weights) // 2
    middle_risk = "low"

    if len(attention_weights) > 5:
        # If the middle drops below 0.3, the model is likely to hallucinate or ignore it
        if attention_weights[mid_idx] < 0.3:
            middle_risk = "high"
        elif attention_weights[mid_idx] < 0.5:
            middle_risk = "medium"

    # 3. Comprehensive Risk Assessment
    failure_risk = "low"
    reasons = []

    # Evaluate Truncation
    if overflow_percent > 0.2:
        failure_risk = "critical"
        reasons.append(f"Critical Truncation: {overflow_percent*100:.1f}% of your prompt is lost. The model will never see it.")
    elif overflow > 0:
        failure_risk = "high"
        reasons.append(f"Tail Truncation: Prompt exceeds context window by {overflow} tokens.")

    # Evaluate Attention
    if middle_risk == "high":
        if failure_risk == "low":
            failure_risk = "medium"
        reasons.append("Lost-in-the-Middle: Severe attention decay detected. Core instructions in the middle of your prompt will likely be ignored.")

    # Success State
    if not reasons:
        reasons.append("Prompt is optimal. Good context utilization and stable attention distribution.")

    return {
        "utilization_score": round(utilization, 4),
        "overflow_percent": round(overflow_percent, 4),
        "middle_risk": middle_risk,
        "failure_risk": failure_risk,
        "reasons": reasons
    }