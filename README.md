# Tokaroo — Debug why your RAG fails

Tokaroo is a lightweight toolkit that helps you understand *why* Retrieval-Augmented Generation (RAG) systems fail — even when retrieval looks correct.

It simulates how chunks are selected, positioned, and processed by an LLM, exposing issues like:
- lost-in-the-middle attention decay
- token redundancy from overlap
- context window inefficiencies

Instead of guessing configs, Tokaroo shows you what the model actually “pays attention to”.

How it works (intuition)
------------------------
Text → Chunking → Retrieval → Prompt Assembly → Attention Simulation → Diagnosis → Recommendation

Why this matters
---------------
Even when retrieval returns highly relevant chunks, LLMs often ignore information in the middle of the prompt due to attention bias.

This leads to:
- incomplete answers
- missing key context
- hallucinations despite correct retrieval

Tokaroo helps you diagnose whether the problem is:
- retrieval (chunking, overlap, top_k), or
- model behavior (attention decay, recency bias)

What Tokaroo gives you (plain)
--------------------------------
- A simulated RAG pipeline: chunking, retrieval, placement into a prompt, and a simple attention model.
- A structured diagnosis with:
    - `issues`: a short list of detected problems (can be more than one),
    - `health_score`: a 0–100 indicator of how healthy the configuration is,
    - `recommended_config`: quick tunable suggestions to try,
    - `attention_curve`: numbers you can plot to visualize what the model favors,
    - `reorder_effect`: a light simulation that tests whether moving important chunks to the end helps.

Easy examples you tried
-----------------------
- Config A (bad): `chunk_size=80`, `overlap=60` → huge duplication and cost.
- Config B (balanced): `chunk_size=106`, `overlap=12` → efficient configuration, but often still `lost_in_middle_decay` because the model ignores middle chunks.

Example output (simplified)
---------------------------
```json
{
    "issues": ["lost_in_middle_decay"],
    "health_score": 81,
    "attention_curve": [0.5, 0.12, 0.15, 1.0]
}
```

Interpretation:

middle chunks (~0.12, ~0.15) are effectively ignored
last chunk dominates due to recency bias

What to try next
-----------------
- If `high_token_redundancy` appears: reduce overlap.
- If `over_chunking` appears: increase chunk size or reduce chunk count.
- If `lost_in_middle_decay` appears: consider reordering important chunks toward the end, summarizing middle chunks, or reranking retrieved chunks.

Developer notes (short)
-----------------------
- Similarity is currently a simple keyword-overlap when original text is available (fast and interpretable). It can be replaced with embeddings later.
- The attention model is intentionally deterministic to make results repeatable and easy to reason about.
- The diagnosis returns multiple issues so you can see combined failure modes.

Key insights from this project
-----------------------------
- RAG failures are often caused by attention allocation, not retrieval quality
- More chunks ≠ better performance
- Even well-tuned chunking cannot fully eliminate attention bias
- Position of information in the prompt significantly affects model output

Potential improvements:
- lightweight frontend to visualize attention curves
- embedding-based similarity instead of keyword overlap
- smarter reranking strategies

Quick start (backend)
---------------------
From the project root:

```powershell
cd backend
# optional: activate venv
# .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Try a RAG simulation (example using `curl`):

```bash
curl -sS -X POST "http://127.0.0.1:8000/simulate-rag" \
        -H "Content-Type: application/json" \
        -d '{"text":"Your long text here...", "model":"claude-sonnet-4-6", "chunk_size":106, "overlap":12, "top_k":4}'
```

What to look for in the JSON
----------------------------
- `optimization.issues` — list of problems found
- `optimization.health_score` — simple 0–100 score
- `optimization.recommended_config` — small settings to try next
- `optimization.attention_curve` — small list you can plot
- `optimization.reorder_effect` — shows before/after and whether reordering helps

Testing
-------
- Backend tests are in `backend/tests/`. Run them from the `backend` folder with `pytest -q`.

Want help or improvements?
-------------------------
- I can add a tiny frontend that plots `attention_curve` and highlights ignored chunks.
- I can add more reordering heuristics or run a small experiment that summarizes middle chunks instead of reordering.

Author
------
AdityaP700

License
-------
MIT

