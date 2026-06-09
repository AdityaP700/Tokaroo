from fastapi.testclient import TestClient
import json
from pathlib import Path

from backend import app as app_module
from backend.analyzer import analyze_prompt_failure, generate_rag_diagnosis
from backend.app import app
from backend import chunk_simulator
from backend.chunk_simulator import simulate_rag_pipeline
from backend.model_config import SUPPORTED_MODELS
from backend.tokenizer_engine import get_tokens

client = TestClient(app)

TEST_TEXT = (
    "The KrishiSakha AI system, developed by Karamveer Singh, Divyanshu Sekhar, and Aditya Pat, "
    "utilizes advanced neural networks for agricultural intelligence."
)
LONG_TEXT = " ".join([TEST_TEXT] * 120)
MIXED_CORPUS = (
    "Multi-query retrieval noise happens when rewrites pull unrelated chunks and increase false positives. "
    "Retrieval overlap measures how often different rewrites fetch the same chunks. "
    "Semantic drift occurs when embeddings match loosely related text instead of the target concept. "
    "Cross-encoder reranking can reduce noise but adds latency. "
    "BM25 scoring emphasizes lexical overlap and often helps with precise keywords. "
    "Transformer attention can ignore middle context in long sequences. "
    "RLHF aligns responses but does not fix retrieval failures. "
    "Hallucination papers warn about confident but incorrect generation. "
    "Agentic memory focuses on tool usage history rather than retrieval relevance. "
    "Embeddings compress semantics but can blur rare keywords. "
    "Vector quantization reduces memory but can distort similarity."
)
EXTREME_DISTRACTOR_CORPUS = (
    "Multi-query retrieval overlap and semantic drift are common in noisy pipelines. "
    "Reranking helps mitigate retrieval noise in long-context systems. "
    "Kubernetes clusters require careful resource scheduling and autoscaling. "
    "RLHF aligns responses using preference data but does not fix retrieval recall. "
    "SQL databases optimize joins and indexing strategies for transactional workloads. "
    "CNNs excel at spatial feature extraction for vision tasks. "
    "GPU optimization focuses on memory bandwidth and kernel fusion. "
    "Transformer attention bias can ignore middle context in long sequences."
)
NARROW_BROAD_CORPUS = (
    "Retrieval overlap measures how often different rewrites fetch identical chunks. "
    "Semantic drift occurs when embeddings match related but incorrect content. "
    "Multi-query retrieval can increase recall but also add noise. "
    "Reranking uses cross-encoders to prioritize the most relevant chunks. "
    "Context ordering affects attention and can create lost-in-the-middle failures. "
    "BM25 emphasizes lexical overlap while dense retrieval emphasizes semantics."
)
ADVERSARIAL_CORPUS = (
    "Retrieval overlap happens when multiple query rewrites retrieve the same evidence repeatedly. "
    "retrieval retrieval retrieval retrieval retrieval overlap overlap overlap overlap overlap. "
    "Dense embeddings often map semantically similar queries into nearby vector neighborhoods."
)
ADVERSARIAL_RRF_CORPUS = (
    "Retrieval overlap occurs when semantically similar query rewrites retrieve the same chunks repeatedly. "
    "Dense retrieval embeddings map related queries into nearby vector spaces. "
    "retrieval retrieval retrieval overlap overlap overlap query query query. "
    "Kubernetes scheduling manages container placement. "
    "BM25 scoring relies on lexical overlap and term frequency. "
    "RLHF aligns model behavior but does not improve retrieval."
)
BM25_TRAP_CORPUS = (
    "Retrieval overlap occurs when query rewrites repeatedly fetch the same evidence. "
    "retrieval overlap retrieval overlap retrieval overlap retrieval overlap retrieval overlap. "
    "The actual cause is dense embedding neighborhood collapse and semantic convergence. "
    "Kubernetes retrieval overlap retrieval overlap retrieval overlap."
)

HYDE_DRIFT_CORPUS = (
    "Retrieval overlap occurs because semantically similar queries retrieve the same chunks. "
    "Quantum entanglement allows particles to exhibit correlated states. "
    "Vector databases use approximate nearest neighbor search. "
    "Black holes warp spacetime."
)


def _top_by_rank(chunks: list[dict], rank_key: str) -> dict | None:
    ranked = [chunk for chunk in chunks if chunk.get(rank_key) is not None]
    if not ranked:
        return None
    return min(ranked, key=lambda chunk: chunk[rank_key])


def _case_encoder(case_name: str):
    def _encode(texts):
        if isinstance(texts, str):
            texts = [texts]

        vectors = []
        for text in texts:
            lowered = text.lower()
            if case_name == "dense_should_win":
                if "why does retrieval overlap happen" in lowered:
                    vectors.append([1.0, 0.0])
                elif "semantically similar" in lowered:
                    vectors.append([1.0, 0.0])
                elif "spamword" in lowered:
                    vectors.append([0.0, 1.0])
                else:
                    vectors.append([0.0, 0.0])
            elif case_name == "bm25_should_win":
                if "what is bm25" in lowered:
                    vectors.append([0.0, 1.0])
                elif "bm25 scoring" in lowered:
                    vectors.append([1.0, 0.0])
                elif "dense retrieval uses embeddings" in lowered:
                    vectors.append([0.0, 1.0])
                else:
                    vectors.append([0.0, 0.0])
            elif case_name == "rank_disagreement":
                if "semantic conflict test" in lowered:
                    vectors.append([1.0, 0.0])
                elif "semantic explanation" in lowered:
                    vectors.append([1.0, 0.0])
                elif "spamword" in lowered:
                    vectors.append([0.0, 1.0])
                else:
                    vectors.append([0.0, 0.0])
            elif case_name == "hyde_failure":
                if "attention collapse" in lowered:
                    vectors.append([1.0, 0.0])
                elif "retrieval overlap happens" in lowered:
                    vectors.append([0.0, 1.0])
                else:
                    vectors.append([0.0, 0.0])
            else:
                vectors.append([0.0, 0.0])

        return __import__("numpy").array(vectors, dtype=float)

    return _encode
