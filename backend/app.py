from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv
from schemas import SimulateRequest, SimulateResponse, CostEstimate,CompareRequest, CompareResponse,ModelComparisonResult,RagChunkRequest, RagChunkResponse, BenchmarkRequest, RerankerBenchmarkRequest, RerankerBenchmarkResponse, RerankerMetricsResult
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


def _response_chunks(chunks: list[dict]) -> list[dict]:
    normalized = []
    for index, chunk in enumerate(chunks, start=1):
        normalized.append(
            {
                "chunk_index": chunk.get("chunk_index", index),
                "similarity_score": chunk.get("similarity_score", 0.0),
                "dense_rank": chunk.get("dense_rank"),
                "dense_score": chunk.get("dense_score"),
                "keyword_rank": chunk.get("keyword_rank"),
                "keyword_score": chunk.get("keyword_score"),
                "rrf_score": chunk.get("rrf_score"),
                "dense_contribution": chunk.get("dense_contribution"),
                "keyword_contribution": chunk.get("keyword_contribution"),
                "final_rank": chunk.get("final_rank"),
                "relevance_score": chunk.get("relevance_score"),
                "positional_weight": chunk.get("positional_weight", 0.0),
                "attention_weight": chunk.get("attention_weight"),
                "final_importance": chunk.get("final_importance", 0.0),
                "risk_level": chunk.get("risk_level", "unknown"),
                "used_by_model": chunk.get("used_by_model"),
                "lost_reason": chunk.get("lost_reason"),
                "start_token": chunk.get("start_token", 0),
                "end_token": chunk.get("end_token", 0),
                "token_count": chunk.get("token_count", 0),
                "boundary_snippet": chunk.get("boundary_snippet", ""),
            }
        )
    return normalized


def _load_env() -> None:
    base_dir = Path(__file__).resolve().parent
    for name in (".env.local", ".env"):
        env_path = base_dir / name
        if env_path.exists():
            load_dotenv(env_path)


