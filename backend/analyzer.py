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


from context_simulator import calculate_attention_weights


def generate_rag_diagnosis(
    rag_data: dict,
    top_k: int,
    retrieval_strategy: str,
    chunk_size: int | None = None,
) -> dict:
    """
    Evaluates chunking metrics to generate a definitive diagnosis and actionable steps.
    """
    chunks = rag_data.get("chunks", [])
    total_chunks_created = rag_data.get("total_chunks_created", 0)
    chunks_in_prompt = rag_data.get("chunks_in_prompt", 0)
    extra_tokens = rag_data.get("extra_tokens_due_to_overlap", 0)
    chunk_size = chunk_size or rag_data.get("chunk_size", 1) or 1
    overlap_ratio = extra_tokens / max(1, total_chunks_created * chunk_size)

    issues: list[dict] = []
    primary_issue = "optimal"
    impact = "low"
    confidence = 0.95
    short_summary = "RAG pipeline is healthy and context utilization is optimal."
    actionable_steps: list[str] = []

    # Base health score penalties (attention penalty applied later)
    health_score = 100
    health_score -= overlap_ratio * 40
    health_score -= max(0, total_chunks_created - 5) * 5

    # Check 1: Token Redundancy (Highest Priority)
    if overlap_ratio > 0.4:
        issues.append({"type": "high_token_redundancy", "severity": "high"})
        primary_issue = "high_token_redundancy"
        impact = "high"
        confidence = 0.95
        short_summary = "Excessive overlap causing major token duplication."
        actionable_steps.extend([
            "Reduce overlap to 10-20% of chunk size.",
            "Avoid overlapping too many chunks for small inputs."
        ])

    # Check 2: Over-chunking (Too many fragments)
    if total_chunks_created > 10:
        # over-chunking can co-occur with redundancy; append rather than elif
        issues.append({"type": "over_chunking", "severity": "high"})
        if primary_issue == "optimal":
            primary_issue = "over_chunking"
        impact = "high"
        confidence = 0.9
        short_summary = "Too many chunks created for given input size, causing fragmentation."
        actionable_steps.extend([
            "Increase chunk size to reduce fragmentation.",
            "Aim for 3-5 chunks for optimal performance."
        ])

    # Check 3: Context Window Truncation
    if rag_data.get("error") == "context_window_overflow" or (
        total_chunks_created >= top_k and chunks_in_prompt < top_k
    ):
        issues.append({"type": "context_window_overflow", "severity": "critical"})
        primary_issue = "context_window_overflow"
        impact = "critical"
        confidence = 0.99
        if chunks_in_prompt == 0:
            short_summary = "No retrieved chunks fit within the model context window."
        else:
            short_summary = (
                f"Prompt limit exceeded. Vector DB retrieved {top_k} chunks, "
                f"but only {chunks_in_prompt} fit."
            )
        actionable_steps.extend([
            "Reduce the chunk size to fit more unique documents.",
            "Lower the Top-K retrieval limit in your Vector DB.",
            "Upgrade to a model with a larger context window (e.g., Claude 3.5 Sonnet or Gemini 1.5 Pro)."
        ])

    # Check 4: The Lost in the Middle Effect
    # Lost in the middle detection
    low_importance_chunks = [
        c for c in chunks
        if c.get("positional_weight", 0) < 0.3 and c.get("similarity_score", 0) > 0.7
    ]

    if low_importance_chunks:
        issues.append({"type": "lost_in_middle_decay", "severity": "medium"})
        if primary_issue == "optimal":
            primary_issue = "lost_in_middle_decay"
        impact = "high"
        confidence = 0.88
        short_summary = "High-relevance chunks are trapped in the middle of the prompt and will likely be ignored by the LLM."
        actionable_steps.extend([
            "Move critical chunks to the very end of the prompt (leverage recency bias).",
            "Reduce total chunk count to 3-5 to flatten the attention curve.",
            "Use relevance-sorted retrieval rather than sequential insertion."
        ])

    # Check 5: Token Economics / Overlap Waste
    # Secondary check: token economics
    if overlap_ratio > 0.3 and not any(i["type"] == "high_token_redundancy" for i in issues):
        issues.append({"type": "high_token_redundancy", "severity": "medium"})
        if primary_issue == "optimal":
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

    # Recommended config heuristics
    recommended_config: dict = {}
    # If we created many chunks, suggest a larger chunk size
    if total_chunks_created > 10 and rag_data.get("total_original_tokens", 0) > 0:
        recommended_config["chunk_size"] = max(1, int(rag_data["total_original_tokens"] / 3))
    else:
        # default to current chunk size (if provided)
        if chunk_size:
            recommended_config["chunk_size"] = int(chunk_size)

    # overlap recommendation
    if overlap_ratio > 0.3 and chunk_size:
        recommended_config["overlap"] = max(0, int(chunk_size * 0.15))

    # top_k recommendation: keep it bounded
    recommended_config["top_k"] = min(max(1, chunks_in_prompt or 1), 5)

    # Dynamic chunk sizing suggestion
    total_tokens = rag_data.get("total_original_tokens", 0)
    suggested_chunk = None
    if total_tokens > 0:
        if total_tokens < 200:
            suggested_chunk = total_tokens
        elif total_tokens < 1000:
            suggested_chunk = 250
        else:
            suggested_chunk = 500

    # Ensure recommended_config includes the dynamic suggestion if available
    if suggested_chunk is not None:
        recommended_config["chunk_size"] = int(suggested_chunk)

    # attention curve if available
    attention_curve = rag_data.get("attention_curve") or [c.get("positional_weight", 0.0) for c in chunks]

    # NEW: Attention penalty for lost-in-middle issues (balanced penalty)
    if any(i.get("type") == "lost_in_middle_decay" for i in issues):
        health_score -= 15

    # Critical diagnoses should never present as mostly healthy.
    if impact == "critical":
        health_score = min(health_score, 68)

    system_insight = "RAG pipeline is healthy and context utilization is optimal."
    if primary_issue == "context_window_overflow":
        system_insight = "Context overflow is the dominant failure mode: retrieved chunks are being dropped before the model can use them."
    elif primary_issue == "lost_in_middle_decay":
        system_insight = "Low-relevance chunk placement and attention collapse are causing the model to miss important middle chunks."
    elif primary_issue == "high_token_redundancy":
        system_insight = "Overlapping chunks are wasting context budget and reducing the effective signal available to the model."
    elif primary_issue == "over_chunking":
        system_insight = "Too many small chunks are fragmenting the prompt and weakening overall context retention."
    elif primary_issue == "optimal":
        system_insight = "The retrieval and usage pipeline is balanced and the model is seeing the right chunks in the right places."

    health_score = max(0, min(100, int(health_score)))

    # Simulate chunk reordering to see if reordering by relevance (putting most relevant last)
    def simulate_reorder_effect(rag: dict) -> dict:
        orig_chunks = rag.get("chunks", [])
        before_curve = rag.get("attention_curve") or [c.get("positional_weight", 0.0) for c in orig_chunks]

        # create a shallow copy and sort so highest similarity ends up last
        reordered = sorted(orig_chunks, key=lambda x: x.get("similarity_score", 0.0))

        # recompute positional weights for the reordered set
        n = len(reordered)
        if n == 0:
            return {
                "before": before_curve,
                "after": [],
                "lost_in_middle_before": 0,
                "lost_in_middle_after": 0,
                "improves": False,
            }

        after_pos_weights = calculate_attention_weights(list(range(n)), decay_power=2.0, recency_strength=0.5)

        # count lost-in-middle (positional_weight<0.3 and similarity>0.7)
        lost_before = sum(1 for i, c in enumerate(orig_chunks) if (c.get("positional_weight", 0.0) < 0.3 and c.get("similarity_score", 0.0) > 0.7))
        lost_after = sum(1 for i, c in enumerate(reordered) if (after_pos_weights[i] < 0.3 and c.get("similarity_score", 0.0) > 0.7))

        return {
            "before": before_curve,
            "after": [round(w, 4) for w in after_pos_weights],
            "lost_in_middle_before": lost_before,
            "lost_in_middle_after": lost_after,
            "improves": lost_after < lost_before,
        }

    # Skip reorder analysis for small numbers of chunks (ordering won't change positional weights meaningfully)
    if len(chunks) < 5:
        reorder_effect = {
            "skipped": True,
            "reason": "too few chunks to make reordering meaningful",
            "before": attention_curve,
            "after": attention_curve,
            "lost_in_middle_before": sum(1 for c in chunks if (c.get("positional_weight", 0.0) < 0.3 and c.get("similarity_score", 0.0) > 0.7)),
            "lost_in_middle_after": sum(1 for c in chunks if (c.get("positional_weight", 0.0) < 0.3 and c.get("similarity_score", 0.0) > 0.7)),
            "improves": False,
        }
    else:
        reorder_effect = simulate_reorder_effect(rag_data)

    return {
        "diagnosis": {
            "primary_issue": primary_issue,
            "confidence": confidence,
            "impact": impact,
            "short_summary": short_summary
        },
        "issues": issues,
        "actionable_steps": actionable_steps,
        "health_score": health_score,
        "recommended_config": recommended_config,
        "attention_curve": attention_curve,
        "reorder_effect": reorder_effect,
        "system_insight": system_insight,
    }