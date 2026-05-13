# 🦘 Tokaroo

**An interactive simulator showing what LLMs actually see—and forget.**

Tokaroo helps you understand tokenization, context windows, and why your prompts get truncated. Built for students, researchers, and anyone curious about how LLMs process text.

---

## 🎯 What Problem Does This Solve?

Most people using LLMs don't understand:
- **Why their input gets cut off** — Models have token limits, not character limits
- **How much they're actually paying** — Tokens ≠ words, and costs vary wildly
- **What the model actually sees** — Long prompts lose information at the edges
- **Why RAG exists** — Context windows force chunking strategies

**Tokaroo makes the invisible visible.**

---

## ✨ Core Features

### MVP (v1.0)
- ✅ **Real tokenization** — Uses actual model tokenizers (tiktoken, SentencePiece)
- ✅ **Context simulation** — Shows what fits vs what gets truncated
- ✅ **Cost calculator** — Instant pricing across 8+ popular models
- ✅ **Visual truncation** — Color-coded display of visible/lost tokens
- ✅ **Model comparison** — Same text, different models, side-by-side

### Future (v2.0+)
- 🔄 **Lost-in-the-middle viz** — Show attention decay across context
- 🔄 **RAG chunking simulator** — Visualize document splitting strategies
- 🔄 **Multilingual comparison** — Token explosion in Hindi/Japanese/Arabic
- 🔄 **Conversation memory** — Multi-turn chat context tracking

---

## 🏗️ System Architecture

```
┌─────────────────┐
│   User Input    │
│  (text + model) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tokenization   │◄─── tiktoken / SentencePiece
│     Engine      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Window  │◄─── Model configs (128k/200k/1M/10M)
│   Simulator     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cost Estimator  │◄─── Per-token pricing
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Frontend UI   │
│  (React + D3)   │
└─────────────────┘
```

---

## 📊 Supported Models (May 2026)

| Model | Context Window | Input Price | Output Price | Notes |
|-------|---------------|-------------|--------------|-------|
| **GPT-5.4** | 1M tokens | $2.00/M | $6.00/M | 2x price >272K tokens |
| **Claude Opus 4.6** | 1M tokens | $5.00/M | $25.00/M | Flat rate, no surcharge |
| **Claude Sonnet 4.6** | 1M tokens | $3.00/M | $15.00/M | Best price/performance |
| **Gemini 3.1 Pro** | 1M tokens | $1.25/M | $5.00/M | Cheapest 1M window |
| **Gemini 3 Flash** | 1M tokens | $2.00/M | $12.00/M | Speed optimized |
| **Llama 4 Maverick** | 1M tokens | Self-hosted | Self-hosted | Open-source |
| **Llama 4 Scout** | 10M tokens | Self-hosted | Self-hosted | Largest window |
| **DeepSeek-V3.2** | 128K tokens | $0.55/M | $2.19/M | Budget option |

*All pricing per million tokens. Self-hosted models require GPU infrastructure.*

---

## 🎨 UI Components

### 1. Input Panel
```
┌──────────────────────────────────┐
│ Paste your text here...          │
│                                   │
│                                   │
└──────────────────────────────────┘
   Model: [Claude Sonnet 4.6 ▼]
```

### 2. Token Bar Visualizer
```
[████████████████████░░░░░░░░░░░░]
  Visible (142k)      Lost (58k)
```
- **Green** = Model can see this
- **Red** = Truncated, model never sees it

### 3. "What The Model Sees"
```
...last 200,000 tokens of your input
displayed here with exact token boundaries
```

### 4. "What The Model Forgets" (Killer Feature!)
```
First 58,000 tokens that got truncated:
[Shows the beginning that was cut off]
```

### 5. Metrics Dashboard
```
┌────────────────────────────────┐
│ Tokens: 200,000                │
│ Context Window: 200,000        │
│ Overflow: 0 tokens ✅          │
│ Est. Cost: $0.60               │
└────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- pip / npm

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
# Server runs on http://localhost:8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

---

## 📁 Project Structure

```
tokaroo/
├── backend/
│   ├── app.py                  # FastAPI server
│   ├── model_configs.py        # Model specs + pricing
│   ├── tokenizer_engine.py     # Tokenization logic
│   ├── context_simulator.py    # Core truncation logic
│   ├── cost_estimator.py       # Price calculations
│   ├── schemas.py              # API request/response models
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputPanel.jsx
│   │   │   ├── TokenVisualizer.jsx
│   │   │   ├── TruncationDisplay.jsx
│   │   │   └── MetricsPanel.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 🔧 API Specification