def test_api_health():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "Tokaroo Backend is live 🦘"}


def test_simulate_endpoint_returns_analysis_and_cost():
    payload = {"text": TEST_TEXT, "model": "claude-sonnet-4-6"}
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["model"] == "claude-sonnet-4-6"
    assert data["fits"] is True
    assert data["overflow"] == 0
    assert data["cost"]["input"] >= 0
    assert data["cost"]["output_per_1k"] > 0
    assert len(data["visible_tokens"]) > 0
    assert len(data["attention_weights"]) == len(data["visible_tokens"])
    assert "failure_risk" in data["analysis"]
    assert isinstance(data["analysis"]["reasons"], list)

    weights = data["attention_weights"]
    assert weights[0] > weights[len(weights) // 2]
    assert weights[-1] > weights[len(weights) // 2]


def test_simulate_endpoint_accepts_model_variants():
    payload = {"text": TEST_TEXT, "model": "llama-3-8b-instruct"}
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["model"] == "llama-3-8b-instruct"
    assert isinstance(data["token_count"], int)
    assert data["context_window"] == SUPPORTED_MODELS["llama-3-8b-instruct"]["context_window"]


def test_simulate_endpoint_rejects_invalid_model():
    response = client.post(
        "/simulate",
        json={"text": "Hello world", "model": "fake-model-123"},
    )
    assert response.status_code == 404


def test_simulate_endpoint_honors_attention_controls():
    payload = {
        "text": "The PayGate decentralized gateway utilizes the L402 protocol on the Base network, engineered by Karamveer Singh, Divyanshu Sekhar, and Aditya Pat.",
        "model": "claude-sonnet-4-6",
        "decay_power": 4.0,
        "recency_strength": 1.0,
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200

    weights = response.json()["attention_weights"]
    mid_idx = len(weights) // 2
    assert weights[-1] > weights[0]
    assert weights[mid_idx] < 0.2


def test_compare_endpoint_handles_empty_text():
    response = client.post("/compare", json={"text": ""})
    assert response.status_code == 200

    data = response.json()
    assert data == {
        "text_length_chars": 0,
        "models": {},
        "recommended_model": "none",
        "estimated_cost_multiplier": "1.0x",
    }


def test_compare_endpoint_selects_best_model_and_returns_all_models():
    response = client.post("/compare", json={"text": TEST_TEXT})
    assert response.status_code == 200

    data = response.json()
    assert data["text_length_chars"] == len(TEST_TEXT)
    assert set(data["models"].keys()) == set(SUPPORTED_MODELS.keys())
    assert data["recommended_model"] in SUPPORTED_MODELS
    assert data["estimated_cost_multiplier"].endswith("baseline English")


def test_analyze_prompt_failure_detects_truncation():
    analysis = analyze_prompt_failure(
        token_count=120,
        context_window=100,
        attention_weights=[1.0, 0.7, 0.2, 0.4, 1.0],
    )

    assert analysis["failure_risk"] == "critical"
    assert analysis["overflow_percent"] > 0.15
    assert any("Truncation" in reason for reason in analysis["reasons"])


def test_analyze_prompt_failure_detects_lost_in_the_middle():
    analysis = analyze_prompt_failure(
        token_count=50,
        context_window=100,
        attention_weights=[1.0, 0.85, 0.25, 0.8, 1.0, 0.95],
    )

    assert analysis["middle_risk"] == "high"
    assert analysis["failure_risk"] in {"medium", "high", "critical"}
    assert any("Lost-in-the-Middle" in reason for reason in analysis["reasons"])


def test_analyze_prompt_failure_returns_healthy_state():
    analysis = analyze_prompt_failure(
        token_count=20,
        context_window=100,
        attention_weights=[1.0, 0.9, 0.7, 0.9, 1.0],
    )

    assert analysis["failure_risk"] == "low"
    assert "optimal" in analysis["reasons"][0].lower()


def test_generate_rag_diagnosis_flags_context_window_overflow():
    rag_data = {
        "total_original_tokens": 1000,
        "total_chunks_created": 8,
        "chunks_in_prompt": 3,
        "extra_tokens_due_to_overlap": 40,
        "chunks": [],
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=5, retrieval_strategy="relevance_sorted")

    assert diagnosis["diagnosis"]["primary_issue"] == "context_window_overflow"
    assert diagnosis["diagnosis"]["impact"] == "critical"
    assert diagnosis["health_score"] < 70
    assert "context overflow" in diagnosis["system_insight"].lower()
    assert len(diagnosis["actionable_steps"]) >= 3


def test_generate_rag_diagnosis_keeps_small_inputs_optimal():
    rag_data = {
        "total_original_tokens": 2,
        "total_chunks_created": 1,
        "chunks_in_prompt": 1,
        "extra_tokens_due_to_overlap": 0,
        "chunks": [
            {
                "chunk_index": 1,
                "similarity_score": 1.0,
                "positional_weight": 1.0,
                "relevance_score": 1.0,
                "attention_weight": 1.0,
                "final_importance": 1.0,
                "risk_level": "safe (high retention)",
                "start_token": 0,
                "end_token": 1,
                "token_count": 2,
                "boundary_snippet": "hi",
                "used_by_model": True
            }
        ],
        "ignored_relevant_chunks": [],
        "attention_waste": 0.0,
        "retrieval_analysis": {"usage_quality": 1.0, "gap": 0.0}
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=3, retrieval_strategy="relevance_sorted", chunk_size=10)

    assert diagnosis["diagnosis"]["primary_issue"] == "optimal"
    assert diagnosis["diagnosis"]["impact"] == "low"
    assert diagnosis["actionable_steps"] == ["No changes needed. Keep building!"]
    assert diagnosis["health_score"] == 100


def test_generate_rag_diagnosis_flags_middle_decay():
    rag_data = {
        "total_original_tokens": 500,
        "total_chunks_created": 3,
        "chunks_in_prompt": 5,
        "extra_tokens_due_to_overlap": 10,
        "chunks": [
            {
                "chunk_index": 1,
                "similarity_score": 0.9,
                "positional_weight": 0.9,
                "relevance_score": 0.9,
                "attention_weight": 0.9,
                "final_importance": 0.81,
                "risk_level": "safe (high retention)",
                "start_token": 0,
                "end_token": 10,
                "token_count": 10,
                "boundary_snippet": "hi",
                "used_by_model": True
            },
            {
                "chunk_index": 2,
                "similarity_score": 0.85,
                "positional_weight": 0.25,
                "relevance_score": 0.85,
                "attention_weight": 0.25,
                "final_importance": 0.21,
                "risk_level": "high_risk (lost in middle)",
                "lost_reason": "lost_in_middle",
                "start_token": 10,
                "end_token": 20,
                "token_count": 10,
                "boundary_snippet": "hi",
                "used_by_model": False
            },
        ],
        "ignored_relevant_chunks": [
            {
                "chunk_index": 2,
                "similarity_score": 0.85,
                "positional_weight": 0.25,
                "relevance_score": 0.85,
                "attention_weight": 0.25,
                "final_importance": 0.21,
                "risk_level": "high_risk (lost in middle)",
                "lost_reason": "lost_in_middle",
                "start_token": 10,
                "end_token": 20,
                "token_count": 10,
                "boundary_snippet": "hi",
                "used_by_model": False
            }
        ],
        "attention_waste": 0.0,
        "retrieval_analysis": {"usage_quality": 0.9, "gap": 0.0}
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=3, retrieval_strategy="relevance_sorted", chunk_size=20)

    assert diagnosis["diagnosis"]["primary_issue"] == "lost_in_middle_decay"
    assert diagnosis["diagnosis"]["impact"] == "high"
    assert any("Move critical chunks" in step for step in diagnosis["actionable_steps"])


def test_generate_rag_diagnosis_flags_token_redundancy():
    rag_data = {
        "total_original_tokens": 100,
        "total_chunks_created": 5,
        "chunks_in_prompt": 5,
        "extra_tokens_due_to_overlap": 60,
        "chunks": [{
            "chunk_index": 1,
            "similarity_score": 0.8,
            "positional_weight": 0.9,
            "relevance_score": 0.8,
            "attention_weight": 0.9,
            "final_importance": 0.72,
            "risk_level": "safe (high retention)",
            "start_token": 0,
            "end_token": 10,
            "token_count": 10,
            "boundary_snippet": "hi",
            "used_by_model": True
        }],
        "ignored_relevant_chunks": [],
        "attention_waste": 0.6,
        "retrieval_analysis": {"usage_quality": 0.8, "gap": 0.0}
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=5, retrieval_strategy="sequential", chunk_size=30)

    assert diagnosis["diagnosis"]["primary_issue"] == "high_token_redundancy"
    assert diagnosis["diagnosis"]["impact"] == "medium"
    assert any("overlap" in step.lower() for step in diagnosis["actionable_steps"])


def test_generate_rag_diagnosis_flags_over_chunking():
    rag_data = {
        "total_original_tokens": 200,
        "total_chunks_created": 11,
        "chunks_in_prompt": 5,
        "extra_tokens_due_to_overlap": 20,
        "chunks": [{
            "chunk_index": 1,
            "similarity_score": 0.8,
            "positional_weight": 0.9,
            "relevance_score": 0.8,
            "attention_weight": 0.9,
            "final_importance": 0.72,
            "risk_level": "safe (high retention)",
            "start_token": 0,
            "end_token": 10,
            "token_count": 10,
            "boundary_snippet": "hi",
            "used_by_model": True
        }],
        "ignored_relevant_chunks": [],
        "attention_waste": 0.0,
        "retrieval_analysis": {"usage_quality": 0.8, "gap": 0.0}
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=5, retrieval_strategy="relevance_sorted", chunk_size=20)

    assert diagnosis["diagnosis"]["primary_issue"] == "over_chunking"
    assert diagnosis["diagnosis"]["impact"] == "high"
    assert diagnosis["health_score"] < 100


def test_simulate_rag_pipeline_marks_single_chunk_safe():
    result = simulate_rag_pipeline(
        token_ids=[1, 2],
        chunk_size=10,
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=3,
        retrieval_strategy="relevance_sorted",
        context_window=100,
    )

    assert result["chunks_in_prompt"] == 1
    assert result["chunks"][0]["risk_level"] == "safe (high retention)"
    assert result["chunks"][0]["similarity_score"] == 1.0


def test_simulate_rag_pipeline_adds_chunk_traceability(monkeypatch):
    def fake_decode_tokens(tokens, tokenizer_name):
        if tokens == [1]:
            return "cats"
        if tokens == [2]:
            return "filler"
        if tokens == [3]:
            return "mid filler"
        if tokens == [4]:
            return "cats again"
        return " ".join(str(token) for token in tokens)

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)

    result = simulate_rag_pipeline(
        token_ids=[1, 2, 3, 4],
        chunk_size=1,
        query="cats",
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=4,
        final_k=4,
        retrieval_strategy="relevance_sorted",
        context_window=100,
        original_text="cats filler mid filler cats again",
    )

    assert len(result["chunks"]) == 4
    assert result["retrieval_mode"] == "hybrid"
    assert result["reranked"] is True
    assert len(result["rerank_scores"]) == 4
    assert result["chunks"][0]["relevance_score"] == result["chunks"][0]["rerank_score"]
    assert result["chunks"][0]["attention_weight"] == result["chunks"][0]["positional_weight"]
    assert result["chunks"][0]["used_by_model"] is True
    assert result["chunks"][1]["lost_reason"] in {"low_relevance", "lost_in_middle", "position_bias"}
    assert result["chunks"][2]["lost_reason"] in {"low_relevance", "lost_in_middle", "position_bias"}
    # New metrics: retrieval vs usage gap, ignored relevant detection, attention waste
    assert "retrieval_analysis" in result
    assert set(result["retrieval_analysis"].keys()) == {"retrieval_quality", "usage_quality", "answer_quality", "coverage", "gap"}
    assert "ignored_relevant_chunks" in result
    assert isinstance(result["ignored_relevant_chunks"], list)
    assert "attention_waste" in result
    assert isinstance(result["attention_waste"], float)
    assert "reranker_impact" in result
    assert set(result["reranker_impact"].keys()) == {"before", "after", "net_effect"}
    assert set(result["reranker_impact"]["before"].keys()) == {"retrieval_quality", "usage_quality", "answer_quality", "coverage", "gap"}
    assert "retrieval_metrics" in result
    assert set(result["retrieval_metrics"].keys()) == {"recall_at_k", "mrr", "hit_rate", "ndcg"}


def test_simulate_rag_pipeline_applies_budget_cap(monkeypatch):
    def fake_decode_tokens(tokens, tokenizer_name):
        if tokens == [1]:
            return "cats"
        if tokens == [2]:
            return "filler"
        if tokens == [3]:
            return "mid filler"
        if tokens == [4]:
            return "cats again"
        return " ".join(str(token) for token in tokens)

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)

    result = simulate_rag_pipeline(
        token_ids=[1, 2, 3, 4],
        chunk_size=1,
        query="cats",
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=4,
        final_k=4,
        retrieval_strategy="relevance_sorted",
        context_window=2,
        budget_percent=50,
        original_text="cats filler mid filler cats again",
    )

    assert result["budget_percent"] == 50
    assert result["budget_token_limit"] == 2
    assert result["chunks_in_prompt"] == 2
    assert result["budget_metrics"]["budget_percent"] == 50.0
    assert result["budget_metrics"]["selected_chunk_count"] == 2.0
    assert result["budget_metrics"]["selected_token_count"] == 2.0
    assert "quality_per_token" in result["budget_metrics"]
    assert 0.0 <= result["budget_metrics"]["coverage"] <= 1.0


def test_simulate_rag_pipeline_reports_gold_metrics(monkeypatch):
    def fake_decode_tokens(tokens, tokenizer_name):
        if tokens == [1]:
            return "cats"
        if tokens == [2]:
            return "filler"
        if tokens == [3]:
            return "mid filler"
        if tokens == [4]:
            return "cats again"
        return " ".join(str(token) for token in tokens)

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)

    result = simulate_rag_pipeline(
        token_ids=[1, 2, 3, 4],
        chunk_size=1,
        query="cats",
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=1,
        final_k=1,
        retrieval_strategy="relevance_sorted",
        context_window=100,
        original_text="cats filler mid filler cats again",
        relevance_labels={4: 3},
    )

    assert "retrieval_metrics_gold" in result
    assert set(result["retrieval_metrics_gold"].keys()) == {"recall_at_k", "mrr", "hit_rate", "ndcg"}
    assert result["retrieval_metrics"]["recall_at_k"] != result["retrieval_metrics_gold"]["recall_at_k"]