_load_env()

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

    if request.overlap >= request.chunk_size:
        raise HTTPException(status_code=400, detail="Overlap must be less than chunk size.")

    top_k = max(request.top_k or 5, request.final_k or 0)
    retrieval_strategy = request.retrieval_strategy or "relevance_sorted"

    # Run the chunking simulator
    rag_data = run_rag_simulation(
        token_ids=token_ids,
        chunk_size=request.chunk_size,
        query=request.query or request.text,
        overlap=request.overlap,
        tokenizer_name=config["tokenizer"],
        top_k=top_k,
        budget_percent=request.budget_percent,
        final_k=request.final_k,
        retrieval_strategy=retrieval_strategy,
        context_window=config["context_window"],
        original_text=request.text,
        query_transformer=request.query_transformer,
        query_variants_max=request.query_variants_max,
        relevance_labels=request.relevance_labels,
        context_placement_strategy=request.context_placement_strategy,
        random_seed=request.random_seed,
        gold_chunk_id=request.gold_chunk_id,
        answer_chunk_position=request.answer_chunk_position,
        gold_answer=request.gold_answer,
        reranker_enabled=request.reranker_enabled,
        generation_mode=request.generation_mode,
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
        new_top_k = max(insights["recommended_config"].get("top_k", top_k), request.final_k or 0)

        # Re-run with optimized parameters
        rag_data = run_rag_simulation(
            token_ids=token_ids,
            chunk_size=new_chunk_size,
            query=request.query or request.text,
            overlap=new_overlap,
            tokenizer_name=config["tokenizer"],
            top_k=new_top_k,
            budget_percent=request.budget_percent,
            final_k=request.final_k,
            retrieval_strategy=retrieval_strategy,
            context_window=config["context_window"],
            original_text=request.text,
            query_transformer=request.query_transformer,
            query_variants_max=request.query_variants_max,
            relevance_labels=request.relevance_labels,
            context_placement_strategy=request.context_placement_strategy,
            random_seed=request.random_seed,
            gold_chunk_id=request.gold_chunk_id,
            answer_chunk_position=request.answer_chunk_position,
            gold_answer=request.gold_answer,
            reranker_enabled=request.reranker_enabled,
            generation_mode=request.generation_mode,
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
        budget_percent=rag_data.get("budget_percent"),
        budget_token_limit=rag_data.get("budget_token_limit"),
        budget_metrics=rag_data.get("budget_metrics"),
        error=rag_data.get("error"),
        retrieval_mode=rag_data.get("retrieval_mode"),
        context_placement_strategy=rag_data.get("context_placement_strategy"),
        query_strategy=rag_data.get("query_strategy"),
        query_variants=rag_data.get("query_variants"),
        hyde_document=rag_data.get("hyde_document"),
        hyde_length_tokens=rag_data.get("hyde_length_tokens"),
        hyde_generated_terms=rag_data.get("hyde_generated_terms"),
        variant_retrievals=rag_data.get("variant_retrievals"),
        total_retrieved_chunks=rag_data.get("total_retrieved_chunks"),
        unique_retrieved_chunks=rag_data.get("unique_retrieved_chunks"),
        retrieval_diversity=rag_data.get("retrieval_diversity"),
        retrieval_overlap=rag_data.get("retrieval_overlap"),
        retrieval_metrics=rag_data.get("retrieval_metrics"),
        retrieval_metrics_gold=rag_data.get("retrieval_metrics_gold"),
        reranked=rag_data.get("reranked"),
        rerank_scores=rag_data.get("rerank_scores"),
        retrieval_analysis=rag_data.get("retrieval_analysis"),
        answer_evaluation=rag_data.get("answer_evaluation"),
        faithfulness=rag_data.get("faithfulness"),
        groundedness=rag_data.get("groundedness"),
        citation_coverage=rag_data.get("citation_coverage"),
        root_cause=rag_data.get("root_cause"),
        ignored_relevant_chunks=rag_data.get("ignored_relevant_chunks"),
        attention_waste=rag_data.get("attention_waste"),
        reranker_impact=rag_data.get("reranker_impact"),
        retrieval_debug=rag_data.get("retrieval_debug"),
        optimization=insights,
        chunks=_response_chunks(rag_data["chunks"])
    )

# =========================================================================
# RERANKER IMPACT BENCHMARK ENDPOINT
# =========================================================================

def _generate_test_queries(text: str, count: int) -> list[str]:
    """Generate synthetic test queries from corpus"""
    # Simple strategy: use sentences/phrases from text as queries
    sentences = text.split('.')[:count]
    queries = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 10]
    return queries[:count]

