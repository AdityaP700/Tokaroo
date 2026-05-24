import React, { useMemo } from "react";
import { useStore, MODE_CONFIGS, type SimMode } from "../../store/useStore";

const MODELS = [
  { id: "gpt-4o", label: "GPT-4o", ctx: "128k" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", ctx: "1M" },
  { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", ctx: "1M" },
  { id: "llama-3-8b-instruct", label: "Llama 3 8B", ctx: "8k" },
];

const MODE_META: Record<
  SimMode,
  { label: string; desc: string; warn?: string }
> = {
  fast: {
    label: "Fast",
    desc: "Large chunks · Quick retrieval",
    warn: "May miss fine-grained detail",
  },
  balanced: { label: "Balanced", desc: "Optimal balance · Recommended" },
  deep: {
    label: "Deep",
    desc: "Fine-grained · Thorough",
    warn: "Risk of fragmentation & noise",
  },
};

function Divider() {
  return (
    <div
      style={{ height: "1px", background: "var(--border)", margin: "0.1rem 0" }}
    />
  );
}

export const InputConsole: React.FC = () => {
  const { input, simulation, analysis, setInput, runSimulation } = useStore();

  const cfg = MODE_CONFIGS[input.mode];

  const estimatedTokens = useMemo(
    () => Math.ceil(input.text.length / 4),
    [input.text],
  );
  const estimatedChunks = useMemo(() => {
    if (!input.text.length) return 0;
    const effective = Math.max(1, cfg.chunk_size - cfg.overlap);
    return Math.max(1, Math.ceil(estimatedTokens / effective));
  }, [estimatedTokens, cfg]);

  const isLoading = simulation.loading;
  const canRun = input.text.trim().length > 0 && !isLoading;
  const hasRun = simulation.runId > 0 && !isLoading;

  return (
    <div
      className="panel"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.9rem",
        padding: "1.25rem",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div>
        <div className="label" style={{ marginBottom: "4px" }}>
          Control
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Analysis Intent
        </div>
      </div>

      <Divider />

      {/* Mode selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div className="label">Mode</div>
        <div style={{ display: "flex", gap: "4px" }}>
          {(Object.keys(MODE_CONFIGS) as SimMode[]).map((m) => {
            const active = input.mode === m;
            return (
              <button
                key={m}
                onClick={() => setInput({ mode: m })}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${active ? "var(--border-hi)" : "var(--border)"}`,
                  background: active ? "var(--elevated)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {active ? "● " : "○ "}
                {MODE_META[m].label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            lineHeight: 1.4,
          }}
        >
          {MODE_META[input.mode].desc}
        </div>
      </div>

      {/* System chose */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          background: "var(--elevated)",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div className="label">System chose</div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {[
            { k: "chunk_size", v: cfg.chunk_size },
            { k: "overlap", v: cfg.overlap },
            { k: "top_k", v: cfg.top_k },
          ].map(({ k, v }) => (
            <div
              key={k}
              style={{ display: "flex", gap: "4px", alignItems: "baseline" }}
            >
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {k}:
              </span>
              <span className="value-mono" style={{ fontSize: "12px" }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-run mode warning */}
      {MODE_META[input.mode].warn && !hasRun && (
        <div
          style={{
            padding: "7px 10px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(217,119,6,0.06)",
            border: "1px solid rgba(217,119,6,0.2)",
            fontSize: "11px",
            color: "var(--warning)",
            lineHeight: 1.5,
          }}
        >
          ⚠ {MODE_META[input.mode].warn}
        </div>
      )}

      {/* Post-run config warnings from backend */}
      {hasRun && analysis.config_warnings.length > 0 && (
        <div
          style={{
            padding: "9px 11px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(217,119,6,0.06)",
            border: "1px solid rgba(217,119,6,0.22)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--warning)",
              marginBottom: "2px",
            }}
          >
            ⚠ Bad config detected:
          </div>
          {analysis.config_warnings.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                paddingLeft: "4px",
                lineHeight: 1.45,
              }}
            >
              • {w}
            </div>
          ))}
        </div>
      )}

      <Divider />

      {/* Model */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div className="label">Model</div>
        <select
          value={input.model}
          onChange={(e) => setInput({ model: e.target.value })}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.ctx}
            </option>
          ))}
        </select>
      </div>

      {/* Text */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div className="label">Context Text</div>
        <textarea
          value={input.text}
          onChange={(e) => setInput({ text: e.target.value })}
          placeholder="Paste a document here to analyze how it will be chunked and retrieved…"
          style={{ height: "110px" }}
        />
      </div>

      {/* Live estimates */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          padding: "10px 12px",
          background: "var(--elevated)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="label" style={{ marginBottom: "3px" }}>
            Est. Tokens
          </div>
          <div className="value-mono">
            {estimatedTokens > 0 ? estimatedTokens.toLocaleString() : "—"}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: "3px" }}>
            Est. Chunks
          </div>
          <div className="value-mono">
            {estimatedChunks > 0 ? estimatedChunks : "—"}
          </div>
        </div>
      </div>

      {/* Error */}
      {simulation.error && (
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.28)",
            borderRadius: "var(--radius-sm)",
            color: "var(--danger)",
            fontSize: "12px",
            lineHeight: 1.45,
          }}
        >
          {simulation.error}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Run */}
      <button
        className="btn-primary"
        onClick={() => runSimulation()}
        disabled={!canRun}
        style={{ fontSize: "15px", padding: "0.85rem" }}
      >
        {isLoading ? "Simulating…" : "Run Simulation"}
      </button>
    </div>
  );
};