def test_simulate_rag_pipeline_multiple_gold_chunk_ids(monkeypatch):
    def fake_decode_tokens(tokens, tokenizer_name):
        if tokens == [1]:
            return "cats"
        if tokens == [2]:
            return "filler"
        if tokens == [3]:
            return "mid filler"
        if tokens == [4]:
            return "cats again"
        return " ".join(str(token) for token in tokens)

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)

    result = simulate_rag_pipeline(
        token_ids=[1, 2, 3, 4],
        chunk_size=1,
        query="cats",
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=2,
        final_k=2,
        retrieval_strategy="relevance_sorted",
        context_window=100,
        original_text="cats filler mid filler cats again",
        gold_chunk_ids=[1, 4],
        answer_chunk_position="first",
        gold_answer="cats",
    )

    assert "answer_evaluation" in result
    ae = result["answer_evaluation"]
    assert ae["gold_chunk_ids"] == [1, 4]
    assert ae["gold_chunk_in_prompt"] is True


def test_simulate_rag_pipeline_uses_gold_fixture(monkeypatch):
    def fake_decode_tokens(tokens, tokenizer_name):
        if tokens == [1]:
            return "retrieval overlap explanation"
        if tokens == [2]:
            return "semantic drift explanation"
        if tokens == [3]:
            return "dense retrieval details"
        if tokens == [4]:
            return "bm25 explanation"
        if tokens == [5]:
            return "dense retrieval vs bm25"
        if tokens == [6]:
            return "attention ignores middle"
        if tokens == [7]:
            return "reranking details"
        if tokens == [8]:
            return "long context middle issues"
        if tokens == [9]:
            return "rare keywords blur"
        if tokens == [10]:
            return "embeddings blur rare terms"
        if tokens == [11]:
            return "vector quantization similarity"
        return "filler"

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)

    fixture_path = Path(__file__).resolve().parent / "fixtures" / "gold_retrieval_benchmark.json"
    with fixture_path.open("r", encoding="utf-8") as handle:
        benchmark = json.load(handle)

    for case in benchmark:
        result = simulate_rag_pipeline(
            token_ids=list(range(1, 12)),
            chunk_size=1,
            query=case["query"],
            overlap=0,
            tokenizer_name="cl100k_base",
            top_k=4,
            final_k=4,
            retrieval_strategy="relevance_sorted",
            context_window=100,
            original_text="filler",
            relevance_labels=case["relevant_chunks"],
        )

        assert result.get("retrieval_metrics_gold") is not None


