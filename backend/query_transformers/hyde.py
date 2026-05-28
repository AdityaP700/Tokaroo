from __future__ import annotations

import os
from typing import List, Any

import google.generativeai as genai

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
        static_doc = os.getenv("HYDE_STATIC_DOC")
        if static_doc:
            pseudo_doc = static_doc.strip()
            variants = [QueryVariant(text=pseudo_doc, source="hyde_static")]
            return unique_variants(variants, max_variants)
        if not self.api_key:
            # Ensure late-loaded env vars (e.g., .env.local) are picked up.
            self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not set for HyDE transformer.")

        prompt = (
            "You are generating a technical passage for retrieval augmentation.\n\n"
            "Task:\n"
            "Write a complete standalone technical paragraph answering the question below.\n\n"
            "Requirements:\n"
            "- Write at least 80 words.\n"
            "- Use complete sentences.\n"
            "- Include retrieval, embeddings, semantic similarity, and ranking terminology where relevant.\n"
            "- Explain mechanisms and causes.\n"
            "- Do not stop early.\n"
            "- Do not write bullet points.\n"
            "- Do not write sentence fragments.\n\n"
            "Question:\n"
            f"{normalized}"
            "\n\nTechnical Paragraph:\n"
        )

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model)
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=self.max_output_tokens,
            temperature=0.4,
            candidate_count=1,
        )
        response = model.generate_content(prompt, generation_config=generation_config)

        _log_finish_reason(response)
        pseudo_doc = _extract_text(response)
        print(f"[HyDE] Raw text length: {len(pseudo_doc.split())} words")
        variants = [QueryVariant(text=pseudo_doc, source="hyde")]
        return unique_variants(variants, max_variants)


def _extract_text(response: Any) -> str:
    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()

    candidates = getattr(response, "candidates", None)
    if isinstance(candidates, list):
        parts = []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if content is None:
                continue
            content_parts = getattr(content, "parts", None)
            if not isinstance(content_parts, list):
                continue
            for part in content_parts:
                part_text = getattr(part, "text", None)
                if part_text:
                    parts.append(part_text)
        if parts:
            return "\n".join(parts).strip()

    raise RuntimeError("HyDE transformer did not receive a usable response.")


def _log_finish_reason(response: Any) -> None:
    candidates = getattr(response, "candidates", None)
    if not isinstance(candidates, list) or not candidates:
        return
    finish_reason = getattr(candidates[0], "finish_reason", None)
    if finish_reason:
        print(f"[HyDE] Gemini finishReason: {finish_reason}")


def _normalize_gemini_model(model: str) -> str:
    normalized = model.strip()
    if normalized.startswith("models/"):
        normalized = normalized[len("models/"):]
    return normalized
