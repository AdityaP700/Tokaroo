from fastapi import FastAPI, HTTPException
from schemas import SimulateRequest, SimulateResponse, CostEstimate,CompareRequest, CompareResponse,ModelComparisonResult,RagChunkRequest, RagChunkResponse
from model_config import SUPPORTED_MODELS
from tokenizer_engine import get_tokens
from context_simulator import calculate_attention_weights
from analyzer import analyze_prompt_failure, generate_rag_diagnosis
from typing import Dict
from chunk_simulator import (
    simulate_rag_pipeline as run_rag_simulation,
    _load_default_sentence_embedding_model,
    set_sentence_embedding_model,
)
app = FastAPI(title="Tokaroo API")


@app.on_event("startup")
def load_embedding_model():
    model = _load_default_sentence_embedding_model()
    set_sentence_embedding_model(model)


@app.get("/")
def health_check():
    return {"status": "Tokaroo Backend is live 🦘"}

@app.post("/simulate", response_model=SimulateResponse)
def simulate_context(request: SimulateRequest):
    # 1. Validate the model
    if request.model not in SUPPORTED_MODELS:
        raise HTTPException(status_code=404, detail=f"Model '{request.model}' not supported.")

    config = SUPPORTED_MODELS[request.model]

    # 2. Tokenize the text
    token_ids = get_tokens(request.text, config["tokenizer"])
    token_count = len(token_ids)

    # 3. Context Window Simulation (The Truncation Logic)
    context_window = config["context_window"]
    fits = token_count <= context_window
    overflow = max(0, token_count - context_window)

    if fits:
        visible_tokens = token_ids
        lost_tokens = []
    else:
        # Most models do tail truncation (cut off the beginning)
        # So the model only sees the *most recent* tokens up to the limit
        visible_tokens = token_ids[-context_window:]
        lost_tokens = token_ids[:-context_window]

    # 4. Calculate Costs
    attention_weights = calculate_attention_weights(
        visible_tokens=visible_tokens,
        decay_power=request.decay_power,
        recency_strength=request.recency_strength
    )

    analysis_data = analyze_prompt_failure(
        token_count=token_count,
        context_window=context_window,
        attention_weights=attention_weights
    )
    input_cost = (token_count / 1_000_000) * config["input_price_per_m"]
    return SimulateResponse(
        model=request.model,
        token_count=token_count,
        context_window=context_window,
        fits=fits,
        overflow=overflow,
        visible_tokens=visible_tokens,  # In a real app with huge text, you might want to omit returning full arrays, but fine for MVP
        lost_tokens=lost_tokens,
        attention_weights=attention_weights,
        cost=CostEstimate(
            input=round(input_cost, 6),
            output_per_1k=config["output_price_per_m"] / 1000
        ),
        analysis=analysis_data
    )

@app.post("/compare", response_model=CompareResponse)
def compare_tokenizers(request: CompareRequest):
    text_length = len(request.text)

    if text_length == 0:
        return CompareResponse(
            text_length_chars=0,
            models={},
            recommended_model="none",
            estimated_cost_multiplier="1.0x"
        )

    results: Dict[str, ModelComparisonResult] = {}
    best_model = None
    lowest_tokens = float('inf')

    # Calculate baseline: Standard English is ~4 chars per token
    expected_english_tokens = max(1, text_length / 4)

    for model_name, config in SUPPORTED_MODELS.items():
        token_ids = get_tokens(request.text, config["tokenizer"])
        token_count = len(token_ids)

        ratio = token_count / text_length
        efficiency = text_length / token_count if token_count > 0 else 0
        input_cost = (token_count / 1_000_000) * config["input_price_per_m"]

        # Track the most efficient model for this specific text
        if token_count < lowest_tokens:
            lowest_tokens = token_count
            best_model = model_name

        results[model_name] = ModelComparisonResult(
            token_count=token_count,
            context_window=config["context_window"],
            token_to_char_ratio=round(ratio, 4),
            efficiency_score=round(efficiency, 2),
            est_input_cost=round(input_cost, 6),
            explosion_warning=(ratio > 1.0)
        )

    # Calculate the multiplier based on the best model's performance vs expected English
    multiplier = lowest_tokens / expected_english_tokens

    return CompareResponse(
        text_length_chars=text_length,
        models=results,
        recommended_model=best_model,
        estimated_cost_multiplier=f"{round(multiplier, 1)}x baseline English"
    )

@app.post("/simulate-rag", response_model=RagChunkResponse)
def simulate_rag(request: RagChunkRequest):
    if request.model not in SUPPORTED_MODELS:
        raise HTTPException(status_code=404, detail="Model not supported.")

    config = SUPPORTED_MODELS[request.model]
    token_ids = get_tokens(request.text, config["tokenizer"])

    # Guardrails for bad math
    if request.overlap >= request.chunk_size:
        raise HTTPException(status_code=400, detail="Overlap must be less than chunk size.")

    top_k = request.top_k or 5
    retrieval_strategy = request.retrieval_strategy or "relevance_sorted"

    # Run the chunking simulator
    rag_data = run_rag_simulation(
        token_ids=token_ids,
        chunk_size=request.chunk_size,
        query=request.query or request.text,
        overlap=request.overlap,
        tokenizer_name=config["tokenizer"],
        top_k=top_k,
        final_k=request.final_k,
        retrieval_strategy=retrieval_strategy,
        context_window=config["context_window"],
        original_text=request.text
    )

    # ---------------------------------------------------------
    # FINAL DIAGNOSIS LAYER
    # ---------------------------------------------------------
    insights = generate_rag_diagnosis(rag_data, top_k, retrieval_strategy, request.chunk_size)

    return RagChunkResponse(
        model=request.model,
        total_original_tokens=rag_data["total_original_tokens"],
        total_chunks_created=rag_data["total_chunks_created"],
        chunks_in_prompt=rag_data["chunks_in_prompt"],
        extra_tokens_due_to_overlap=rag_data["extra_tokens_due_to_overlap"],
        error=rag_data.get("error"),
        optimization=insights,
        chunks=rag_data["chunks"]
    )