def test_simulate_rag_pipeline_reports_query_diversity_metrics():
    token_ids = get_tokens(MIXED_CORPUS, SUPPORTED_MODELS["gpt-4o"]["tokenizer"])

    result = simulate_rag_pipeline(
        token_ids=token_ids,
        chunk_size=40,
        query="Why does retrieval overlap happen in multi-query systems?",
        overlap=5,
        tokenizer_name=SUPPORTED_MODELS["gpt-4o"]["tokenizer"],
        top_k=4,
        final_k=4,
        retrieval_strategy="relevance_sorted",
        context_window=SUPPORTED_MODELS["gpt-4o"]["context_window"],
        original_text=MIXED_CORPUS,
        query_transformer="multi_query",
        query_variants_max=6,
    )

    assert isinstance(result.get("variant_retrievals"), list)
    assert result["variant_retrievals"]
    assert result["total_retrieved_chunks"] >= result["unique_retrieved_chunks"]
    assert 0.0 <= result["retrieval_diversity"] <= 1.0
    assert 0.0 <= result["retrieval_overlap"] <= 1.0


def test_simulate_rag_pipeline_supports_rrf_fused():
    token_ids = get_tokens(MIXED_CORPUS, SUPPORTED_MODELS["gpt-4o"]["tokenizer"])

    result = simulate_rag_pipeline(
        token_ids=token_ids,
        chunk_size=40,
        query="Why does retrieval overlap happen in multi-query systems?",
        overlap=5,
        tokenizer_name=SUPPORTED_MODELS["gpt-4o"]["tokenizer"],
        top_k=4,
        final_k=4,
        retrieval_strategy="rrf_fused",
        context_window=SUPPORTED_MODELS["gpt-4o"]["context_window"],
        original_text=MIXED_CORPUS,
        query_transformer="multi_query",
        query_variants_max=6,
    )

    assert result["retrieval_mode"] == "rrf_fused"
    assert result["total_retrieved_chunks"] >= result["unique_retrieved_chunks"]


