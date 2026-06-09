def _compute_root_cause_analysis(
    all_chunks: list[dict],
    valid_chunks: list[dict],
    retrieved_chunks: list[dict],
    ignored_relevant_chunks: list,
    retrieval_analysis: dict,
    faithfulness: dict,
) -> dict:
    # 1. Retrieval Failure Confidence (Z-score based & relative to baseline)
    scores = [c.get("rerank_score", c.get("similarity_score", 0.0)) for c in all_chunks]
    max_relevance = max(scores, default=0.0)
    
    if len(scores) > 1:
        mean_val = sum(scores) / len(scores)
        std_val = max(0.01, (sum((x - mean_val) ** 2 for x in scores) / len(scores)) ** 0.5)
        z_score = (max_relevance - mean_val) / std_val
        retrieval_failure_confidence = round(max(0.0, min(1.0, (2.0 - z_score) / 1.5)), 3)
    else:
        retrieval_failure_confidence = round(max(0.0, min(1.0, (0.7 - max_relevance) / 0.35)), 3)

    # 2. Context Failure Confidence (Adaptive relevance threshold)
    retrieved_scores = [c.get("rerank_score", c.get("similarity_score", 0.0)) for c in retrieved_chunks]
    retrieved_avg = sum(retrieved_scores) / len(retrieved_scores) if retrieved_scores else 0.0
    global_relevance_thresh = max(0.3, retrieved_avg * 0.8)
    
    retrieved_relevant = [c for c in retrieved_chunks if c.get("rerank_score", c.get("similarity_score", 0.0)) >= global_relevance_thresh]
    valid_chunk_indices = {c.get("chunk_index") for c in valid_chunks}
    dropped_relevant = [c for c in retrieved_relevant if c.get("chunk_index") not in valid_chunk_indices]

    dropped_rel_ratio = len(dropped_relevant) / max(1, len(retrieved_relevant)) if retrieved_relevant else 0.0
    ignored_rel_ratio = len(ignored_relevant_chunks) / max(1, len(valid_chunks)) if valid_chunks else 0.0
    usage_gap = retrieval_analysis.get("gap", 0.0)

    base_context_failure = max(dropped_rel_ratio, ignored_rel_ratio, usage_gap * 2.0)
    context_failure_confidence = round(max(0.0, min(1.0, base_context_failure)) * (1.0 - retrieval_failure_confidence), 3)

    # 3. Generation Failure Confidence
    faithfulness_score = faithfulness.get("score", 1.0) if faithfulness else 1.0
    generation_failure_confidence = round(1.0 - faithfulness_score, 3)

    # 4. Primary Cause and Reason
    confidences = {
        "retrieval_failure": retrieval_failure_confidence,
        "context_failure": context_failure_confidence,
        "generation_failure": generation_failure_confidence,
    }
    max_conf = max(confidences.values())

    coverage = retrieval_analysis.get("coverage", 0.0)

    if max_conf < 0.20:
        primary_cause = "none"
        root_cause_reason = "No significant failure detected. Pipeline is operating optimally."
    else:
        if coverage == 0.0:
            if retrieval_failure_confidence > 0.5 or not retrieved_chunks:
                primary_cause = "retrieval_failure"
            else:
                primary_cause = "context_failure"
        else:
            primary_cause = max(confidences, key=confidences.get)

        if primary_cause == "retrieval_failure":
            root_cause_reason = f"All retrieved chunks lack semantic relevance to the query (max relevance score: {max_relevance:.2f})."
        elif primary_cause == "context_failure":
            if dropped_relevant:
                root_cause_reason = f"Relevant chunks were retrieved but dropped due to context window limits or token budgeting ({len(dropped_relevant)} dropped)."
            elif ignored_relevant_chunks:
                root_cause_reason = f"Relevant chunks were placed in the prompt but ignored due to low attention weights / positional decay ({len(ignored_relevant_chunks)} ignored)."
            else:
                root_cause_reason = f"Suboptimal context integration detected: high utilization gap ({usage_gap:.2f}) or attention waste."
        else:
            unsupported_claims = faithfulness.get("unsupported_claims", 0)
            root_cause_reason = f"Grounded context was successfully provided, but the model generated {unsupported_claims} unsupported claims (faithfulness: {faithfulness_score:.0%})."

    # Construct evidence
    evidence = {
        "dropped_relevant_chunks": len(dropped_relevant),
        "ignored_chunks": len(ignored_relevant_chunks),
        "usage_gap": round(usage_gap, 3),
        "max_relevance": round(max_relevance, 3),
        "global_relevance_thresh": round(global_relevance_thresh, 3)
    }

    return {
        "retrieval_failure_confidence": retrieval_failure_confidence,
        "context_failure_confidence": context_failure_confidence,
        "generation_failure_confidence": generation_failure_confidence,
        "primary_cause": primary_cause,
        "root_cause_reason": root_cause_reason,
        "evidence": evidence,
    }