### `POST /simulate`

**Request:**
```json
{
  "text": "Your long input text here...",
  "model": "claude-sonnet-4-6"
}
```

**Response:**
```json
{
  "model": "claude-sonnet-4-6",
  "token_count": 200000,
  "context_window": 1000000,
  "fits": true,
  "overflow": 0,
  "visible_tokens": [...],
  "lost_tokens": [],
  "cost": {
    "input": 0.60,
    "output_per_1k": 0.015
  },
  "token_to_char_ratio": 0.75
}
```

---

## 🧠 Key Implementation Details

### Tokenization
- **GPT models** → `tiktoken` library (cl100k_base, o200k_base)
- **Claude models** → `tiktoken` (same as GPT)
- **Llama models** → `SentencePiece`
- **Gemini models** → Estimated (1 token ≈ 0.75 words)

### Context Window Behavior
```python
if token_count <= context_window:
    visible = all_tokens
    lost = []
else:
    # TAIL TRUNCATION (most common)
    visible = all_tokens[-context_window:]
    lost = all_tokens[:-context_window]
```

### Cost Calculation
```python
input_cost = (token_count / 1_000_000) * price_per_million
# Output cost = (output_tokens / 1_000_000) * output_price
```

---

## 🎓 Educational Value

### What You'll Learn
1. **Tokens ≠ Words** — "Hello" = 1 token, "Namaste" = 2-3 tokens
2. **Context limits are hard** — No model can see infinite text
3. **Pricing scales with tokens** — 200k Hindi words cost more than 200k English words
4. **Truncation = information loss** — Model never sees what's cut off
5. **RAG exists for a reason** — Can't fit entire docs in context

### Ideal For
- 🎓 Students learning about LLMs
- 🔬 Researchers estimating costs
- 💻 Developers debugging prompt issues
- 🏢 Product teams planning AI features

---

## 🛠️ Tech Stack

**Backend:**
- FastAPI — Modern Python API framework
- tiktoken — OpenAI's tokenizer
- SentencePiece — Llama/multilingual tokenization
- Pydantic — Schema validation

**Frontend:**
- React 18 — UI framework
- Vite — Fast build tool
- D3.js — Token bar visualization
- TailwindCSS — Styling

---

## 📈 Roadmap

### Phase 1: MVP ✅ (Week 1)
- [x] Backend API
- [x] 8 model configs
- [x] Basic tokenization
- [x] Cost calculator
- [x] Simple UI

### Phase 2: Polish (Week 2)
- [ ] Syntax highlighting for tokens
- [ ] Model comparison mode
- [ ] Export results as JSON
- [ ] Mobile responsive

### Phase 3: Advanced (Week 3+)
- [ ] Attention heatmaps (simulated)
- [ ] RAG chunking visualizer
- [ ] Multilingual token explosion demo
- [ ] Conversation memory tracker

---

## 💡 What Makes Tokaroo Different?

**Not Another AI Wrapper.**

Most tokenizer tools just count tokens. Tokaroo:
- ✅ **Simulates actual model behavior** (truncation, cost, limits)
- ✅ **Shows what's lost** (not just what fits)
- ✅ **Compares models** (same input, different economics)
- ✅ **Educational** (builds intuition, not just outputs numbers)

---

## 🎯 Positioning

**One-liner:**
*"See what your LLM sees—and what it forgets."*

**Problem-focused:**
*"Built a system that makes context windows, tokenization, and truncation visible—because most people don't understand why their prompts get cut off."*

**Technical depth:**
*"Modular backend simulating per-model tokenization, tail truncation, and cost estimation—with a clean React frontend visualizing information loss."*

---

## 🤝 Contributing

Built by [Your Name] as a learning project.

Contributions welcome! Areas to improve:
- Add more models (Mistral, Cohere, etc.)
- Better tokenization accuracy for Gemini
- Attention decay simulation
- Batch comparison mode

---

## 📄 License

MIT — Use it, learn from it, build on it.

---

## 🔗 Links

- Live Demo: [tokaroo.app](#)
- GitHub: [github.com/AdityaP700/tokaroo](#)
- Twitter: [@YourHandle](#)

---

**Built with ❤️ for the AI curious.**