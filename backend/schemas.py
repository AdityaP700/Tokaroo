from pydantic import BaseModel,Field
from typing import List,Optional,Dict

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