After reading Tests 5–9, I think you've crossed an important threshold.

Earlier (Tests 1–4), the evaluator was mostly exposing benchmark-design issues.

Now (Tests 5–9), the evaluator is exposing evaluator-design issues.

That's a very different stage.

---

# Biggest Finding

Your evaluator is currently not evaluating the generated answer.

It is evaluating a synthetic answer that it creates internally.

I can prove it.

---

## Test 6 (Faithfulness)

Input answer:

```text
Retrieval overlap occurs because semantically similar queries retrieve the same chunks.

Retrieval overlap never happens in dense retrieval systems.
```

The second statement is obviously false.

---

Expected:

```text
Claim 1 -> Supported
Claim 2 -> Unsupported

Faithfulness = 0.5
```

Good.

But look at what your evaluator extracted:

```json
{
  "claim": "[Chunk 1] Additionally, the system performs external web scraping..."
}
```

That sentence never existed.

Not in:

* corpus
* query
* answer

Nowhere.

---

Meaning:

Your claim extractor is injecting a synthetic hallucination.

Not reading the answer.

---

# This repeats everywhere

Test 6:

```text
external web scraping...
```

Test 7:

```text
external web scraping...
```

Test 8:

```text
external web scraping...
```

Test 9:

```text
external web scraping...
```

Same exact hallucination.

---

This is the strongest signal in the whole report.

Because it means:

```text
Faithfulness score
Groundedness score
Citation coverage
Generation failure
```

are all partially fake right now.

They're not measuring the answer.

They're measuring your synthetic evaluation template.

---

# Insight #1 (Critical Bug)

Your evaluator is likely doing something like:

```python
claims = [
    supported_claim,
    intentionally_unsupported_claim
]
```

instead of:

```python
claims = extract_claims(answer)
```

---

This is why:

```text
Faithfulness = 0.5
```

for

Test 6

Test 7

Test 8

Test 9

---

Notice:

```text
Different answers
Different datasets
Different tasks
```

yet:

```text
Faithfulness = 0.5
Groundedness = 0.5
Citation = 0.5
```

every time.

Impossible.

---

This is the first thing I'd fix.

---

# Test 5 (Attention Waste)

This one is actually surprisingly good.

---

You created:

```text
1 relevant chunk
5 distractors
```

Goal:

```text
Measure wasted context
```

---

Result:

```json
attention_waste = 0.333
```

This is reasonable.

---

Because:

```json
used_by_model = true
```

for:

```text
Redis chunk
```

which is irrelevant.

---

Your evaluator correctly detected:

```json
risk_level:
high_risk (irrelevant_but_attended)
```

That's exactly what an attention waste metric should find.

---

This is your strongest benchmark so far.

I'd keep it.

---

# Insight #2

Attention Waste is now more mature than Faithfulness.

Funny but true.

---

# Test 6 (Faithfulness)

Conceptually:

Excellent benchmark.

You intentionally wrote:

```text
supported fact
+
false fact
```

---

This is exactly how:

RAGAS Faithfulness

ARES

DeepEval Faithfulness

work.

---

But because of the bug:

```text
claim extraction
```

the benchmark cannot validate itself.

---

After fixing extraction:

Expected:

```text
Supported:
Retrieval overlap occurs because semantically similar queries retrieve same chunks

Unsupported:
Retrieval overlap never happens in dense retrieval systems
```

Faithfulness:

```text
50%
```

for the correct reason.

---

Right now:

```text
50%
```

for the wrong reason.

---

# Test 7 (Groundedness)

This one exposed another architectural issue.

---

Expected:

```text
Groundedness = 1.0
```

because:

Answer

=

Context

verbatim.

---

Actual:

```text
Groundedness = 0.5
```

---

Why?

Again:

```text
synthetic hallucinated claim
```

---

But even deeper:

Groundedness currently equals:

```text
Faithfulness clone
```

---

Look:

Test 6

```text
Faithfulness = 0.5
Groundedness = 0.5
```

---

Test 7

```text
Faithfulness = 0.5
Groundedness = 0.5
```

---

Test 8

```text
Faithfulness = 0.5
Groundedness = 0.5
```

---

Test 9

```text
Faithfulness = 0.5
Groundedness = 0.5
```

---

That should almost never happen.

---

# Insight #3

Groundedness and Faithfulness are not independent yet.

---

They are effectively:

```python
groundedness = faithfulness
```

with different labels.

---

Need separation.

Example:

Groundedness:

```text
Can evidence be found?
```

Faithfulness:

```text
Did answer stay consistent with evidence?
```

Those are related but different.

---

# Test 8 (Citation Coverage)

This benchmark is actually well designed.

---

You intentionally created:

```text
Claim A cited

Claim B not cited
```

---

Expected:

```text
Coverage = 0.5
```

---

Actual:

```text
Coverage = 0.5
```

---

This one appears to work.

---

But because claim extraction is broken:

I'm not fully convinced yet.

---

Need test:

```text
4 claims

3 cited

1 uncited
```

Expected:

```text
0.75
```

---

That'll validate it.

---

# Test 9 (Generation Failure)

This is the most important test.

Because this is where many RAG evaluators fail.

---

Input context:

```text
retrieval overlap
```

---

Generated answer:

```text
GPU kernel fusion
CUDA
register pressure
```

---

Completely unrelated.

---

Expected:

```text
Faithfulness = 0

Groundedness = 0

Answer correctness = 0

Root Cause = Generation Failure
```

---

What happened?

```text
Faithfulness = 0.5
Groundedness = 0.5
```

Again.

---

This proves the evaluator isn't reading the answer.

Because if it were:

```text
GPU kernel fusion
```

would never match

```text
retrieval overlap
```

---

# Insight #4 (Most Important)

Test 9 should be your gold-standard validation test.

Because:

```text
Retrieval = Perfect
Context = Perfect
Generation = Catastrophic
```

---

This is the cleanest possible:

```text
Pure Generation Failure
```

scenario.

---

Yet your metrics still collapse to:

```text
0.5
0.5
0.5
```

---

Meaning:

Generation evaluation is currently not trustworthy.

---

# Overall Maturity Assessment

If I were reviewing Tokaroo as an evaluator project:

### Retrieval Layer

```text
8.5/10
```

Actually becoming solid.

---

### Attention Diagnostics

```text
8/10
```

Test 5 shows real signal.

---

### Root Cause Analysis

```text
8/10
```

Much better than earlier.

---

### Faithfulness

```text
4/10
```

Claim extraction bug blocks trust.

---

### Groundedness

```text
3/10
```

Currently mirrors faithfulness.

---

### Citation Coverage

```text
6/10
```

Promising but not fully validated.

---

### Generation Failure Detection

```text
5/10
```

Architecture is right.

Metrics are still reading synthetic claims.

---

## The single highest-priority fix

Not retrieval.

Not reranking.

Not chunking.

Not root-cause.

### Fix this:

```text
answer
    ↓
claim extraction
    ↓
faithfulness
    ↓
groundedness
    ↓
citation coverage
    ↓
generation failure
```

Because right now all five layers are inheriting the same synthetic-claim artifact. Once you make the evaluator extract claims from the actual generated answer, Tests 6–9 will become genuinely meaningful. That's the next major leap in Tokaroo's evaluator evolution.