@app.post("/benchmark-reranker", response_model=RerankerBenchmarkResponse)
def benchmark_reranker_impact(request: RerankerBenchmarkRequest):
    """
    Systematically test reranker impact across multiple queries.
    Measures: MRR, NDCG, Answer Quality, Coverage, Retrieval Gap
    Returns: Aggregate metrics and per-query improvements
    """
    if request.model not in SUPPORTED_MODELS:
        raise HTTPException(status_code=404, detail="Model not supported.")
    
    config = SUPPORTED_MODELS[request.model]
    token_ids = get_tokens(request.text, config["tokenizer"])
    
    # Generate test queries
    test_queries = _generate_test_queries(request.text, request.query_count)
    if not test_queries:
        raise HTTPException(status_code=400, detail="Could not generate test queries from text")
    
    per_query_results = []
    all_metrics_without_reranker = {"mrr": [], "ndcg": [], "answer_quality": [], "coverage": [], "gap": []}
    all_metrics_with_reranker = {"mrr": [], "ndcg": [], "answer_quality": [], "coverage": [], "gap": []}
    
    for query in test_queries:
        # Run without reranker
        result_without = run_rag_simulation(
            token_ids=token_ids,
            chunk_size=request.chunk_size,
            query=query,
            overlap=request.overlap,
            tokenizer_name=config["tokenizer"],
            top_k=request.top_k,
            final_k=request.final_k,
            retrieval_strategy=request.retrieval_strategy,
            context_window=config["context_window"],
            original_text=request.text,
            query_transformer=request.query_transformer,
            reranker_enabled=False,
        )
        
        # Run with reranker
        result_with = run_rag_simulation(
            token_ids=token_ids,
            chunk_size=request.chunk_size,
            query=query,
            overlap=request.overlap,
            tokenizer_name=config["tokenizer"],
            top_k=request.top_k,
            final_k=request.final_k,
            retrieval_strategy=request.retrieval_strategy,
            context_window=config["context_window"],
            original_text=request.text,
            query_transformer=request.query_transformer,
            reranker_enabled=True,
        )
        
        # Extract metrics
        metrics_without = {
            "mrr": result_without.get("retrieval_metrics", {}).get("mrr", 0.0),
            "ndcg": result_without.get("retrieval_metrics", {}).get("ndcg", 0.0),
            "answer_quality": result_without.get("retrieval_analysis", {}).get("answer_quality", 0.0),
            "coverage": result_without.get("retrieval_analysis", {}).get("coverage", 0.0),
            "gap": result_without.get("retrieval_analysis", {}).get("gap", 0.0),
        }
        
        metrics_with = {
            "mrr": result_with.get("retrieval_metrics", {}).get("mrr", 0.0),
            "ndcg": result_with.get("retrieval_metrics", {}).get("ndcg", 0.0),
            "answer_quality": result_with.get("retrieval_analysis", {}).get("answer_quality", 0.0),
            "coverage": result_with.get("retrieval_analysis", {}).get("coverage", 0.0),
            "gap": result_with.get("retrieval_analysis", {}).get("gap", 0.0),
        }
        
        # Calculate improvements
        improvement = {
            "mrr_pct": round(((metrics_with["mrr"] - metrics_without["mrr"]) / (metrics_without["mrr"] + 1e-6)) * 100, 2),
            "ndcg_pct": round(((metrics_with["ndcg"] - metrics_without["ndcg"]) / (metrics_without["ndcg"] + 1e-6)) * 100, 2),
            "answer_quality_pct": round(((metrics_with["answer_quality"] - metrics_without["answer_quality"]) / (metrics_without["answer_quality"] + 1e-6)) * 100, 2),
            "coverage_pct": round(((metrics_with["coverage"] - metrics_without["coverage"]) / (metrics_without["coverage"] + 1e-6)) * 100, 2),
            "gap_reduction_pct": round(((metrics_without["gap"] - metrics_with["gap"]) / (metrics_without["gap"] + 1e-6)) * 100, 2),
        }
        
        # Collect for aggregation
        for key in all_metrics_without_reranker:
            all_metrics_without_reranker[key].append(metrics_without[key])
            all_metrics_with_reranker[key].append(metrics_with[key])
        
        per_query_results.append(
            RerankerMetricsResult(
                query=query,
                metrics_without_reranker=metrics_without,
                metrics_with_reranker=metrics_with,
                improvement=improvement
            )
        )
    
    # Calculate aggregate metrics
    def avg_list(lst):
        return round(sum(lst) / len(lst), 4) if lst else 0.0
    
    aggregate_metrics = {
        "without_reranker": {
            "avg_mrr": avg_list(all_metrics_without_reranker["mrr"]),
            "avg_ndcg": avg_list(all_metrics_without_reranker["ndcg"]),
            "avg_answer_quality": avg_list(all_metrics_without_reranker["answer_quality"]),
            "avg_coverage": avg_list(all_metrics_without_reranker["coverage"]),
            "avg_gap": avg_list(all_metrics_without_reranker["gap"]),
        },
        "with_reranker": {
            "avg_mrr": avg_list(all_metrics_with_reranker["mrr"]),
            "avg_ndcg": avg_list(all_metrics_with_reranker["ndcg"]),
            "avg_answer_quality": avg_list(all_metrics_with_reranker["answer_quality"]),
            "avg_coverage": avg_list(all_metrics_with_reranker["coverage"]),
            "avg_gap": avg_list(all_metrics_with_reranker["gap"]),
        },
    }
    
    # Calculate overall improvements
    summary = {
        "reranking_improved_ndcg_by_pct": round(
            ((aggregate_metrics["with_reranker"]["avg_ndcg"] - aggregate_metrics["without_reranker"]["avg_ndcg"]) / 
             (aggregate_metrics["without_reranker"]["avg_ndcg"] + 1e-6)) * 100, 2
        ),
        "reranking_improved_answer_quality_by_pct": round(
            ((aggregate_metrics["with_reranker"]["avg_answer_quality"] - aggregate_metrics["without_reranker"]["avg_answer_quality"]) / 
             (aggregate_metrics["without_reranker"]["avg_answer_quality"] + 1e-6)) * 100, 2
        ),
        "reranking_reduced_retrieval_gap_by_pct": round(
            ((aggregate_metrics["without_reranker"]["avg_gap"] - aggregate_metrics["with_reranker"]["avg_gap"]) / 
             (aggregate_metrics["without_reranker"]["avg_gap"] + 1e-6)) * 100, 2
        ),
        "improved_mrr_by_pct": round(
            ((aggregate_metrics["with_reranker"]["avg_mrr"] - aggregate_metrics["without_reranker"]["avg_mrr"]) / 
             (aggregate_metrics["without_reranker"]["avg_mrr"] + 1e-6)) * 100, 2
        ),
        "improved_coverage_by_pct": round(
            ((aggregate_metrics["with_reranker"]["avg_coverage"] - aggregate_metrics["without_reranker"]["avg_coverage"]) / 
             (aggregate_metrics["without_reranker"]["avg_coverage"] + 1e-6)) * 100, 2
        ),
    }
    
    return RerankerBenchmarkResponse(
        total_queries_tested=len(test_queries),
        model=request.model,
        strategy=request.retrieval_strategy,
        aggregate_metrics=aggregate_metrics,
        per_query_results=per_query_results,
        summary=summary
    )

