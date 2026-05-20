from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import SimulateRequest, SimulateResponse, CostEstimate,CompareRequest, CompareResponse,ModelComparisonResult,RagChunkRequest, RagChunkResponse
from model_config import SUPPORTED_MODELS
from tokenizer_engine import get_tokens
from context_simulator import calculate_attention_weights
from analyzer import analyze_prompt_failure, generate_rag_diagnosis
from typing import Dict, Any
from chunk_simulator import (
    simulate_rag_pipeline as run_rag_simulation,
    _load_default_sentence_embedding_model,
    _load_default_cross_encoder_reranker,
    set_sentence_embedding_model,
    set_cross_encoder_reranker,
)
app = FastAPI(title="Tokaroo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def load_embedding_model():
    model = _load_default_sentence_embedding_model()
    set_sentence_embedding_model(model)
    reranker = _load_default_cross_encoder_reranker()
    set_cross_encoder_reranker(reranker)


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
        request.overlap = int(request.chunk_size * 0.2)

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

    # ---------------------------------------------------------
    # ADAPTIVE OPTIMIZATION (2-PASS)
    # ---------------------------------------------------------
    if request.auto_optimize and insights["health_score"] < 85:
        
        new_chunk_size = insights["recommended_config"].get("chunk_size", request.chunk_size)
        new_overlap = insights["recommended_config"].get("overlap", request.overlap)
        new_top_k = insights["recommended_config"].get("top_k", top_k)

        # Re-run with optimized parameters
        rag_data = run_rag_simulation(
            token_ids=token_ids,
            chunk_size=new_chunk_size,
            query=request.query or request.text,
            overlap=new_overlap,
            tokenizer_name=config["tokenizer"],
            top_k=new_top_k,
            final_k=request.final_k,
            retrieval_strategy=retrieval_strategy,
            context_window=config["context_window"],
            original_text=request.text
        )
        # Re-analyze with the new data
        insights = generate_rag_diagnosis(rag_data, new_top_k, retrieval_strategy, new_chunk_size)
        insights["is_optimized"] = True

    return RagChunkResponse(
        model=request.model,
        total_original_tokens=rag_data["total_original_tokens"],
        total_chunks_created=rag_data["total_chunks_created"],
        chunks_in_prompt=rag_data["chunks_in_prompt"],
        extra_tokens_due_to_overlap=rag_data["extra_tokens_due_to_overlap"],
        error=rag_data.get("error"),
        retrieval_mode=rag_data.get("retrieval_mode"),
        reranked=rag_data.get("reranked"),
        rerank_scores=rag_data.get("rerank_scores"),
        retrieval_analysis=rag_data.get("retrieval_analysis"),
        ignored_relevant_chunks=rag_data.get("ignored_relevant_chunks"),
        attention_waste=rag_data.get("attention_waste"),
        reranker_impact=rag_data.get("reranker_impact"),
        optimization=insights,
        chunks=rag_data["chunks"]
    )

# =========================================================================
# ASYNC PIPELINE BENCHMARK (Testing Sync vs Async Fan-out/Fan-in Architecture)
# =========================================================================

import asyncio
import time

async def _mock_db_call(source: str, delay: float) -> list:
    await asyncio.sleep(delay)
    return [{"id": f"{source}_1", "score": 0.8, "source": source}]

def _mock_rerank_batch(chunks: list) -> list:
    time.sleep(0.15) # GPU overhead for batch
    for c in chunks: 
        c['score'] += 0.1
    return chunks

def _mock_rerank_sequential(chunk: dict) -> dict:
    time.sleep(0.1) # Overhead per chunk
    chunk['score'] += 0.1
    return chunk

@app.get("/benchmark-async")
async def benchmark_async_pipeline():
    """
    Simulates a full scale Sync pipeline vs Async Pipeline overlapping I/O and batching.
    Used to prove architectural value of asyncio.gather() and ThreadPools.
    """
    retrieval_configs = [("semantic", 0.2), ("lexical", 0.15), ("cache", 0.05)]
    
    # 1. SEQUENTIAL (Bad)
    start_sync = time.perf_counter()
    sync_chunks = []
    # I/O sequentially
    for src, delay in retrieval_configs:
        sync_chunks.extend(await _mock_db_call(src, delay))
    # CPU sequentially (inference)
    sync_reranked = [_mock_rerank_sequential(c) for c in sync_chunks]
    sync_latency = time.perf_counter() - start_sync
    
    # 2. ASYNC (Good)
    start_async = time.perf_counter()
    # I/O Parallel
    tasks = [_mock_db_call(src, delay) for src, delay in retrieval_configs]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    async_chunks = []
    for r in results:
        if not isinstance(r, Exception): async_chunks.extend(r)
        
    # CPU Batched + Overlapped (Using to_thread to avoid blocking async loop)
    async_rerank_task = asyncio.to_thread(_mock_rerank_batch, async_chunks)
    async_reranked = await async_rerank_task
    async_latency = time.perf_counter() - start_async
    
    return {
        "sync_latency_ms": round(sync_latency * 1000, 2),
        "async_latency_ms": round(async_latency * 1000, 2),
        "speedup_factor": round(sync_latency / async_latency, 2),
        "architecture": {
            "sync": "Retrievals stacked sequentially, CPU inference chunk-by-chunk",
            "async": "Retrievals parallelized in gather(), CPU inference batched externally"
        }
    }