def test_simulate_rag_pipeline_exposes_rrf_observability():
    token_ids = get_tokens(ADVERSARIAL_CORPUS, SUPPORTED_MODELS["gpt-4o"]["tokenizer"])

    result = simulate_rag_pipeline(
        token_ids=token_ids,
        chunk_size=30,
        query="Why does retrieval overlap happen?",
        overlap=5,
        tokenizer_name=SUPPORTED_MODELS["gpt-4o"]["tokenizer"],
        top_k=4,
        final_k=4,
        retrieval_strategy="rrf_fused",
        context_window=SUPPORTED_MODELS["gpt-4o"]["context_window"],
        original_text=ADVERSARIAL_CORPUS,
    )

    chunk = result["retrieval_debug"][0]
    assert chunk.get("dense_rank") is not None
    assert chunk.get("keyword_rank") is not None
    assert chunk.get("rrf_score") is not None
    assert chunk.get("final_rank") is not None
    if chunk.get("dense_contribution") is not None and chunk.get("keyword_contribution") is not None:
        rrf_sum = round(chunk["dense_contribution"] + chunk["keyword_contribution"], 6)
        assert abs(rrf_sum - chunk["rrf_score"]) <= 0.000001


def test_simulate_rag_pipeline_reports_gold_metrics_for_rrf():
    token_ids = get_tokens(ADVERSARIAL_CORPUS, SUPPORTED_MODELS["gpt-4o"]["tokenizer"])

    result = simulate_rag_pipeline(
        token_ids=token_ids,
        chunk_size=30,
        query="Why does retrieval overlap happen?",
        overlap=5,
        tokenizer_name=SUPPORTED_MODELS["gpt-4o"]["tokenizer"],
        top_k=3,
        final_k=3,
        retrieval_strategy="rrf_fused",
        context_window=SUPPORTED_MODELS["gpt-4o"]["context_window"],
        original_text=ADVERSARIAL_CORPUS,
        relevance_labels={1: 3, 2: 0, 3: 1},
    )

    assert result.get("retrieval_metrics_gold") is not None
    assert set(result["retrieval_metrics_gold"].keys()) == {"recall_at_k", "mrr", "hit_rate", "ndcg"}


def test_benchmark_suite_cases(monkeypatch):
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "benchmark_suite.json"
    with fixture_path.open("r", encoding="utf-8") as handle:
        suite = json.load(handle)

    original_transform_query = chunk_simulator.transform_query

    for case in suite:
        chunk_texts = {i + 1: text for i, text in enumerate(case["chunks"])}

        def fake_decode_tokens(tokens, tokenizer_name, chunk_texts=chunk_texts):
            if not tokens:
                return ""
            return chunk_texts.get(tokens[0], "")

        monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)
        monkeypatch.setattr(chunk_simulator, "_encode_texts", _case_encoder(case["name"]))

        if case.get("query_transformer") == "hyde":
            class Variant:
                def __init__(self, text: str):
                    self.text = text

            def fake_transform_query(query, strategy, max_variants):
                return [Variant(case["hyde_document"])]

            monkeypatch.setattr(chunk_simulator, "transform_query", fake_transform_query)
        else:
            monkeypatch.setattr(chunk_simulator, "transform_query", original_transform_query)

        result = simulate_rag_pipeline(
            token_ids=list(range(1, len(case["chunks"]) + 1)),
            chunk_size=1,
            query=case["query"],
            overlap=0,
            tokenizer_name="cl100k_base",
            top_k=case.get("top_k", len(case["chunks"])),
            final_k=case.get("final_k", case.get("top_k", len(case["chunks"]))),
            retrieval_strategy="rrf_fused",
            context_window=200,
            original_text=" ".join(case["chunks"]),
            query_transformer=case.get("query_transformer", "baseline"),
            query_variants_max=1,
            relevance_labels=case.get("labels"),
        )

        debug_chunks = result.get("retrieval_debug") or []
        dense_top = _top_by_rank(debug_chunks, "dense_rank")
        keyword_top = _top_by_rank(debug_chunks, "keyword_rank")

        assert dense_top is not None
        assert keyword_top is not None
        assert dense_top["chunk_index"] == case["expected"]["dense_top"]
        assert keyword_top["chunk_index"] == case["expected"]["keyword_top"]

        if case["name"] == "hyde_failure":
            assert result["retrieval_metrics_gold"]["recall_at_k"] == 0.0


