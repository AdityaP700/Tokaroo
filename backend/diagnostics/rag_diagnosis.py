try:
    from core.attention import calculate_attention_weights
except ModuleNotFoundError:
    from backend.core.attention import calculate_attention_weights


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
    overlap_ratio = extra_tokens / max(1, rag_data.get("total_original_tokens", 1))

    retrieval_analysis = rag_data.get("retrieval_analysis", {})
    usage_gap = retrieval_analysis.get("gap", 0.0)
    attention_waste = rag_data.get("attention_waste", 0.0)

    issues: list[dict] = []
    primary_issue = "optimal"
    impact = "low"
    confidence = 0.95
    short_summary = "RAG pipeline is healthy and context utilization is optimal."
    actionable_steps: list[str] = []
    recommended_config: dict = {}

    # Base health score penalties (attention penalty applied later)
    health_score = 100
    health_score -= overlap_ratio * 40
    health_score -= max(0, total_chunks_created - 5) * 5

    # Check 1: Token Redundancy (Highest Priority)
    if overlap_ratio > 0.4:
        issues.append({"type": "high_token_redundancy", "severity": "high"})
        impact = "medium"
        confidence = 0.95
        short_summary = "Excessive overlap causing major token duplication."
        actionable_steps.extend(
            [
                "Reduce overlap to 10-20% of chunk size.",
                "Avoid overlapping too many chunks for small inputs.",
            ]
        )
    if overlap_ratio > 0.5:
        recommended_config["overlap"] = max(0, int(chunk_size * 0.1))

    # Check 2: Over-chunking (Too many fragments)
    if total_chunks_created > 10:
        # over-chunking can co-occur with redundancy; append rather than elif
        issues.append({"type": "over_chunking", "severity": "high"})
        impact = "high"
        confidence = 0.9
        short_summary = "Too many chunks created for given input size, causing fragmentation."
        actionable_steps.extend(
            [
                "Increase chunk size to reduce fragmentation.",
                "Aim for 3-5 chunks for optimal performance.",
            ]
        )

    high_relevance_chunks = [c for c in chunks if c.get("relevance_score", 0.0) > 0.5]
    if len(high_relevance_chunks) >= 2:
        spread = max(c["chunk_index"] for c in high_relevance_chunks) - min(
            c["chunk_index"] for c in high_relevance_chunks
        )

        if spread > 1:
            issues.append({"type": "semantic_fragmentation", "severity": "high"})
    # Check 3: Context Window Truncation
    # FIX: Only trigger on explicit error or when chunks were actually dropped
    if (
        rag_data.get("error") == "context_window_overflow"
        or (chunks and chunks_in_prompt < len(chunks))
        or (not chunks and total_chunks_created > chunks_in_prompt)
    ):
        issues.append({"type": "context_window_overflow", "severity": "critical"})
        impact = "critical"
        confidence = 0.99
        if chunks_in_prompt == 0:
            short_summary = "No retrieved chunks fit within the model context window."
        else:
            short_summary = (
                f"Prompt limit exceeded. Vector DB retrieved {top_k} chunks, "
                f"but only {chunks_in_prompt} fit."
            )
        actionable_steps.extend(
            [
                "Reduce the chunk size to fit more unique documents.",
                "Lower the Top-K retrieval limit in your Vector DB.",
                "Upgrade to a model with a larger context window (e.g., Claude 3.5 Sonnet or Gemini 1.5 Pro).",
            ]
        )

    relevance_scores = [c.get("relevance_score", c.get("similarity_score", 0.0)) for c in chunks]
    max_relevance = max(relevance_scores, default=0.0)
    avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.0
    # FIX: Adaptive threshold based on corpus quality instead of static 0.6
    relevant_threshold = max(0.3, avg_relevance * 0.8)
    relevant_chunks = [
        c for c in chunks if c.get("relevance_score", c.get("similarity_score", 0.0)) > relevant_threshold
    ]
    lost_relevant_chunks = [c for c in relevant_chunks if not c.get("used_by_model", True)]
    ignored_relevant = rag_data.get("ignored_relevant_chunks", [])
    lost_relevant = bool(lost_relevant_chunks) or bool(ignored_relevant)

    # Check 4: The Lost in the Middle Effect
    # Lost in the middle detection
    low_importance_chunks = [
        c
        for c in chunks
        if c.get("positional_weight", 0) < 0.3
        and c.get("relevance_score", c.get("similarity_score", 0.0)) > relevant_threshold
    ]

    if low_importance_chunks or lost_relevant:
        issues.append({"type": "lost_in_middle_decay", "severity": "medium"})
        impact = "high"
        confidence = 0.88
        short_summary = "Relevant chunks are ignored due to positional decay, while less relevant chunks dominate due to recency bias."
        actionable_steps.extend(
            [
                "Move critical chunks to the very end of the prompt (leverage recency bias).",
                "Reduce total chunk count to 3-5 to flatten the attention curve.",
                "Use relevance-sorted retrieval rather than sequential insertion.",
            ]
        )

    # Check 5: Token Economics / Overlap Waste
    # Secondary check: token economics
    if overlap_ratio > 0.3 and not any(i["type"] == "high_token_redundancy" for i in issues):
        issues.append({"type": "high_token_redundancy", "severity": "medium"})
        impact = "medium"
        confidence = 0.92
        short_summary = f"You are paying for {extra_tokens} duplicate tokens due to excessive chunk overlap."
        actionable_steps.extend(
            [
                "Lower chunk overlap to 10-15% of your total chunk size.",
                "Implement semantic chunking instead of blind character/token counts.",
            ]
        )

    # Check 6: No Relevant Context
    # If all retrieved chunks lack semantic relevance, the system is fundamentally missing the answer.
    low_relevance_all = bool(chunks) and max_relevance < relevant_threshold and avg_relevance < 0.3
    if low_relevance_all:
        issues.append({"type": "no_relevant_context", "severity": "critical"})
        impact = "high"
        confidence = 0.95
        short_summary = "All retrieved chunks have low semantic relevance to the query"
        actionable_steps.extend(
            [
                "Review query generation or embedding strategy.",
                "Ensure vector DB contains domain-relevant data.",
            ]
        )

    # Check 7: Noisy Retrieval / Sub-optimal integration
    if usage_gap > 0.1 or attention_waste > 0.2:
        issues.append({"type": "suboptimal_integration", "severity": "medium"})
        impact = "medium"
        confidence = 0.9
        short_summary = "Signal is not fully optimized. High attention waste or gap in retrieval utilization."
        actionable_steps.extend(
            [
                "Improve retrieval ranking.",
                "Apply explicit prompt context chunk reordering.",
            ]
        )

    # FIX: Noise detection with ratio-based measurement instead of just boolean
    noise_chunks = [c for c in chunks if c.get("lost_reason") == "noise_attended"]
    noise_ratio = len(noise_chunks) / len(chunks) if chunks else 0.0
    if noise_ratio > 0.25:
        issues.append({"type": "noisy_context_usage", "severity": "high"})
        impact = "high"
        confidence = 0.90
        short_summary = (
            f"Noise ratio {noise_ratio:.0%}: irrelevant chunks are being heavily attended to, posing a high hallucination risk."
        )
    elif noise_chunks:
        # Still flag it but at lower severity if ratio is small
        issues.append({"type": "noisy_context_usage", "severity": "medium"})
        impact = "medium"
        confidence = 0.85
        short_summary = "Minor noise detected: some irrelevant chunks are receiving attention."

    # Check 8: Semantic Mismatch / False Positive Grounding
    semantic_mismatch = [
        c
        for c in chunks
        if c.get("relevance_score", c.get("similarity_score", 0.0)) > 0.8
        and c.get("keyword_score") is not None
        and c.get("keyword_score", 0.0) < 0.4
    ]
    if semantic_mismatch:
        issues.append({"type": "semantic_mismatch", "severity": "high"})
        impact = "high"
        confidence = 0.92
        short_summary = "Retrieved chunks have high semantic scores but low lexical grounding (model may hallucinate relevance)."
        actionable_steps.extend(
            [
                "Apply a hybrid grounding score (semantic + lexical).",
                "Filter chunks with high semantic trust but <40% keyword coverage.",
            ]
        )

    # Check 9: False Positive Retrieval
    # FIX: Correct logic — model trusts it (used_by_model) but lexical grounding is weak
    false_positives = [
        c
        for c in chunks
        if c.get("relevance_score", 0.0) > 0.7
        and c.get("keyword_score") is not None
        and c.get("keyword_score", 0.0) < 0.2
        and c.get("used_by_model") is True
    ]
    if false_positives:
        issues.append({"type": "false_positive_retrieval", "severity": "high"})
        impact = "high"
        confidence = 0.90
        short_summary = "High relevance chunks are taking up attention despite low lexical grounding, risking confident hallucinations."
        actionable_steps.extend(
            [
                "Ensure chunks actually contain the entity/topic words before letting them influence the context.",
            ]
        )

    # Check 10: Low Diversity Retrieval (Elite Signal)
    if chunks and len(chunks) >= 3:
        unique_scores = set(c.get("relevance_score", 0.0) for c in chunks)
        if len(unique_scores) <= 2:
            issues.append({"type": "low_diversity_retrieval", "severity": "medium"})
            impact = "medium"
            short_summary = "Retrieved chunks share nearly identical relevance scores, indicating a narrow semantic search space."
            actionable_steps.extend(
                [
                    "Consider increasing vector search distance or enabling hybrid keyword variation searches.",
                ]
            )

    # Success Case
    if not actionable_steps and primary_issue == "optimal" and usage_gap < 0.05 and attention_waste < 0.2:
        actionable_steps.append("No changes needed. Keep building!")
    elif not actionable_steps:
        actionable_steps.extend(
            [
                "Reduce Top-K retrieval to avoid introducing irrelevant chunks.",
                "Improve reranking to filter low-relevance chunks before prompt construction.",
                "Apply relevance thresholding before including chunks in context.",
                "Consider hybrid retrieval with stronger semantic filtering.",
            ]
        )

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

    if total_tokens <= 100:
        suggested_chunk = 50

    elif total_tokens <= 300:
        suggested_chunk = total_tokens // 3

    elif total_tokens <= 1000:
        suggested_chunk = 150
    else:
        suggested_chunk = 250

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

    if any(c.get("lost_reason") == "noise_attended" for c in chunks):
        health_score = min(health_score, 80)

    # ---- FINAL PRIORITY RESOLUTION (SINGLE SOURCE OF TRUTH) ----
    # All primary_issue assignments above have been removed.
    # This is the ONLY place where primary_issue gets decided.
    priority_order = [
        "context_window_overflow",
        "no_relevant_context",
        "high_token_redundancy",
        "over_chunking",
        "semantic_fragmentation",
        "lost_in_middle_decay",
        "noisy_context_usage",
        "semantic_mismatch",
        "false_positive_retrieval",
        "weak_query_match",
        "low_diversity_retrieval",
        "suboptimal_integration",
    ]

    detected = set(i["type"] for i in issues)

    for p in priority_order:
        if p in detected:
            primary_issue = p
            break

    system_insight = "RAG pipeline is healthy and context utilization is optimal."
    if primary_issue == "context_window_overflow":
        system_insight = "Context overflow is the dominant failure mode: retrieved chunks are being dropped before the model can use them."
    elif primary_issue == "lost_in_middle_decay":
        system_insight = "Low-relevance chunk placement and attention collapse are causing the model to miss important middle chunks."
    elif primary_issue == "high_token_redundancy":
        system_insight = "Excessive overlap is wasting tokens and reducing effective context signal."
    elif primary_issue == "over_chunking":
        system_insight = "Too many small chunks fragmented the context, causing important information to be ignored."
    elif primary_issue == "noisy_context_usage":
        system_insight = "Context quality issues detected: model is attending to suboptimal or irrelevant chunks."
    elif primary_issue == "noisy_retrieval":
        system_insight = "Context quality issues detected: model is attending to suboptimal or irrelevant chunks."
    elif primary_issue == "optimal":
        system_insight = "The retrieval and usage pipeline is balanced and the model is seeing the right chunks in the right places."
    elif primary_issue == "semantic_fragmentation":
        system_insight = "Relevant information is split across chunks, weakening retrieval effectiveness."
    else:
        system_insight = "Context quality issues detected: pipeline is failing to utilize extracted knowledge effectively."

    health_score = max(20, min(100, int(health_score)))

    # Simulate chunk reordering to see if reordering by relevance (putting most relevant last)
    def simulate_reorder_effect(rag: dict) -> dict:
        orig_chunks = rag.get("chunks", [])
        before_curve = rag.get("attention_curve") or [c.get("positional_weight", 0.0) for c in orig_chunks]

        # create a shallow copy and sort so highest similarity ends up last
        reordered = sorted(orig_chunks, key=lambda x: x.get("relevance_score", x.get("similarity_score", 0.0)))

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
        lost_before = sum(
            1
            for i, c in enumerate(orig_chunks)
            if (c.get("positional_weight", 0.0) < 0.3 and c.get("similarity_score", 0.0) > 0.7)
        )
        lost_after = sum(
            1
            for i, c in enumerate(reordered)
            if (after_pos_weights[i] < 0.3 and c.get("similarity_score", 0.0) > 0.7)
        )

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
            "lost_in_middle_before": sum(
                1 for c in chunks if (c.get("positional_weight", 0.0) < 0.3 and c.get("similarity_score", 0.0) > 0.7)
            ),
            "lost_in_middle_after": sum(
                1 for c in chunks if (c.get("positional_weight", 0.0) < 0.3 and c.get("similarity_score", 0.0) > 0.7)
            ),
            "improves": False,
        }
    else:
        reorder_effect = simulate_reorder_effect(rag_data)

    # 🚨 FINAL OVERRIDE: Ensure short_summary matches the primary_issue resolved above
    # Since checks run sequentially and can overwrite local variables,
    # we enforce exact explanation mapping for critical errors.
    if primary_issue == "no_relevant_context":
        short_summary = "No relevant context found: all retrieved chunks have low semantic alignment with the query."
        impact = "high"

    return {
        "diagnosis": {"primary_issue": primary_issue, "confidence": confidence, "impact": impact, "short_summary": short_summary},
        "issues": issues,
        "actionable_steps": actionable_steps,
        "health_score": health_score,
        "recommended_config": recommended_config,
        "attention_curve": attention_curve,
        "reorder_effect": reorder_effect,
        "system_insight": system_insight,
    }
