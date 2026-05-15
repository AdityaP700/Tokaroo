from fastapi.testclient import TestClient

import app as app_module
from analyzer import analyze_prompt_failure, generate_rag_diagnosis
from app import app
from model_config import SUPPORTED_MODELS

client = TestClient(app)

TEST_TEXT = (
    "The KrishiSakha AI system, developed by Karamveer Singh, Divyanshu Sekhar, and Aditya Pat, "
    "utilizes advanced neural networks for agricultural intelligence."
)
LONG_TEXT = " ".join([TEST_TEXT] * 120)


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
        "chunks_in_prompt": 3,
        "extra_tokens_due_to_overlap": 40,
        "chunks": [],
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=5, retrieval_strategy="relevance_sorted")

    assert diagnosis["diagnosis"]["primary_issue"] == "context_window_overflow"
    assert diagnosis["diagnosis"]["impact"] == "critical"
    assert len(diagnosis["actionable_steps"]) >= 3


def test_generate_rag_diagnosis_flags_middle_decay():
    rag_data = {
        "total_original_tokens": 500,
        "chunks_in_prompt": 5,
        "extra_tokens_due_to_overlap": 10,
        "chunks": [
            {"risk_level": "safe (high retention)"},
            {"risk_level": "critical (low position + low relevance)"},
        ],
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=3, retrieval_strategy="relevance_sorted")

    assert diagnosis["diagnosis"]["primary_issue"] == "lost_in_middle_decay"
    assert diagnosis["diagnosis"]["impact"] == "high"
    assert any("Move critical chunks" in step for step in diagnosis["actionable_steps"])


def test_generate_rag_diagnosis_flags_token_redundancy():
    rag_data = {
        "total_original_tokens": 100,
        "chunks_in_prompt": 5,
        "extra_tokens_due_to_overlap": 60,
        "chunks": [{"risk_level": "safe (high retention)"}],
    }

    diagnosis = generate_rag_diagnosis(rag_data, top_k=5, retrieval_strategy="sequential")

    assert diagnosis["diagnosis"]["primary_issue"] == "high_token_redundancy"
    assert diagnosis["diagnosis"]["impact"] == "medium"
    assert any("overlap" in step.lower() for step in diagnosis["actionable_steps"])


def test_simulate_rag_endpoint_returns_structured_optimization(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "run_rag_simulation",
        lambda **kwargs: {
            "total_original_tokens": 120,
            "total_chunks_created": 4,
            "chunks_in_prompt": 4,
            "extra_tokens_due_to_overlap": 20,
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
    assert len(data["chunks"]) == 1


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
        lambda **kwargs: {"error": "No chunks fit in context window."},
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

    assert response.status_code == 400
    assert response.json()["detail"] == "No chunks fit in context window."


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