def test_simulate_rag_pipeline_rrf_adversarial_disagreement(monkeypatch):
    chunk_texts = {
        1: "Retrieval overlap occurs when semantically similar query rewrites retrieve the same chunks repeatedly.",
        2: "Dense retrieval embeddings map related queries into nearby vector spaces.",
        3: "retrieval retrieval retrieval overlap overlap overlap query query query spamword.",
        4: "Kubernetes scheduling manages container placement.",
        5: "BM25 scoring relies on lexical overlap and term frequency.",
        6: "RLHF aligns model behavior but does not improve retrieval.",
    }

    def fake_decode_tokens(tokens, tokenizer_name):
        if not tokens:
            return ""
        return chunk_texts.get(tokens[0], "")

    def fake_encode_texts(texts):
        if isinstance(texts, str):
            texts = [texts]

        vectors = []
        for text in texts:
            lowered = text.lower()
            if "retrieval overlap occurs" in lowered:
                vectors.append([1.0, 0.0])
            elif "dense retrieval embeddings" in lowered:
                vectors.append([0.9, 0.1])
            elif "retrieval retrieval retrieval" in lowered:
                vectors.append([0.0, 1.0])
            elif "kubernetes" in lowered:
                vectors.append([0.1, 0.0])
            elif "bm25 scoring" in lowered:
                vectors.append([0.2, 0.0])
            elif "rlhf" in lowered:
                vectors.append([0.0, 0.1])
            else:
                vectors.append([0.0, 0.0])

        return __import__("numpy").array(vectors, dtype=float)

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)
    monkeypatch.setattr(chunk_simulator, "_encode_texts", fake_encode_texts)

    result = simulate_rag_pipeline(
        token_ids=[1, 2, 3, 4, 5, 6],
        chunk_size=1,
        query="Why does retrieval overlap happen spamword?",
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=6,
        final_k=6,
        retrieval_strategy="rrf_fused",
        context_window=200,
        original_text=ADVERSARIAL_RRF_CORPUS,
    )

    spam_chunk = next(chunk for chunk in result["retrieval_debug"] if chunk.get("chunk_index") == 3)
    semantic_chunk = next(chunk for chunk in result["retrieval_debug"] if chunk.get("chunk_index") == 1)

    assert spam_chunk.get("keyword_rank") == 1
    assert semantic_chunk.get("dense_rank") == 1


def test_simulate_rag_pipeline_handles_extreme_distractors():
    token_ids = get_tokens(EXTREME_DISTRACTOR_CORPUS, SUPPORTED_MODELS["gpt-4o"]["tokenizer"])

    result = simulate_rag_pipeline(
        token_ids=token_ids,
        chunk_size=36,
        query="Why does retrieval overlap happen in multi-query systems?",
        overlap=6,
        tokenizer_name=SUPPORTED_MODELS["gpt-4o"]["tokenizer"],
        top_k=4,
        final_k=4,
        retrieval_strategy="relevance_sorted",
        context_window=SUPPORTED_MODELS["gpt-4o"]["context_window"],
        original_text=EXTREME_DISTRACTOR_CORPUS,
        query_transformer="multi_query",
        query_variants_max=6,
    )

    assert isinstance(result.get("variant_retrievals"), list)
    assert result["variant_retrievals"]
    assert result["total_retrieved_chunks"] >= result["unique_retrieved_chunks"]


def test_simulate_rag_pipeline_compares_narrow_vs_broad_queries():
    token_ids = get_tokens(NARROW_BROAD_CORPUS, SUPPORTED_MODELS["gpt-4o"]["tokenizer"])

    narrow = simulate_rag_pipeline(
        token_ids=token_ids,
        chunk_size=40,
        query="retrieval overlap in multi-query systems",
        overlap=6,
        tokenizer_name=SUPPORTED_MODELS["gpt-4o"]["tokenizer"],
        top_k=4,
        final_k=4,
        retrieval_strategy="relevance_sorted",
        context_window=SUPPORTED_MODELS["gpt-4o"]["context_window"],
        original_text=NARROW_BROAD_CORPUS,
        query_transformer="multi_query",
        query_variants_max=6,
    )

    broad = simulate_rag_pipeline(
        token_ids=token_ids,
        chunk_size=40,
        query="how do long context systems fail with retrieval and attention",
        overlap=6,
        tokenizer_name=SUPPORTED_MODELS["gpt-4o"]["tokenizer"],
        top_k=4,
        final_k=4,
        retrieval_strategy="relevance_sorted",
        context_window=SUPPORTED_MODELS["gpt-4o"]["context_window"],
        original_text=NARROW_BROAD_CORPUS,
        query_transformer="multi_query",
        query_variants_max=6,
    )

    assert 0.0 <= narrow["retrieval_diversity"] <= 1.0
    assert 0.0 <= broad["retrieval_diversity"] <= 1.0
    assert narrow["total_retrieved_chunks"] >= narrow["unique_retrieved_chunks"]
    assert broad["total_retrieved_chunks"] >= broad["unique_retrieved_chunks"]


def test_simulate_rag_pipeline_flags_used_but_low_relevance_chunk_as_position_bias(monkeypatch):
    def fake_decode_tokens(tokens, tokenizer_name):
        return "unrelated text"

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)

    result = simulate_rag_pipeline(
        token_ids=[1],
        chunk_size=1,
        query="cats",
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=1,
        final_k=1,
        retrieval_strategy="relevance_sorted",
        context_window=100,
        original_text="unrelated text",
    )

    assert result["chunks"][0]["used_by_model"] is True
    assert result["chunks"][0]["attention_weight"] == 1.0
    assert result["chunks"][0]["similarity_score"] < 0.4
    assert result["chunks"][0]["lost_reason"] == "noise_attended"
    assert result["chunks"][0]["risk_level"] == "high_risk (position_bias)"


