import { create } from "zustand";
import { apiRequest, type RagResponse } from "../api/client";

// ── Mode configurations ───────────────────────────────────────────────────
export const MODE_CONFIGS = {
  fast: { chunk_size: 300, overlap: 15, top_k: 3 },
  balanced: { chunk_size: 150, overlap: 20, top_k: 5 },
  deep: { chunk_size: 50, overlap: 25, top_k: 10 },
} as const;

export type SimMode = keyof typeof MODE_CONFIGS;

export const ISSUE_RESULT: Record<string, string> = {
  semantic_fragmentation: "model cannot form a coherent answer",
  high_token_redundancy: "model wastes attention on duplicates",
  lost_in_middle_decay: "model misses critical middle chunks",
  over_chunking: "signal is lost in noise",
  noisy_context_usage: "model answers from irrelevant context",
  semantic_mismatch: "model retrieves the wrong information",
  false_positive_retrieval: "wrong chunks dominate the context",
  low_diversity_retrieval: "model sees redundant perspectives only",
  suboptimal_integration: "retrieval quality fails to reach attention",
  context_window_overflow: "critical content is silently truncated",
  optimal: "pipeline is performing well",
};

export const GRAPH_OVERLAY: Record<
  string,
  { icon: string; text: string; color: string }
> = {
  semantic_fragmentation: {
    icon: "⚠",
    text: "Fragmentation: Chunks are splitting semantic meaning",
    color: "#D97706",
  },
  high_token_redundancy: {
    icon: "⚠",
    text: "Redundancy: High overlap creates duplicate content",
    color: "#D97706",
  },
  lost_in_middle_decay: {
    icon: "⚠",
    text: "Middle decay: Relevant chunks lost to positional bias",
    color: "#F97316",
  },
  over_chunking: {
    icon: "⚠",
    text: "Over-chunking: Too many fragments crowd the context",
    color: "#D97706",
  },
  noisy_context_usage: {
    icon: "⚠",
    text: "Noise: Low-relevance chunks attending to model",
    color: "#F97316",
  },
  semantic_mismatch: {
    icon: "⚠",
    text: "Mismatch: Chunks don't align with query intent",
    color: "#D97706",
  },
  false_positive_retrieval: {
    icon: "⚠",
    text: "False positives: Wrong chunks were retrieved",
    color: "#D97706",
  },
  low_diversity_retrieval: {
    icon: "⚠",
    text: "Low diversity: Redundant chunk perspectives selected",
    color: "#71717A",
  },
  suboptimal_integration: {
    icon: "⚠",
    text: "Integration gap: Retrieval quality lost in attention",
    color: "#D97706",
  },
  context_window_overflow: {
    icon: "🔴",
    text: "Overflow: Context window exceeded — content lost",
    color: "#DC2626",
  },
  optimal: {
    icon: "✓",
    text: "Optimal: Pipeline is performing well",
    color: "#16A34A",
  },
};

// ── Helper: cause chain ───────────────────────────────────────────────────
function buildCauseChain(raw: RagResponse): string[] {
  const issue = raw.optimization.diagnosis.primary_issue;
  const waste =
    raw.attention_waste != null ? Math.round(raw.attention_waste * 100) : 0;
  const first = raw.chunks[0];

  switch (issue) {
    case "semantic_fragmentation":
      return [
        `chunk_size = ${first?.token_count ?? "?"}t (too small)`,
        "Semantic fragmentation",
        `${raw.total_chunks_created} weak chunks created`,
        "Attention spreads thin",
        `${waste}% attention waste`,
      ];
    case "high_token_redundancy":
      return [
        `High overlap → +${raw.extra_tokens_due_to_overlap}t duplicates`,
        "Redundant content in context window",
        "Model sees repeated context",
        "Attention splits on duplicates",
        "Retrieval quality drops",
      ];
    case "lost_in_middle_decay":
      return [
        `${raw.chunks_in_prompt} chunks injected`,
        "Middle positions are positionally weak",
        `${raw.ignored_relevant_chunks?.length ?? 0} relevant chunks ignored`,
        "Attention collapses to edges only",
        `${waste}% attention waste`,
      ];
    case "over_chunking":
      return [
        `${raw.total_chunks_created} chunks (too many)`,
        "Context window crowded",
        "Per-chunk attention drops",
        "Signal lost in noise",
        `${waste}% attention waste`,
      ];
    case "noisy_context_usage":
      return [
        "top_k too high → noise included",
        "Low-relevance chunks fill window",
        "Noise competes with signal",
        "Model attends to irrelevant chunks",
        `${waste}% attention waste`,
      ];
    case "semantic_mismatch":
      return [
        "Query–chunk vocabulary gap",
        "High embedding, low keyword match",
        "False positives retrieved",
        "Wrong context fed to model",
        "Answer quality degrades",
      ];
    case "context_window_overflow":
      return [
        `Total tokens = ${raw.total_original_tokens}t (overflow)`,
        "Context window exceeded",
        "Content truncated from front",
        "Model answers partial input",
        "Critical failure risk",
      ];
    default:
      return [
        raw.optimization.diagnosis.short_summary,
        `${raw.chunks_in_prompt}/${raw.total_chunks_created} chunks in prompt`,
        waste > 0 ? `${waste}% attention waste` : "Review configuration",
      ];
  }
}

