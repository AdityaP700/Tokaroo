from pydantic import BaseModel
from typing import List

class SimulateRequest(BaseModel):
    text: str
    model: str

class CostEstimate(BaseModel):
    input: float
    output_per_1k: float

class SimulateResponse(BaseModel):
    model: str
    token_count: int
    context_window: int
    fits: bool
    overflow: int
    visible_tokens: List[int]
    lost_tokens: List[int]
    cost: CostEstimate