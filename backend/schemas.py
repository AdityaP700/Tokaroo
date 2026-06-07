from typing import List,Optional,Dict,Any
from pydantic import BaseModel, Field, model_validator

class SimulateRequest(BaseModel):
    text: str
    model: str
    decay_power: Optional[float] = Field(default=2.0, ge=0.5, le=5.0)
    recency_strength: Optional[float] = Field(default=0.3, ge=0.0, le=2.0)

class CostEstimate(BaseModel):
    input: float
    output_per_1k: float

class PromptAnalysis(BaseModel):
    utilization_score: float
    overflow_percent: float
    middle_risk: str
    failure_risk: str
    reasons: List[str]

class SimulateResponse(BaseModel):
    model: str
    token_count: int
    context_window: int
    fits: bool
    overflow: int
    visible_tokens: List[int]
    lost_tokens: List[int]
    attention_weights: List[float]
    cost: CostEstimate
    analysis: PromptAnalysis

class CompareRequest(BaseModel):
    text: str

class ModelComparisonResult(BaseModel):
    token_count: int
    context_window: int
    token_to_char_ratio: float
    efficiency_score: float         # char_count / token_count
    est_input_cost: float
    explosion_warning: bool

class CompareResponse(BaseModel):
    text_length_chars: int
    models: Dict[str, ModelComparisonResult]
    recommended_model: str          # Model with the lowest token count
    estimated_cost_multiplier: str

class RagChunkRequest(BaseModel):
    text: str
    model: str
    query: Optional[str] = None
    chunk_size: int
    overlap: int
    budget_percent: Optional[int] = Field(default=None, ge=1, le=100, description="Token budget as a percent of the retrieved context tokens")
    top_k: Optional[int] = Field(default=5, description="Number of chunks retrieved by Vector DB")
    final_k: Optional[int] = Field(default=4, ge=1, description="Number of chunks kept after reranking")
    retrieval_strategy: Optional[str] = Field(default="relevance_sorted", description="'sequential', 'relevance_sorted', or 'rrf_fused'")
    context_placement_strategy: Optional[str] = Field(
        default="reverse",
        description="'relevance', 'reverse', 'random', or 'middle_insert'",
    )
    random_seed: Optional[int] = Field(default=None, description="Seed for random placement strategy")
    query_transformer: Optional[str] = Field(default="baseline", description="'baseline', 'multi_query', or 'hyde'")
    query_variants_max: Optional[int] = Field(default=5, ge=1, le=10, description="Max rewritten queries to emit")
    auto_optimize: Optional[bool] = Field(default=True, description="Enable 2-pass adaptive optimization")
    reranker_enabled: Optional[bool] = Field(default=True, description="Enable cross-encoder reranking")
    relevance_labels: Optional[Dict[int, int]] = Field(
        default=None,
        description="Gold labels by chunk_index. 0 = irrelevant, 1-3 = graded relevance"
    )
    gold_chunk_id: Optional[int] = Field(default=None, description="Chunk index that contains the reference answer")
    answer_chunk_position: Optional[str | int] = Field(
        default=None,
        description="Controlled 1-based prompt position for the gold chunk, or 'first', 'middle', 'last'",
    )
    gold_answer: Optional[str] = Field(default=None, description="Reference answer used for answer-quality scoring")

class RerankerBenchmarkRequest(BaseModel):
    text: str
    model: str
    query_count: Optional[int] = Field(default=10, ge=1, le=50, description="Number of queries to test")
    chunk_size: Optional[int] = Field(default=300, ge=100, description="Chunk size for simulation")
    overlap: Optional[int] = Field(default=50, ge=0, description="Chunk overlap")
    top_k: Optional[int] = Field(default=5, ge=1, description="Top-K for retrieval")
    final_k: Optional[int] = Field(default=4, ge=1, description="Final chunks after reranking")
    retrieval_strategy: Optional[str] = Field(default="relevance_sorted")
    query_transformer: Optional[str] = Field(default="baseline")

class RerankerMetricsResult(BaseModel):
    query: str
    metrics_without_reranker: dict
    metrics_with_reranker: dict
    improvement: dict

class RerankerBenchmarkResponse(BaseModel):
    total_queries_tested: int
    model: str
    strategy: str
    aggregate_metrics: dict
    per_query_results: List[RerankerMetricsResult]
    summary: dict

class BenchmarkRequest(BaseModel):
    queries: List[str]
    text: str
    model: str
    chunk_size: int
    overlap: int
    concurrency_level: Optional[int] = Field(default=10, ge=1, le=100)
    batch_size: Optional[int] = Field(default=8, ge=1, description="Simulate GPU batching size for throughput/latency tradeoff")
    simulate_faults: Optional[bool] = Field(default=False, description="Simulate partial DB failures and reranker timeouts")

class ChunkDetail(BaseModel):
    chunk_index: int
    similarity_score: float      # Fake Vector DB relevance
    dense_rank: Optional[int] = None
    dense_score: Optional[float] = None
    keyword_rank: Optional[int] = None
    keyword_score: Optional[float] = None
    rrf_score: Optional[float] = None
    dense_contribution: Optional[float] = None
    keyword_contribution: Optional[float] = None
    final_rank: Optional[int] = None
    relevance_score: Optional[float] = None
    positional_weight: float     # U-shape curve weight
    attention_weight: Optional[float] = None
    final_importance: float      # Combined metric
    risk_level: str
    used_by_model: Optional[bool] = None
    lost_reason: Optional[str] = None
    start_token: int
    end_token: int
    token_count: int
    boundary_snippet: str


