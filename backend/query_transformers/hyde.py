from __future__ import annotations

import os
from typing import List

import httpx

from .base import QueryTransformer, QueryVariant, normalize_query, unique_variants


class HyDETransformer(QueryTransformer):
    name = "hyde"

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.5-flash", max_output_tokens: int = 300) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        raw_model = os.getenv("HYDE_GEMINI_MODEL", model)
        self.model = _normalize_gemini_model(raw_model)
        env_max_tokens = os.getenv("HYDE_MAX_TOKENS")
        if env_max_tokens and env_max_tokens.isdigit():
            max_output_tokens = int(env_max_tokens)
        self.max_output_tokens = max_output_tokens

    def transform(self, query: str, *, max_variants: int = 5) -> List[QueryVariant]:
        normalized = normalize_query(query)
        if not self.api_key:
            # Ensure late-loaded env vars (e.g., .env.local) are picked up.
            self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not set for HyDE transformer.")

        prompt = (
            "Write a concise technical explanation answering:\n\n"
            f"{normalized}"
            "\n\nTechnical explanation:"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": self.max_output_tokens,
                "temperature": 0.4,
            },
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        with httpx.Client(timeout=20.0) as client:
            response = client.post(url, params={"key": self.api_key}, json=payload)
            response.raise_for_status()
            data = response.json()

        pseudo_doc = _extract_text(data)
        variants = [QueryVariant(text=pseudo_doc, source="hyde")]
        return unique_variants(variants, max_variants)


def _extract_text(data: dict) -> str:
    candidates = data.get("candidates")
    if isinstance(candidates, list):
        parts = []
        for candidate in candidates:
            content = candidate.get("content") if isinstance(candidate, dict) else None
            if not isinstance(content, dict):
                continue
            for part in content.get("parts", []):
                if isinstance(part, dict):
                    text = part.get("text")
                    if text:
                        parts.append(text)
        if parts:
            return "\n".join(parts).strip()

    output = data.get("output")
    if isinstance(output, list):
        parts = []
        for item in output:
            content = item.get("content") if isinstance(item, dict) else None
            if not isinstance(content, list):
                continue
            for block in content:
                if isinstance(block, dict) and block.get("type") == "output_text":
                    text = block.get("text")
                    if text:
                        parts.append(text)
        if parts:
            return "\n".join(parts).strip()

    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()

    text = data.get("text")
    if isinstance(text, str) and text.strip():
        return text.strip()

    raise RuntimeError("HyDE transformer did not receive a usable response.")


def _normalize_gemini_model(model: str) -> str:
    normalized = model.strip()
    if normalized.startswith("models/"):
        normalized = normalized[len("models/"):]
    return normalized
