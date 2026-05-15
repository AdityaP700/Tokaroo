# Tokaroo

Tokaroo is a Python project for understanding how language models handle tokenization, context windows, truncation, attention decay, and retrieval-augmented generation (RAG). It started as a token simulator and now includes a structured backend that analyzes prompt failure modes and RAG configuration issues.

## Project summary

Tokaroo is built to make LLM behavior easier to inspect and reason about. The system now:

- simulates RAG pipelines
- analyzes attention behavior
- detects configuration issues
- produces structured diagnosis output for prompt and chunking problems

The project is useful for debugging prompts, evaluating chunking strategies, comparing model behavior, and explaining why context gets lost or degraded.

## What it currently does

### Context simulation
- tokenizes text using model-specific tokenizers
- simulates model context-window limits
- shows what fits and what gets truncated
- estimates prompt cost by model
- analyzes attention decay across visible tokens

### RAG simulation
- splits input into overlapping chunks
- simulates retrieval using Top-K selection
- applies positional attention to chunks
- computes chunk importance and risk signals
- returns a structured diagnosis with actionable recommendations
- detects overflow, over-chunking, and redundancy patterns

### Prompt failure analysis
- identifies truncation risk
- detects lost-in-the-middle effects
- reports attention distribution issues
- summarizes failure mode, impact, and confidence

## Current backend endpoints

### `GET /`
Health check.

### `POST /simulate`
Simulates tokenization and context-window behavior for a single prompt.

### `POST /compare`
Compares tokenization and cost across supported models.

### `POST /simulate-rag`
Simulates chunking, retrieval, positional attention, and structured RAG diagnosis.

## Example RAG diagnosis output

The RAG endpoint returns a structured response that includes:

- `diagnosis.primary_issue`
- `diagnosis.confidence`
- `diagnosis.impact`
- `diagnosis.short_summary`
- `actionable_steps`
- `health_score`

This makes the result easier to consume in a UI, in Insomnia, or in automated tests.

## Repository structure

```text
tokaroo/
├── backend/
│   ├── app.py
│   ├── analyzer.py
│   ├── chunk_simulator.py
│   ├── context_simulator.py
│   ├── model_config.py
│   ├── schemas.py
│   ├── tokenizer_engine.py
│   ├── requirements.txt
│   └── tests/
└── frontend/
    ├── src/
    ├── public/
    ├── package.json
    └── vite.config.ts
```

## Backend setup

```bash
cd backend
pip install -r requirements.txt
```

To run the API during development, use the project’s FastAPI entry point from the backend environment.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

## Testing

The backend includes endpoint and regression coverage for:

- `/simulate`
- `/compare`
- `/simulate-rag`
- prompt failure analysis logic
- RAG diagnosis logic
- edge cases such as empty inputs, invalid models, and overflow handling

For local validation, use the backend virtual environment included in the repository.

## What we found so far

Tokaroo has shown a few useful patterns that matter in real prompt engineering work:

- small inputs should not be mislabeled as overflow
- derived labels like `risk_level` can create circular logic if used as diagnosis inputs
- overlap waste should be measured relative to chunking scale, not only raw token totals
- single-chunk prompts should not be treated as critical by default
- deterministic chunk scoring makes the simulator easier to test and trust

## Notes on the simulator

The current implementation is intentionally educational and diagnostic. It is not a production retrieval system, but it does model the kinds of failures teams run into when prompt size, chunk size, overlap, and retrieval order are poorly balanced.

## Author

AdityaP700

## License

MIT