// ── Helper: failure narrative ─────────────────────────────────────────────
function buildNarrative(raw: RagResponse): string[] {
  const issue = raw.optimization.diagnosis.primary_issue;
  const first = raw.chunks[0];
  const waste =
    raw.attention_waste != null ? Math.round(raw.attention_waste * 100) : 0;

  switch (issue) {
    case "semantic_fragmentation":
      return [
        `Chunks too small (${first?.token_count ?? "?"}t) → ideas get split across chunks`,
        `${raw.total_chunks_created} fragments created → no single chunk captures full meaning`,
        "Model receives incomplete semantic units → cannot build coherent answer",
      ];
    case "high_token_redundancy":
      return [
        `High overlap adds ${raw.extra_tokens_due_to_overlap} duplicate tokens to the window`,
        "Redundant content wastes context space → less room for unique information",
        "Model sees repetition → attention splits across duplicates",
      ];
    case "lost_in_middle_decay":
      return [
        `${raw.chunks_in_prompt} chunks injected → middle positions suffer attention decay`,
        `${raw.ignored_relevant_chunks?.length ?? 0} relevant chunks are positionally ignored`,
        "Model only strongly attends to first and last chunks → misses middle content",
      ];
    case "over_chunking":
      return [
        `Too many chunks (${raw.total_chunks_created}) crowd the context window`,
        `Each chunk receives only ~${Math.round(100 / Math.max(1, raw.chunks_in_prompt))}% average attention`,
        "Signal-to-noise ratio drops → model cannot identify what matters",
      ];
    case "noisy_context_usage":
      return [
        "Too many chunks retrieved → low-relevance content fills context window",
        "Noise competes with relevant content for model attention",
        `${waste}% of attention wasted on irrelevant chunks`,
      ];
    case "semantic_mismatch":
      return [
        "Embedding scores are high but keyword overlap is low → misleading similarity",
        "Chunks about different topics pass the retrieval filter",
        "Model receives off-topic context → answers from wrong information",
      ];
    case "context_window_overflow":
      return [
        `Total chunk tokens exceed the context window (${raw.total_original_tokens}t total)`,
        "Content is silently truncated from the front of the prompt",
        "Model never sees critical context → failure guaranteed",
      ];
    default:
      return raw.optimization.actionable_steps.slice(0, 3);
  }
}

// ── Helper: config warnings ───────────────────────────────────────────────
function buildConfigWarnings(raw: RagResponse): string[] {
  const warnings: string[] = [];
  const issues = raw.optimization.issues ?? [];
  const waste =
    raw.attention_waste != null ? Math.round(raw.attention_waste * 100) : 0;

  for (const issue of issues) {
    switch (issue.type) {
      case "high_token_redundancy": {
        const pct = raw.total_original_tokens
          ? Math.round(
              (raw.extra_tokens_due_to_overlap / raw.total_original_tokens) *
                100,
            )
          : 0;
        warnings.push(`High overlap (${pct}%) → redundancy`);
        break;
      }
      case "over_chunking":
        warnings.push(`Too many chunks (${raw.total_chunks_created}) → noise`);
        break;
      case "semantic_fragmentation":
        warnings.push("Small chunks → semantic fragmentation");
        break;
      case "noisy_context_usage":
        warnings.push("High top-k → noise dominates");
        break;
      case "lost_in_middle_decay":
        warnings.push(`Middle decay detected (${waste}% attention waste)`);
        break;
      case "context_window_overflow":
        warnings.push("Context window overflow → content truncated");
        break;
    }
  }
  return warnings;
}

