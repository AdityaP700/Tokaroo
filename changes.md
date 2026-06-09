Priority order:

1. Documentation (Highest)

update

docs/

01_overview.md
02_retrieval.md
03_reranking.md
04_context_engineering.md
05_generation_eval.md
06_root_cause.md
07_benchmarks.md

2. Benchmark Results

Actually run:

Lost in Middle
Token Budget
Reranker Impact
Faithfulness
Groundedness
Generation Failure

and store:

before
after
improvement

tables.

These become interview ammunition.
Example 5 — 06_benchmarks.md

This is where your test cases live.

Goal

Create controlled failures.

Benchmark 1

RRF

Dense succeeds
Keyword fails
Benchmark 2

Lost in Middle

Answer chunk position:
1
5
10
20
Benchmark 3

Token Budget

100%
75%
50%
25%
Benchmark 4

Faithfulness

Supported Claim
+
Unsupported Claim
Learning
Evaluation metrics must be tested
against controlled failures.

Otherwise the metric itself
cannot be trusted.
The Most Important Section

Every doc should end with:

## Key Takeaways

For example:

1. Retrieval ≠ Generation

2. More context ≠ Better context

3. Reranking improves relevance
   but increases latency

4. Faithfulness detects unsupported claims

5. Observability is as important
   as retrieval quality

That section is what interviewers will remember.

The biggest mistake would be documenting Tokaroo as:

Feature
Feature
Feature
Feature

Instead document it as:

Problem
Experiment
Result
Learning

because Tokaroo is fundamentally an AI Engineering learning journey encoded as a system, not just a collection of RAG features.