def test_simulate_rag_endpoint_returns_structured_optimization(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "run_rag_simulation",
        lambda **kwargs: {
            "total_original_tokens": 120,
            "total_chunks_created": 4,
            "chunks_in_prompt": 4,
            "extra_tokens_due_to_overlap": 20,
            "budget_percent": 50,
            "budget_token_limit": 64,
            "budget_metrics": {
                "budget_percent": 50.0,
                "budget_token_limit": 64.0,
                "selected_chunk_count": 4.0,
                "selected_token_count": 120.0,
                "retrieval_quality": 0.91,
                "answer_quality": 0.9,
                "coverage": 0.8,
            },
            "retrieval_mode": "hybrid",
            "reranked": True,
            "rerank_scores": [0.91],
            "retrieval_analysis": {"retrieval_quality": 0.91, "usage_quality": 0.91, "answer_quality": 0.91, "coverage": 0.8, "gap": 0.0},
            "ignored_relevant_chunks": [],
            "attention_waste": 0.0,
            "chunks": [
                {
                    "chunk_index": 1,
                    "similarity_score": 0.91,
                    "positional_weight": 1.0,
                    "final_importance": 0.91,
                    "risk_level": "safe (high retention)",
                    "start_token": 0,
                    "end_token": 30,
                    "token_count": 30,
                    "boundary_snippet": "alpha ... beta",
                }
            ],
        },
    )

    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 32,
            "overlap": 8,
            "top_k": 4,
            "retrieval_strategy": "relevance_sorted",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["model"] == "claude-sonnet-4-6"
    assert data["optimization"]["diagnosis"]["primary_issue"] == "optimal"
    assert "No changes needed" in data["optimization"]["actionable_steps"][0]
    assert "system_insight" in data["optimization"]
    assert data["retrieval_mode"] == "hybrid"
    assert data["reranked"] is True
    assert isinstance(data["rerank_scores"], list)
    assert data["budget_percent"] == 50
    assert data["budget_token_limit"] == 64
    assert data["budget_metrics"]["coverage"] == 0.8
    assert "retrieval_analysis" in data
    assert "ignored_relevant_chunks" in data
    assert "attention_waste" in data
    assert len(data["chunks"]) == 1


def test_simulate_rag_endpoint_returns_structured_overflow(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "run_rag_simulation",
        lambda **kwargs: {
            "total_original_tokens": 500,
            "total_chunks_created": 6,
            "chunks_in_prompt": 0,
            "extra_tokens_due_to_overlap": 30,
            "chunks": [],
            "error": "context_window_overflow",
        },
    )

    response = client.post(
        "/simulate-rag",
        json={
            "text": LONG_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 5,
            "overlap": 2,
            "top_k": 7,
            "final_k": 5,
            "context_window": 50,
            "retrieval_strategy": "relevance_sorted",
            "query": "find specific content",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["error"] == "context_window_overflow"
    assert data["optimization"]["diagnosis"]["primary_issue"] == "context_window_overflow"


def test_simulate_rag_endpoint_rejects_invalid_overlap():
    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 32,
            "overlap": 32,
        },
    )

    assert response.status_code == 400
    assert "Overlap must be less than chunk size" in response.json()["detail"]


def test_simulate_rag_endpoint_rejects_no_fit_result(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "run_rag_simulation",
        lambda **kwargs: {
            "total_original_tokens": 12,
            "total_chunks_created": 1,
            "chunks_in_prompt": 0,
            "extra_tokens_due_to_overlap": 0,
            "chunks": [],
            "error": "context_window_overflow",
        },
    )

    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 32,
            "overlap": 8,
        },
    )

    assert response.status_code == 200
    assert response.json()["error"] == "context_window_overflow"


def test_simulate_rag_endpoint_defaults_optional_fields(monkeypatch):
    captured = {}

    def fake_run_rag_simulation(**kwargs):
        captured.update(kwargs)
        return {
            "total_original_tokens": 50,
            "total_chunks_created": 2,
            "chunks_in_prompt": 2,
            "extra_tokens_due_to_overlap": 5,
            "chunks": [],
        }

    monkeypatch.setattr(app_module, "run_rag_simulation", fake_run_rag_simulation)

    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 20,
            "overlap": 4,
        },
    )

    assert response.status_code == 200
    assert captured["top_k"] == 5
    assert captured["retrieval_strategy"] == "relevance_sorted"


def test_simulate_rag_pipeline_reranks_with_query(monkeypatch):
    class DummyModel:
        def encode(self, texts, convert_to_numpy=True, normalize_embeddings=True):
            if isinstance(texts, str):
                texts = [texts]

            vectors = []
            for text in texts:
                lowered = text.lower()
                if "cats" in lowered:
                    vectors.append([1.0, 0.0])
                elif "dogs" in lowered:
                    vectors.append([0.0, 1.0])
                else:
                    vectors.append([0.5, 0.5])

            return __import__("numpy").array(vectors, dtype=float)

    monkeypatch.setattr(chunk_simulator, "_get_sentence_embedding_model", lambda: DummyModel())

    def fake_decode_tokens(tokens, tokenizer_name):
        if tokens == [1, 2]:
            return "cats"
        if tokens == [3, 4]:
            return "dogs"
        return ""

    monkeypatch.setattr(chunk_simulator, "decode_tokens", fake_decode_tokens)

    result = simulate_rag_pipeline(
        token_ids=[1, 2, 3, 4],
        chunk_size=2,
        query="cats",
        overlap=0,
        tokenizer_name="cl100k_base",
        top_k=2,
        final_k=1,
        retrieval_strategy="relevance_sorted",
        context_window=100,
        original_text="cats dogs",
    )

    assert result["chunks_in_prompt"] == 1
    assert result["chunks"][0]["similarity_score"] >= 0.9


def test_simulate_rag_endpoint_accepts_query_and_final_k(monkeypatch):
    captured = {}

    def fake_run_rag_simulation(**kwargs):
        captured.update(kwargs)
        return {
            "total_original_tokens": 50,
            "total_chunks_created": 2,
            "chunks_in_prompt": 1,
            "extra_tokens_due_to_overlap": 5,
            "chunks": [],
            "attention_curve": [],
        }

    monkeypatch.setattr(app_module, "run_rag_simulation", fake_run_rag_simulation)

    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "query": "agricultural intelligence",
            "model": "claude-sonnet-4-6",
            "chunk_size": 20,
            "overlap": 4,
            "top_k": 6,
            "final_k": 2,
        },
    )

    assert response.status_code == 200
    assert captured["query"] == "agricultural intelligence"
    assert captured["final_k"] == 2