# =========================================================================
# ASYNC PIPELINE BENCHMARK (Testing Sync vs Async Fan-out/Fan-in Architecture)
# =========================================================================

import asyncio
import time

async def _mock_db_call(source: str, delay: float, simulate_faults: bool) -> list:
    # Case 1: Partial Failure (Semantic backend timeout)
    if simulate_faults and source == "semantic":
        await asyncio.sleep(1.0)
        raise TimeoutError("Semantic DB unreachable")

    await asyncio.sleep(delay)
    return [{"id": f"{source}_1", "score": 0.8, "source": source}]

def _mock_rerank_batch(chunks: list, batch_size: int) -> list:
    # Throughput vs Latency relationship:
    # More chunks fit in a batch = fewer loops = faster throughput,
    # but actual GPU inference per batch scales.
    num_batches = max(1, len(chunks) // batch_size + (1 if len(chunks) % batch_size else 0))
    time.sleep(0.02 * num_batches) # GPU overhead scaled by batch efficiency
    for c in chunks:
        c['score'] += 0.1
    return chunks

def _mock_diagnostic_batch(chunks: list) -> dict:
    # Diagnostic profiling breakdown
    t0 = time.perf_counter()
    time.sleep(0.01) # semantic eval
    t1 = time.perf_counter()
    time.sleep(0.005) # attention calc
    t2 = time.perf_counter()
    time.sleep(0.005) # risk calc
    t3 = time.perf_counter()
    return {
        "semantic_ms": round((t1 - t0)*1000, 2),
        "attention_ms": round((t2 - t1)*1000, 2),
        "risk_eval_ms": round((t3 - t2)*1000, 2)
    }

async def _process_single_query(retrieval_configs, batch_size: int, simulate_faults: bool):
    stages = {}

    # 1. Retrieval Phase (with safe_call / gather exceptions)
    t0 = time.perf_counter()
    tasks = [_mock_db_call(src, delay, simulate_faults) for src, delay in retrieval_configs]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    chunks = []
    failed_sources = 0
    for r in results:
        if isinstance(r, Exception):
            failed_sources += 1
        else:
            chunks.extend(r)

    # Case 4: Empty Retrieval
    if not chunks:
        stages['error'] = "no_context"

    t1 = time.perf_counter()
    stages['retrieval_ms'] = round((t1 - t0) * 1000, 2)
    stages['failed_sources'] = failed_sources

    # 2. Rerank Phase (with Timeout fallbacks)
    try:
        rerank_task = asyncio.to_thread(_mock_rerank_batch, chunks, batch_size)
        timeout_limit = 0.01 if simulate_faults else 2.0
        await asyncio.wait_for(rerank_task, timeout=timeout_limit)
        stages['rerank_status'] = "success"
    except asyncio.TimeoutError:
        stages['rerank_status'] = "degraded_fallback_used"

    t2 = time.perf_counter()
    stages['rerank_ms'] = round((t2 - t1) * 1000, 2)

    # 3. Diagnostic Phase Sub-timing
    diag_res = await asyncio.to_thread(_mock_diagnostic_batch, chunks)
    t3 = time.perf_counter()
    stages['diagnostic_ms'] = round((t3 - t2) * 1000, 2)
    stages['diagnostic_breakdown'] = diag_res

    stages['total_ms'] = round((t3 - t0) * 1000, 2)
    return stages

@app.post("/benchmark-async")
async def benchmark_async_pipeline(request: BenchmarkRequest):
    """
    Simulates a full scale Sync pipeline vs Async Pipeline overlapping I/O and batching.
    Includes stage-wise breakdowns, concurrency stress testing, failure recovery, and p95 tail latencies.
    """
    retrieval_configs = [("semantic", 0.1), ("lexical", 0.08), ("cache", 0.02)]

    concurrency_level = request.concurrency_level or 10
    batch_size = request.batch_size or 8
    simulate_faults = request.simulate_faults or False

    # Launch concurrent queries mapping to high system load
    tasks = [_process_single_query(retrieval_configs, batch_size, simulate_faults) for _ in range(concurrency_level)]

    start_total = time.perf_counter()
    results = await asyncio.gather(*tasks)
    total_time_ms = (time.perf_counter() - start_total) * 1000

    totals = sorted([r['total_ms'] for r in results])
    retrievals = sorted([r['retrieval_ms'] for r in results])
    reranks = sorted([r['rerank_ms'] for r in results])
    diagnostics = sorted([r['diagnostic_ms'] for r in results])

    def get_p(data, p):
        idx = int((p / 100) * (len(data) - 1))
        return data[idx]

    # Grab the detailed breakdown from the first result as a sample
    sample_diagnostic = results[0].get('diagnostic_breakdown', {})

    return {
        "concurrency_level": concurrency_level,
        "batch_size": batch_size,
        "throughput_req_per_sec": round(concurrency_level / (total_time_ms / 1000), 2),
        "total_test_duration_ms": round(total_time_ms, 2),
        "fault_injection_active": simulate_faults,
        "total_failed_retrieval_sources": sum(r.get('failed_sources', 0) for r in results),
        "timeout_fallbacks_used": sum(1 for r in results if r.get('rerank_status') == "degraded_fallback_used"),
        "stage_breakdown_avg_ms": {
            "retrieval": round(sum(retrievals)/len(retrievals), 2),
            "rerank": round(sum(reranks)/len(reranks), 2),
            "diagnostic_total": round(sum(diagnostics)/len(diagnostics), 2),
            "diagnostic_sub_stages_sample": sample_diagnostic
        },
        "tail_latency_ms": {
            "p50": get_p(totals, 50),
            "p95": get_p(totals, 95),
            "p99": get_p(totals, 99)
        },
        "architecture_insights": "Async retrieval isolates failures preventing total crash; Batching trades per-req latency for raw throughput."
    }
