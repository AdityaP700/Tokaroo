from pydantic import BaseModel,Field
from typing import List,Optional

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