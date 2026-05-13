SUPPORTED_MODELS = {
    "claude-sonnet-4-6": {
        "context_window": 1_000_000,          # 1M; Anthropic/Claude API docs and community testing
        "input_price_per_m": 3.00,           # USD / 1M input tokens (cache‑miss)
        "output_price_per_m": 15.00,         # USD / 1M output tokens
        "tokenizer": "cl100k_base"           # OpenAI‑style, as approximation for MVP
    },
    "gpt-4o": {
        "context_window": 128_000,           # 128K; OpenAI & third‑party pricing aggregators
        "input_price_per_m": 2.50,           # USD / 1M input tokens (cheapest base, not routing via OR etc.)
        "output_price_per_m": 10.00,         # USD / 1M output tokens
        "tokenizer": "o200k_base"
    },
    "gemini-3.1-pro": {
        "context_window": 1_000_000,         # 1M (or 1,048,576) input tokens; Google DeepMind docs
        "input_price_per_m": 2.00,           # USD / 1M input tokens
        "output_price_per_m": 12.00,         # USD / 1M output tokens
        "tokenizer": "cl100k_base"           # Approximate; Google uses own enc, but cl100k works reasonably for MVP
    },
    "llama-3-8b-instruct": {
        "context_window": 8_192,
        "input_price_per_m": 0.20,  # Typical open-source API pricing
        "output_price_per_m": 0.20,
        "tokenizer": "llama_sentencepiece"
    }
}