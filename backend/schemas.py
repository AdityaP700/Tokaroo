from pydantic import BaseModel,Field
from typing import List,Optional,Dict,Any

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
    top_k: Optional[int] = Field(default=5, description="Number of chunks retrieved by Vector DB")
    final_k: Optional[int] = Field(default=4, ge=1, description="Number of chunks kept after reranking")
    retrieval_strategy: Optional[str] = Field(default="relevance_sorted", description="'sequential' or 'relevance_sorted'")
    query_transformer: Optional[str] = Field(default="baseline", description="'baseline' or 'multi_query'")
    query_variants_max: Optional[int] = Field(default=5, ge=1, le=10, description="Max rewritten queries to emit")
    auto_optimize: Optional[bool] = Field(default=True, description="Enable 2-pass adaptive optimization")

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

class RagChunkResponse(BaseModel):
    model: str
    total_original_tokens: int
    total_chunks_created: int
    chunks_in_prompt: int
    extra_tokens_due_to_overlap: int
    error: Optional[str] = None
    retrieval_mode: Optional[str] = None
    query_strategy: Optional[str] = None
    query_variants: Optional[List[str]] = None
    variant_retrievals: Optional[List[Dict[str, Any]]] = None
    total_retrieved_chunks: Optional[int] = None
    unique_retrieved_chunks: Optional[int] = None
    retrieval_diversity: Optional[float] = None
    retrieval_overlap: Optional[float] = None
    reranked: Optional[bool] = None
    rerank_scores: Optional[List[float]] = None
    retrieval_analysis: Optional[Dict[str, float]] = None
    ignored_relevant_chunks: Optional[List[int]] = None
    attention_waste: Optional[float] = None
    reranker_impact: Optional[Dict[str, Any]] = None
    optimization: OptimizationInsight
    chunks: List[ChunkDetail]