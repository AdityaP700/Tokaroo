import React, { useState } from "react";
import { useStore, GRAPH_OVERLAY } from "../../store/useStore";

function Divider() {
  return <div style={{ height: "1px", background: "var(--border)" }} />;
}

function HealthOrb({ score }: { score: number }) {
  const color =
    score >= 80
      ? "var(--success)"
      : score >= 50
        ? "var(--warning)"
        : "var(--danger)";
  const label = score >= 80 ? "Optimal" : score >= 50 ? "Degraded" : "Critical";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: `1px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "4px",
            borderRadius: "50%",
            background: `${color}18`,
          }}
        />
        <span
          className="value-mono"
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color,
            position: "relative",
          }}
        >
          {score}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, color, fontSize: "14px" }}>{label}</div>
        <div className="label" style={{ marginTop: "2px" }}>
          System Health
        </div>
      </div>
    </div>
  );
}

// Cause → Effect vertical chain
function CauseFlow({ chain }: { chain: string[] }) {
  if (!chain.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {chain.map((step, i) => {
        const isFirst = i === 0;
        const isLast = i === chain.length - 1;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: "4px",
                background: isFirst
                  ? "rgba(217,119,6,0.08)"
                  : isLast
                    ? "rgba(220,38,38,0.10)"
                    : "var(--elevated)",
                border: `1px solid ${
                  isFirst
                    ? "rgba(217,119,6,0.28)"
                    : isLast
                      ? "rgba(220,38,38,0.28)"
                      : "var(--border)"
                }`,
                fontSize: "12px",
                color: isFirst
                  ? "var(--warning)"
                  : isLast
                    ? "var(--danger)"
                    : "var(--text-secondary)",
                fontWeight: isFirst || isLast ? 600 : 400,
                fontFamily: isFirst ? "var(--font-mono)" : "inherit",
                lineHeight: 1.4,
              }}
            >
              {step}
            </div>
            {!isLast && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  lineHeight: "1.4",
                  padding: "2px 0",
                }}
              >
                ↓
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// "What went wrong" narrative with numbered items
function FailureNarrative({
  items,
  result,
}: {
  items: string[];
  result: string | null;
}) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: "2px",
        }}
      >
        📉 What went wrong:
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontWeight: 700,
              flexShrink: 0,
              marginTop: "1px",
              fontFamily: "var(--font-mono)",
            }}
          >
            {i + 1}.
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: 1.55,
            }}
          >
            {item}
          </span>
        </div>
      ))}
      {result && (
        <div
          style={{
            marginTop: "6px",
            padding: "8px 10px",
            borderRadius: "4px",
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
            fontSize: "12px",
            color: "var(--danger)",
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          → Result: {result}
        </div>
      )}
    </div>
  );
}

export const AnalysisEngine: React.FC = () => {
  const { analysis, simulation, ui, setUI, runSimulation } = useStore();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const selectedChunk = simulation.chunks.find((c) => c.id === ui.selectedNode);
  const hasResult = simulation.runId > 0 && !simulation.loading;
  const overlay = analysis.diagnosis ? GRAPH_OVERLAY[analysis.diagnosis] : null;

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
          Diagnosis
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Failure Narrative
        </div>
      </div>

      <Divider />

      {/* Health orb */}
      <HealthOrb score={analysis.health_score} />

      {/* Primary issue badge */}
      {hasResult && overlay && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            padding: "7px 10px",
            borderRadius: "var(--radius-sm)",
            background: `${overlay.color}11`,
            border: `1px solid ${overlay.color}33`,
            fontSize: "11px",
            fontWeight: 600,
            color: overlay.color,
          }}
        >
          <span style={{ flexShrink: 0 }}>{overlay.icon}</span>
          <span style={{ lineHeight: 1.4 }}>{overlay.text}</span>
        </div>
      )}

      {/* Empty state */}
      {!hasResult && !simulation.loading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
            padding: "2rem 1rem",
          }}
        >
          <div style={{ fontSize: "22px", opacity: 0.35 }}>📊</div>
          <div style={{ lineHeight: 1.55 }}>
            Run a simulation to see
            <br />
            the failure narrative
          </div>
        </div>
      )}

      {/* Loading state */}
      {simulation.loading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: "var(--text-primary)",
              animation: "spin 0.7s linear infinite",
            }}
          />
          Analyzing…
        </div>
      )}

      {/* Main content */}
      {hasResult && (
        <div
          className="fade-in"
          style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
        >
          {/* What went wrong */}
          <FailureNarrative
            items={analysis.narrative}
            result={analysis.result_summary}
          />

          <Divider />

          {/* Cause → Effect flow */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div className="label" style={{ marginBottom: "2px" }}>
              Cause → Effect
            </div>
            <CauseFlow chain={analysis.cause_chain} />
          </div>

          {/* Fix button */}
          {analysis.recommended_config && (
            <>
              <Divider />
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(22,163,74,0.06)",
                  border: "1px solid rgba(22,163,74,0.2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  Optimal configuration found:
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {Object.entries(analysis.recommended_config).map(([k, v]) => (
                    <span
                      key={k}
                      style={{
                        padding: "2px 7px",
                        borderRadius: "3px",
                        background: "rgba(22,163,74,0.08)",
                        border: "1px solid rgba(22,163,74,0.18)",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--success)",
                      }}
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const cfg = analysis.recommended_config!;
                    if (
                      "chunk_size" in cfg &&
                      "overlap" in cfg &&
                      "top_k" in cfg
                    ) {
                      runSimulation({
                        chunk_size: cfg.chunk_size,
                        overlap: cfg.overlap,
                        top_k: cfg.top_k,
                      });
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(22,163,74,0.12)",
                    border: "1px solid rgba(22,163,74,0.3)",
                    color: "var(--success)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Fix Configuration →
                </button>
              </div>
            </>
          )}

          {/* Actionable steps */}
          {analysis.actionable_steps.length > 0 && (
            <>
              <Divider />
              <details
                open={stepsOpen}
                onToggle={(e) =>
                  setStepsOpen((e.target as HTMLDetailsElement).open)
                }
                style={{
                  background: "var(--elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "9px 10px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 700,
                    userSelect: "none",
                  }}
                >
                  Actionable steps ({analysis.actionable_steps.length})
                </summary>
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {analysis.actionable_steps.map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--text-muted)",
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: "2px",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {i + 1}.
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}

          {/* Selected chunk detail */}
          {selectedChunk && (
            <>
              <Divider />
              <div
                className="fade-in"
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <div className="label">Selected Chunk</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {[
                    { k: "Tokens", v: `${selectedChunk.size}` },
                    {
                      k: "Relevance",
                      v: `${(selectedChunk.relevance * 100).toFixed(1)}%`,
                    },
                    {
                      k: "Attention",
                      v: `${(selectedChunk.attention * 100).toFixed(1)}%`,
                    },
                    {
                      k: "Risk",
                      v: selectedChunk.risk_label ?? selectedChunk.risk_level,
                    },
                    ...(selectedChunk.lost_reason
                      ? [
                          {
                            k: "Lost reason",
                            v: (selectedChunk.lost_reason as string).replaceAll(
                              "_",
                              " ",
                            ),
                          },
                        ]
                      : []),
                  ].map(({ k, v }) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ color: "var(--text-muted)", fontSize: "12px" }}
                      >
                        {k}
                      </span>
                      <span
                        className="value-mono"
                        style={{
                          fontSize: "12px",
                          color:
                            k === "Risk" && selectedChunk.risk_level === "high"
                              ? "var(--danger)"
                              : "var(--text-primary)",
                        }}
                      >
                        {v as string}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    padding: "7px 9px",
                    background: "var(--elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.55,
                    maxHeight: "64px",
                    overflowY: "auto",
                  }}
                >
                  {selectedChunk.boundary_snippet}
                </div>
                <button
                  className="btn-ghost"
                  onClick={() => setUI({ selectedNode: null })}
                  style={{ width: "100%" }}
                >
                  Clear selection
                </button>
              </div>
            </>
          )}

          {/* Debug */}
          {simulation.raw && (
            <>
              <Divider />
              <details
                open={debugOpen}
                onToggle={(e) =>
                  setDebugOpen((e.target as HTMLDetailsElement).open)
                }
                style={{
                  background: "var(--elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "9px 10px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                    fontWeight: 700,
                    userSelect: "none",
                  }}
                >
                  Debug · backend response
                </summary>
                <pre
                  style={{
                    marginTop: "8px",
                    maxHeight: "180px",
                    overflow: "auto",
                    color: "var(--text-muted)",
                    fontSize: "10px",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {JSON.stringify(simulation.raw, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
};
