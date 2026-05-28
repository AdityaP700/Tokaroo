from __future__ import annotations

import os
from typing import List

import httpx

from .base import QueryTransformer, QueryVariant, normalize_query, unique_variants


class HyDETransformer(QueryTransformer):
    name = "hyde"

    def __init__(self, api_key: str | None = None, model: str = "gpt-4o", max_output_tokens: int = 300) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("HYDE_OPENAI_MODEL", model)
        env_max_tokens = os.getenv("HYDE_MAX_TOKENS")
        if env_max_tokens and env_max_tokens.isdigit():
            max_output_tokens = int(env_max_tokens)
        self.max_output_tokens = max_output_tokens

    def transform(self, query: str, *, max_variants: int = 5) -> List[QueryVariant]:
        normalized = normalize_query(query)
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set for HyDE transformer.")

        prompt = (
            "Write a concise technical passage answering the question."
            "\nQuestion: "
            f"{normalized}"
            "\nAnswer:"
        )

        payload = {
            "model": self.model,
            "input": prompt,
            "max_output_tokens": self.max_output_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=20.0) as client:
            response = client.post("https://api.openai.com/v1/responses", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        pseudo_doc = _extract_text(data)
        variants = [QueryVariant(text=pseudo_doc, source="hyde")]
        return unique_variants(variants, max_variants)


def _extract_text(data: dict) -> str:
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