// ── Helper: graph from RAG response ──────────────────────────────────────
function riskKind(riskLevel: string) {
  const v = riskLevel.toLowerCase();
  if (v.includes("critical") || v.includes("high")) return "high";
  if (v.includes("medium")) return "medium";
  return "low";
}

function severityFromBackend(severity: string) {
  const v = severity.toLowerCase();
  if (v.includes("critical") || v.includes("high")) return "error";
  if (v.includes("medium") || v.includes("warning")) return "warning";
  return "info";
}

function graphFromRagResponse(result: RagResponse, runId: number) {
  const chunks = result.chunks.map((chunk, index) => ({
    id: `run-${runId}-chunk-${chunk.chunk_index}`,
    display_id: `chunk-${chunk.chunk_index}`,
    chunk_index: chunk.chunk_index,
    size: chunk.token_count,
    relevance: chunk.relevance_score ?? chunk.similarity_score ?? 0,
    attention: chunk.attention_weight ?? chunk.positional_weight ?? 0,
    final_importance: chunk.final_importance,
    risk_level: riskKind(chunk.risk_level),
    risk_label: chunk.risk_level,
    used_by_model: chunk.used_by_model ?? false,
    lost_reason: chunk.lost_reason,
    boundary_snippet: chunk.boundary_snippet,
    start_token: chunk.start_token,
    end_token: chunk.end_token,
    x: Math.cos(index * 1.9) * (80 + index * 10),
    y: Math.sin(index * 1.9) * (80 + index * 10),
  }));

  const edges = chunks.slice(1).map((chunk, index) => ({
    source: chunks[index].id,
    target: chunk.id,
    weight: Math.max(
      0.2,
      Math.min(1, (chunks[index].relevance + chunk.relevance) / 2),
    ),
  }));

  const usedChunks = chunks.filter((c) => c.used_by_model);
  for (let i = 1; i < usedChunks.length; i++) {
    edges.push({
      source: usedChunks[i - 1].id,
      target: usedChunks[i].id,
      weight: 0.85,
    });
  }

  const attention = result.optimization.attention_curve?.length
    ? result.optimization.attention_curve
    : chunks.map((c) => c.attention);

  return { chunks, edges, attention };
}

