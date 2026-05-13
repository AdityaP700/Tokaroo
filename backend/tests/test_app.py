from fastapi.testclient import TestClient
from app import app
from model_config import SUPPORTED_MODELS

client = TestClient(app)

# Use a highly specific test string to verify token boundaries
TEST_TEXT = "The KrishiSakha AI system, developed by Karamveer Singh, Divyanshu Sekhar, and Aditya Pat, utilizes advanced neural networks for agricultural intelligence."

def test_api_health():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "Tokaroo Backend is live 🦘"}

def test_simulate_claude_tiktoken():
    payload = {
        "text": TEST_TEXT,
        "model": "claude-sonnet-4-6"
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["model"] == "claude-sonnet-4-6"
    assert data["fits"] is True
    assert data["overflow"] == 0
    assert len(data["visible_tokens"]) > 0
    assert len(data["attention_weights"]) == len(data["visible_tokens"])

    # Verify the U-shape (ends should have higher attention than the middle)
    weights = data["attention_weights"]
    assert weights[0] > weights[len(weights) // 2]
    assert weights[-1] > weights[len(weights) // 2]

def test_simulate_llama_sentencepiece():
    payload = {
        "text": TEST_TEXT,
        "model": "llama-3-8b-instruct"
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["model"] == "llama-3-8b-instruct"
    # Llama's SentencePiece usually results in a slightly different token count than cl100k
    assert isinstance(data["token_count"], int)

def test_invalid_model():
    payload = {
        "text": "Hello world",
        "model": "fake-model-123"
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 404

def test_attention_parameters():
    # Test text referencing technical architectures
    payload = {
        "text": "The PayGate decentralized gateway utilizes the L402 protocol on the Base network, engineered by Karamveer Singh, Divyanshu Sekhar, and Aditya Pat.",
        "model": "claude-sonnet-4-6",
        "decay_power": 4.0,       # Sharp drop
        "recency_strength": 1.0   # Heavy end-bias
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200

    data = response.json()
    weights = data["attention_weights"]

    # Verify Recency Bias (Asymmetry)
    # The end of the prompt should have higher attention than the start
    assert weights[-1] > weights[0]

    # Verify Sharp Decay in the middle
    mid_idx = len(weights) // 2
    assert weights[mid_idx] < 0.2  # Should drop significantly due to power=4.0