class FinalDiagnosis(BaseModel):
    primary_issue: str
    confidence: float
    impact: str
    short_summary: str


class OptimizationInsight(BaseModel):
    # Keep a primary human-friendly diagnosis for backward compatibility
    diagnosis: FinalDiagnosis
    # New: capture multiple simultaneous issues
    issues: Optional[List[Dict[str, str]]] = None
    # Recommended runtime config to autotune the RAG pipeline
    recommended_config: Optional[Dict[str, int]] = None
    # (Deprecated) single-field chunk size removed — use `recommended_config['chunk_size']` instead
    # Attention curve for visualization (sequence of weights)
    attention_curve: Optional[List[float]] = None
    # Effects of simulating chunk reordering (before/after comparison)
    reorder_effect: Optional[Dict[str, Any]] = None
    # High-level conclusion for the whole RAG system
    system_insight: Optional[str] = None
    actionable_steps: List[str]
    health_score: Optional[int] = None
    is_optimized: Optional[bool] = False


class ClaimResult(BaseModel):
    claim: str = Field(..., description="The individual statement/claim extracted from the answer")
    statement: Optional[str] = Field(None, description="Alias for claim, for backward compatibility")
    supported: bool = Field(..., description="Whether this claim is supported by the context")
    max_similarity: float = Field(0.0, description="Maximum similarity/overlap score found for this claim")
    supporting_chunk_index: Optional[int] = Field(None, description="Index of the chunk that supports this claim")
    support_type: str = Field("none", description="Method of support: 'embedding', 'keyword', or 'none'")

    @model_validator(mode="before")
    @classmethod
    def populate_claim_and_statement(cls, data: Any) -> Any:
        if isinstance(data, dict):
            val = data.get("claim") or data.get("statement")
            if val is not None:
                if "claim" not in data:
                    data["claim"] = val
                if "statement" not in data:
                    data["statement"] = val
        return data

class FaithfulnessResult(BaseModel):
    score: float = Field(0.0, description="Groundedness score: ratio of supported claims")
    supported_claims: int = Field(0, description="Number of supported claims")
    unsupported_claims: int = Field(0, description="Number of unsupported claims")
    failure_type: Optional[str] = Field(None, description="Type of failure: 'none', 'claim_extraction', 'unsupported_claims', etc.")
    claims: List[ClaimResult] = Field(default_factory=list, description="Detailed list of evaluated claims")
    statements: List[ClaimResult] = Field(default_factory=list, description="Alias for claims, for backward compatibility")

    @model_validator(mode="before")
    @classmethod
    def sync_claims_and_statements(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Sync lists of claims and statements
            claims = data.get("claims") or data.get("statements")
            if claims is not None:
                if "claims" not in data:
                    data["claims"] = claims
                if "statements" not in data:
                    data["statements"] = claims
            # Compute supported / unsupported claims if missing
            if claims is not None and ("supported_claims" not in data or "unsupported_claims" not in data):
                supported = sum(1 for c in claims if (isinstance(c, dict) and c.get("supported")) or (hasattr(c, "supported") and c.supported))
                data["supported_claims"] = supported
                data["unsupported_claims"] = len(claims) - supported
        return data

class RootCause(BaseModel):
    retrieval_failure_confidence: float = Field(..., description="Confidence score that the retriever failed to find relevant chunks")
    context_failure_confidence: float = Field(..., description="Confidence score that retrieved chunks were lost or ignored")
    generation_failure_confidence: float = Field(..., description="Confidence score that the model generated unsupported claims despite good context")
    primary_cause: str = Field(..., description="The identified primary cause of failure: 'retrieval_failure', 'context_failure', 'generation_failure', or 'none'")
    root_cause_reason: str = Field(..., description="Detailed description explaining why this failure happened")

class RagChunkResponse(BaseModel):
    model: str
    total_original_tokens: int
    total_chunks_created: int
    chunks_in_prompt: int
    extra_tokens_due_to_overlap: int
    budget_percent: Optional[int] = None
    budget_token_limit: Optional[int] = None
    budget_metrics: Optional[Dict[str, float]] = None
    error: Optional[str] = None
    retrieval_mode: Optional[str] = None
    context_placement_strategy: Optional[str] = None
    query_strategy: Optional[str] = None
    query_variants: Optional[List[str]] = None
    hyde_document: Optional[str] = None
    hyde_length_tokens: Optional[int] = None
    hyde_generated_terms: Optional[List[str]] = None
    variant_retrievals: Optional[List[Dict[str, Any]]] = None
    total_retrieved_chunks: Optional[int] = None
    unique_retrieved_chunks: Optional[int] = None
    retrieval_diversity: Optional[float] = None
    retrieval_overlap: Optional[float] = None
    retrieval_metrics: Optional[Dict[str, float]] = None
    retrieval_metrics_gold: Optional[Dict[str, float]] = None
    reranked: Optional[bool] = None
    rerank_scores: Optional[List[float]] = None
    retrieval_analysis: Optional[Dict[str, float]] = None
    answer_evaluation: Optional[Dict[str, Any]] = None
    faithfulness: Optional[FaithfulnessResult] = None
    root_cause: Optional[RootCause] = None
    ignored_relevant_chunks: Optional[List[int]] = None
    attention_waste: Optional[float] = None
    reranker_impact: Optional[Dict[str, Any]] = None
    retrieval_debug: Optional[List[Dict[str, Any]]] = None
    optimization: OptimizationInsight
    chunks: List[ChunkDetail]
