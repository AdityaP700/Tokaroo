# Tokaroo — The Adaptive RAG Evaluator & Optimizer

Tokaroo is an advanced, lightweight AI evaluation engineering toolkit designed to diagnose, explain, and automatically heal Retrieval-Augmented Generation (RAG) pipelines.

Instead of just counting tokens, Tokaroo acts as an **X-Ray for your prompt context**, simulating how chunks are semantically embedded, cross-encoded, positioned, and ultimately processed by LLMs. It exposes complex cognitive failures like:
- **Lost-in-the-Middle Attention Decay**: The model ignores valid data because of where it was placed.
- **Semantic Mismatch & Hallucination Risks**: The vector DB loved the chunk (high semantic score), but it lacks actual lexical grounding (keywords), leading to false confidence.
- **Noisy Context Usage**: Irrelevant chunks taking up valuable cognitive attention.
- **Semantic Fragmentation**: Related ideas sliced apart by poor chunk boundaries.

## Target Audience
- **Academicians & Researchers:** Study and visualize positional bias and attention decay dynamically.
- **Students:** Understand the intersection of Vector Search, Reranking, and LLM Prompt Construction without paying thousands in API fees.
- **IT Developers / AI Engineers:** Audit your RAG system's chunking heuristics, reduce token padding overlap, and automatically optimize runtime parameters for production pipelines.

## How It Works (The Architecture)

1. **Text → Tokenization**: Uses target-model tokenizers (e.g., `cl100k_base`, `llama_sentencepiece`) to accurately measure footprint.
2. **Chunking Simulation**: Emulates naive chunking, enforcing safety math (preventing pathological overlaps > 50%).
3. **Hybrid Information Retrieval**:
   - **Semantic Search:** Uses `SentenceTransformers` (`all-MiniLM-L6-v2`) for raw dense embedding generation and similarity scoring.
   - **Lexical Overlap:** Computes keyword density to ensure semantic matches aren't "hallucinated relevance".
4. **Cross-Encoder Reranking**: Uses `ms-marco-MiniLM-L-6-v2` as an elite signal truth to re-evaluate semantic relevance against the query.
5. **Attention Model & Usage Simulation**: Calculates deterministic positional weights to simulate U-shaped LLM attention curves.
6. **Diagnostic Analyzer**: A strict, hierarchical decision tree identifies the primary structural flaw (e.g., Overflow > Redundancy > Lost in Middle > Noise).
7. **Adaptive Optimizer Loop (2-Pass Mode)**: If `auto_optimize=True` and the `health_score` is poor, Tokaroo automatically applies its recommended config and re-runs the simulation to "heal" the RAG query.

## What Tokaroo Gives You
A heavily structured JSON response detailing:
- **`diagnosis`**: The primary failure mode and its severity.
- **`issues`**: All co-occurring issues (e.g., overlap + noise).
- **`health_score`**: 0–100 index of cognitive pipeline safety.
- **`recommended_config`**: Auto-calculated chunk size, overlap, and `top_k` specific to your corpus size.
- **`attention_curve`**: Data to plot the LLM's positional bias.
- **`is_optimized`**: True if Tokaroo engaged its 2-pass feedback loop to fix your parameters.

## The Priority Diagnosis Tree
When a RAG system fails, it often fails in multiple ways. Tokaroo enforces a strict causal diagnosis hierarchy:
1. `context_window_overflow` (Input exceeds model limits)
2. `high_token_redundancy` (Catastrophic overlap waste)
3. `over_chunking` (Fragmentation via tiny chunks)
4. `semantic_fragmentation` (Ideas spread too far apart)
5. `lost_in_middle_decay` (Relevant chunks buried in the attention trough)
6. `noisy_context_usage` (Irrelevant garbage heavily attended to)
7. `semantic_mismatch` (High vector similarity, zero keyword presence)
8. `false_positive_retrieval` (Model trusts a chunk that shouldn't be trusted)
9. `weak_query_match` (Vector space is oblivious to the query)
10. `low_diversity_retrieval` (Vector space is too narrow)

## Supported LLM Profiles
- **Claude 3.5 Sonnet (`claude-sonnet-4-6`)**: 1M Window
- **GPT-4o (`gpt-4o`)**: 128k Window, `o200k_base`
- **Gemini 1.5 Pro (`gemini-3.1-pro`)**: 1M Window
- **Llama 3 8B (`llama-3-8b-instruct`)**: 8k Window

## Quick Start
From the project root:

```powershell
cd backend
# create and activate venv
python -m venv venv
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Try the Adaptive Simulator using `curl`:

```bash
curl -X POST "http://127.0.0.1:8000/simulate-rag" \
     -H "Content-Type: application/json" \
     -d '{
           "text": "Your long source text...",
           "query": "Specific question about text",
           "model": "gpt-4o",
           "chunk_size": 25,
           "overlap": 24,
           "top_k": 5,
           "auto_optimize": true
         }'
```
*Because `overlap` is pathologically high (24 on a 25 size), Tokaroo will detect `high_token_redundancy`, correct the overlap, recalculate the chunking, and output the optimized RAG layout.*
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