// ── Store interface ───────────────────────────────────────────────────────
interface TokarooState {
  input: {
    text: string;
    model: string;
    mode: SimMode;
  };
  simulation: {
    runId: number;
    chunks: any[];
    edges: any[];
    attention: number[];
    loading: boolean;
    simulationStep: number;
    error: string | null;
    raw: RagResponse | null;
    request: any | null;
  };
  analysis: {
    diagnosis: string | null;
    issues: any[];
    health_score: number;
    recommended_config: Record<string, number> | null;
    actionable_steps: string[];
    system_insight: string | null;
    cause_chain: string[];
    narrative: string[];
    config_warnings: string[];
    result_summary: string | null;
  };
  ui: {
    selectedNode: string | null;
    hoveredNode: string | null;
    view: "graph" | "flow" | "tokens";
  };
  setInput: (data: Partial<TokarooState["input"]>) => void;
  setSimulation: (data: Partial<TokarooState["simulation"]>) => void;
  setAnalysis: (data: Partial<TokarooState["analysis"]>) => void;
  setUI: (data: Partial<TokarooState["ui"]>) => void;
  runSimulation: (fixConfig?: {
    chunk_size: number;
    overlap: number;
    top_k: number;
  }) => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────
export const useStore = create<TokarooState>((set, get) => ({
  input: {
    text: "",
    model: "gpt-4o",
    mode: "balanced",
  },
  simulation: {
    runId: 0,
    chunks: [],
    edges: [],
    attention: [],
    loading: false,
    simulationStep: 0,
    error: null,
    raw: null,
    request: null,
  },
  analysis: {
    diagnosis: null,
    issues: [],
    health_score: 0,
    recommended_config: null,
    actionable_steps: [],
    system_insight: null,
    cause_chain: [],
    narrative: [],
    config_warnings: [],
    result_summary: null,
  },
  ui: {
    selectedNode: null,
    hoveredNode: null,
    view: "graph",
  },

  setInput: (data) => set((s) => ({ input: { ...s.input, ...data } })),
  setSimulation: (data) =>
    set((s) => ({ simulation: { ...s.simulation, ...data } })),
  setAnalysis: (data) => set((s) => ({ analysis: { ...s.analysis, ...data } })),
  setUI: (data) => set((s) => ({ ui: { ...s.ui, ...data } })),

  runSimulation: async (fixConfig) => {
    const { input, simulation } = get();
    const modeConfig = MODE_CONFIGS[input.mode];
    const cfg = fixConfig ?? modeConfig;
    const nextRunId = simulation.runId + 1;

    const requestPayload = {
      text: input.text,
      model: input.model,
      chunk_size: cfg.chunk_size,
      overlap: cfg.overlap,
      top_k: cfg.top_k,
      final_k: Math.min(4, cfg.top_k),
      retrieval_strategy: "relevance_sorted",
      auto_optimize: true,
    };

    set((s) => ({
      ui: { ...s.ui, selectedNode: null, hoveredNode: null, view: "graph" },
      simulation: {
        ...s.simulation,
        runId: nextRunId,
        loading: true,
        simulationStep: 1,
        chunks: [],
        edges: [],
        attention: [],
        error: null,
        raw: null,
        request: requestPayload,
      },
    }));

    // Progressive step reveal (cosmetic, independent of API timing)
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    [2, 3, 4, 5].forEach((step, i) => {
      stepTimers.push(
        setTimeout(
          () => {
            set((s) => ({
              simulation: { ...s.simulation, simulationStep: step },
            }));
          },
          (i + 1) * 650,
        ),
      );
    });

    try {
      const result = await apiRequest<RagResponse>(
        "/simulate-rag",
        requestPayload,
      );
      stepTimers.forEach(clearTimeout);

      const graph = graphFromRagResponse(result, nextRunId);
      const backendIssues = result.optimization.issues ?? [];
      const issues =
        backendIssues.length > 0
          ? backendIssues.map((issue) => ({
              type: issue.type,
              label: issue.type.replaceAll("_", " "),
              severity: severityFromBackend(issue.severity),
            }))
          : [
              {
                type: result.optimization.diagnosis.primary_issue,
                label: result.optimization.diagnosis.short_summary,
                severity: "info" as const,
              },
            ];

      set((s) => ({
        simulation: {
          ...s.simulation,
          runId: nextRunId,
          ...graph,
          loading: false,
          simulationStep: 5,
          error: result.error,
          raw: result,
          request: requestPayload,
        },
        analysis: {
          ...s.analysis,
          health_score: result.optimization.health_score ?? 0,
          issues,
          diagnosis: result.optimization.diagnosis.primary_issue,
          recommended_config: result.optimization.recommended_config ?? null,
          actionable_steps: result.optimization.actionable_steps ?? [],
          system_insight: result.optimization.system_insight ?? null,
          cause_chain: buildCauseChain(result),
          narrative: buildNarrative(result),
          config_warnings: buildConfigWarnings(result),
          result_summary:
            ISSUE_RESULT[result.optimization.diagnosis.primary_issue] ?? null,
        },
      }));
    } catch (error) {
      stepTimers.forEach(clearTimeout);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to reach Tokaroo backend.";
      set((s) => ({
        simulation: {
          ...s.simulation,
          runId: nextRunId,
          loading: false,
          simulationStep: 0,
          chunks: [],
          edges: [],
          attention: [],
          error: message,
          raw: null,
          request: requestPayload,
        },
        analysis: {
          ...s.analysis,
          health_score: 0,
          issues: [
            { type: "backend_unavailable", label: message, severity: "error" },
          ],
          diagnosis: "backend_unavailable",
          recommended_config: null,
          actionable_steps: [],
          system_insight: null,
          cause_chain: [],
          narrative: [],
          config_warnings: [],
          result_summary: null,
        },
      }));
    }
  },
}));