def test_reorder_simulation_reduces_lost_in_middle(monkeypatch):
    # Config B scenario: 4 chunks, high similarity, middle attention collapse
    monkeypatch.setattr(
        app_module,
        "run_rag_simulation",
        lambda **kwargs: {
            "total_original_tokens": 424,
            "total_chunks_created": 4,
            "chunks_in_prompt": 4,
            "extra_tokens_due_to_overlap": 36,
            "chunks": [
                {"similarity_score": 0.99, "positional_weight": 0.5},
                {"similarity_score": 0.98, "positional_weight": 0.119},
                {"similarity_score": 0.97, "positional_weight": 0.154},
                {"similarity_score": 1.0, "positional_weight": 1.0},
            ],
            "attention_curve": [0.5, 0.119, 0.154, 1.0],
        },
    )

    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 106,
            "overlap": 12,
            "top_k": 4,
            "retrieval_strategy": "relevance_sorted",
        },
    )

    assert response.status_code == 200
    data = response.json()
    reorder = data["optimization"].get("reorder_effect")
    assert reorder is not None
    assert reorder["lost_in_middle_before"] >= reorder["lost_in_middle_after"]
    assert isinstance(reorder["after"], list)
    # health score should include attention penalty (be < 100)
    assert data["optimization"]["health_score"] < 100


def test_compute_faithfulness_basics():
    from backend.core.retrieval.metrics import compute_faithfulness

    context = [
        {"chunk_index": 1, "decoded_text": "The Capital of France is Paris. Paris is a very beautiful city."},
        {"chunk_index": 2, "decoded_text": "The Eiffel Tower was built in 1889."}
    ]

    # Test 1: Completely faithful (100%)
    res_1 = compute_faithfulness(
        answer="Paris is the Capital of France. The Eiffel Tower was built in 1889.",
        context_chunks=context,
        encode_fn=None,  # Forces keyword fallback
    )
    assert res_1["score"] == 1.0
    assert len(res_1["statements"]) == 2
    assert res_1["statements"][0]["supported"] is True
    assert res_1["statements"][0]["supporting_chunk_index"] == 1
    assert res_1["statements"][1]["supported"] is True
    assert res_1["statements"][1]["supporting_chunk_index"] == 2

    # Test 2: Partially faithful (50%)
    res_2 = compute_faithfulness(
        answer="Paris is the Capital of France. Berlin is the Capital of Germany.",
        context_chunks=context,
        encode_fn=None,
    )
    assert res_2["score"] == 0.5
    assert res_2["statements"][0]["supported"] is True
    assert res_2["statements"][1]["supported"] is False
    assert res_2["statements"][1]["supporting_chunk_index"] is None

    # Test 3: Completely unfaithful (0%)
    res_3 = compute_faithfulness(
        answer="Madrid is the Capital of Spain.",
        context_chunks=context,
        encode_fn=None,
    )
    assert res_3["score"] == 0.0
    assert res_3["statements"][0]["supported"] is False


def test_simulate_rag_returns_faithfulness(monkeypatch):
    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 40,
            "overlap": 5,
            "top_k": 3,
            "retrieval_strategy": "relevance_sorted",
            "gold_answer": "The KrishiSakha AI system was developed by Karamveer Singh.",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "faithfulness" in data
    assert data["faithfulness"]["score"] > 0.0
    assert len(data["faithfulness"]["statements"]) > 0


def test_faithfulness_impacts_health_score(monkeypatch):
    # Mock simulation data with extremely low faithfulness (0.0)
    monkeypatch.setattr(
        app_module,
        "run_rag_simulation",
        lambda **kwargs: {
            "total_original_tokens": 100,
            "total_chunks_created": 3,
            "chunks_in_prompt": 3,
            "extra_tokens_due_to_overlap": 10,
            "chunks": [
                {"chunk_index": 1, "decoded_text": "Wheat grows in winter.", "relevance_score": 0.9, "positional_weight": 0.9},
                {"chunk_index": 2, "decoded_text": "Rice grows in summer.", "relevance_score": 0.8, "positional_weight": 0.8},
            ],
            "attention_curve": [0.9, 0.8],
            "faithfulness": {
                "score": 0.0,
                "statements": [
                    {
                        "statement": "The capital of Japan is Tokyo.",
                        "supported": False,
                        "max_similarity": 0.1,
                        "supporting_chunk_index": None,
                        "support_type": "none",
                    }
                ],
                "generated_answer": "The capital of Japan is Tokyo."
            }
        },
    )

    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 50,
            "overlap": 5,
            "top_k": 2,
            "retrieval_strategy": "relevance_sorted",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["optimization"]["diagnosis"]["primary_issue"] == "low_faithfulness_hallucination"
    # Low faithfulness must trigger health score deduction (100 - 30 penalty = 70 max, plus other penalties or override to <= 68/80)
    assert data["optimization"]["health_score"] <= 70
    assert any("low faithfulness" in step.lower() or "hallucination" in step.lower() for step in data["optimization"]["actionable_steps"])


def test_root_cause_analysis_rag_simulation():
    response = client.post(
        "/simulate-rag",
        json={
            "text": TEST_TEXT,
            "model": "claude-sonnet-4-6",
            "chunk_size": 10,
            "overlap": 2,
            "top_k": 3,
            "retrieval_strategy": "relevance_sorted",
            "gold_answer": "This is a dummy gold answer that will fail faithfulness.",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "root_cause" in data
    rc = data["root_cause"]
    assert "retrieval_failure_confidence" in rc
    assert "context_failure_confidence" in rc
    assert "generation_failure_confidence" in rc
    assert "primary_cause" in rc
    assert "root_cause_reason" in rc
    assert isinstance(rc["primary_cause"], str)

    assert "groundedness" in data
    g = data["groundedness"]
    assert "groundedness_score" in g
    assert "claims" in g
    assert isinstance(g["claims"], list)
    if g["claims"]:
        c = g["claims"][0]
        assert "claim" in c
        assert "grounded" in c
        assert "chunk_index" in c
        assert "evidence" in c
        assert "evidence_similarity" in c
        
    assert "citation_coverage" in data
    cc = data["citation_coverage"]
    assert "coverage_score" in cc
    assert "claims_with_citations" in cc
    assert "total_claims" in cc
