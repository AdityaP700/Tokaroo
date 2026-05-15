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


def generate_rag_diagnosis(rag_data: dict, top_k: int, retrieval_strategy: str) -> dict:
    """
    Evaluates chunking metrics to generate a definitive diagnosis and actionable steps.
    """
    chunks = rag_data.get("chunks", [])
    chunks_in_prompt = rag_data.get("chunks_in_prompt", 0)
    extra_tokens = rag_data.get("extra_tokens_due_to_overlap", 0)

    primary_issue = "optimal"
    impact = "low"
    confidence = 0.95
    short_summary = "RAG pipeline is healthy and context utilization is optimal."
    actionable_steps: list[str] = []

    # Check 1: Context Window Truncation (Highest Impact)
    if chunks_in_prompt < top_k:
        primary_issue = "context_window_overflow"
        impact = "critical"
        confidence = 0.99
        short_summary = (
            f"Prompt limit exceeded. Vector DB retrieved {top_k} chunks, "
            f"but only {chunks_in_prompt} fit."
        )
        actionable_steps.extend([
            "Reduce the chunk size to fit more unique documents.",
            "Lower the Top-K retrieval limit in your Vector DB.",
            "Upgrade to a model with a larger context window (e.g., Claude 3.5 Sonnet or Gemini 1.5 Pro)."
        ])

    # Check 2: The Lost in the Middle Effect
    elif any(c.get("risk_level", "").startswith("critical") for c in chunks):
        primary_issue = "lost_in_middle_decay"
        impact = "high"
        confidence = 0.88
        short_summary = "High-relevance chunks are trapped in the middle of the prompt and will likely be ignored by the LLM."
        actionable_steps.extend([
            "Move critical chunks to the very end of the prompt (leverage recency bias).",
            "Reduce total chunk count to 3-5 to flatten the attention curve.",
            "Use relevance-sorted retrieval rather than sequential insertion."
        ])

    # Check 3: Token Economics / Overlap Waste
    elif extra_tokens > (rag_data.get("total_original_tokens", 1) * 0.4):
        primary_issue = "high_token_redundancy"
        impact = "medium"
        confidence = 0.92
        short_summary = f"You are paying for {extra_tokens} duplicate tokens due to excessive chunk overlap."
        actionable_steps.extend([
            "Lower chunk overlap to 10-15% of your total chunk size.",
            "Implement semantic chunking instead of blind character/token counts."
        ])

    # Success Case
    if not actionable_steps:
        actionable_steps.append("No changes needed. Keep building!")

    return {
        "diagnosis": {
            "primary_issue": primary_issue,
            "confidence": confidence,
            "impact": impact,
            "short_summary": short_summary
        },
        "actionable_steps": actionable_steps
    }