// ─── Tokaroo Landing Page Content ────────────────────────────────────────────

// ── "The Cognitive Autopsy" narrative steps ───────────────────────────────────
export interface NarrativeStep {
  label: string;  // "01 — INPUT"
  title: string;
  body: string;
}

export const NARRATIVE_STEPS: NarrativeStep[] = [
  {
    label: '01 — INPUT',
    title: 'Document enters the pipeline',
    body: 'Raw text is tokenized and streamed in. The network initializes — nodes form, connections emerge. Everything is still coherent.',
  },
  {
    label: '02 — CHUNKING',
    title: 'The fragmentation begins',
    body: 'Text is sliced into chunks. Watch how semantic meaning gets scattered. Related ideas drift apart. Boundaries break context.',
  },
  {
    label: '03 — ATTENTION',
    title: 'The model picks what to focus on',
    body: 'Two or three nodes capture disproportionate weight. The rest of the network dims. This is where "Lost in the Middle" begins.',
  },
  {
    label: '04 — FAILURE',
    title: 'The breakdown',
    body: 'Nodes flicker red. Connections snap. Your model just hallucinated — and now you can see exactly why it happened.',
  },
];

// ── "What Tokaroo Catches" bento cards ────────────────────────────────────────
export type BentoVisualType =
  | 'fade-center'
  | 'glitch-word'
  | 'overflow-bar'
  | 'pulse-node'
  | 'feedback-loop'
  | 'engine-blob';

export interface BentoCard {
  title: string;
  desc: string;
  visual: BentoVisualType;
  /** gridColumn span (1, 2, or 3 in a 3-col grid) */
  colSpan: 1 | 2 | 3;
}

export const BENTO_CARDS: BentoCard[] = [
  {
    title: 'Lost in the Middle',
    desc: 'LLMs systematically ignore context placed in the center of the window. Chunks 3–7 are often invisible to the model.',
    visual: 'fade-center',
    colSpan: 2,
  },
  {
    title: 'Semantic Mismatch',
    desc: 'Chunks match lexically but diverge semantically. Confident wrong answers.',
    visual: 'glitch-word',
    colSpan: 1,
  },
  {
    title: 'Context Overflow',
    desc: 'Chunks are silently dropped when the token budget is exceeded. The model never sees critical information.',
    visual: 'overflow-bar',
    colSpan: 1,
  },
  {
    title: 'Real-time Visualization',
    desc: 'Watch attention scores, chunk rankings, and failures as they happen — not after the fact.',
    visual: 'pulse-node',
    colSpan: 2,
  },
  {
    title: 'Adaptive Optimizer',
    desc: 'Tokaroo auto-heals your retrieval config. A 2-pass optimization loop that rewrites your chunking strategy on the fly.',
    visual: 'feedback-loop',
    colSpan: 2,
  },
  {
    title: 'Cinematic 3D Engine',
    desc: 'React + Canvas rendering. Nodes, edges, failure states — all animated in real time with a physics simulation.',
    visual: 'engine-blob',
    colSpan: 1,
  },
];
