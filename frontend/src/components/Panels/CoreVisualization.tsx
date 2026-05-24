import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Maximize2, MousePointer2, RotateCcw, Sparkles } from "lucide-react";
import { useStore, GRAPH_OVERLAY } from "../../store/useStore";

// ── Step labels for progressive loading ──────────────────────────────────
const SIMULATION_STEPS = [
  "Input accepted",
  "Chunking document",
  "Retrieving top chunks",
  "Computing attention weights",
  "Diagnosing failure patterns",
] as const;

// ── Neighbour map ─────────────────────────────────────────────────────────
function buildNeighbourMap(edges: any[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  edges.forEach(({ source, target }) => {
    const sId = typeof source === "object" ? source.id : source;
    const tId = typeof target === "object" ? target.id : target;
    if (!map.has(sId)) map.set(sId, new Set());
    if (!map.has(tId)) map.set(tId, new Set());
    map.get(sId)!.add(tId);
    map.get(tId)!.add(sId);
  });
  return map;
}

// ── Ghost nodes for empty state ───────────────────────────────────────────
function GhostNodes() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "relative", width: "120px", height: "80px" }}>
        {[
          { x: 20, y: 10, r: 10, delay: "0s" },
          { x: 55, y: 30, r: 16, delay: "0.3s" },
          { x: 90, y: 15, r: 8, delay: "0.6s" },
          { x: 35, y: 55, r: 12, delay: "0.9s" },
          { x: 75, y: 50, r: 6, delay: "1.2s" },
        ].map((n, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: n.x - n.r,
              top: n.y - n.r,
              width: n.r * 2,
              height: n.r * 2,
              borderRadius: "50%",
              background: "var(--border-hi)",
              animation: `pulse 2.5s ease-in-out ${n.delay} infinite`,
            }}
          />
        ))}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <line
            x1="20"
            y1="10"
            x2="55"
            y2="30"
            stroke="var(--border)"
            strokeWidth="1"
          />
          <line
            x1="55"
            y1="30"
            x2="90"
            y2="15"
            stroke="var(--border)"
            strokeWidth="1"
          />
          <line
            x1="55"
            y1="30"
            x2="35"
            y2="55"
            stroke="var(--border)"
            strokeWidth="1"
          />
        </svg>
      </div>
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: "13px",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        No simulation yet
        <br />
        <span style={{ fontSize: "11px" }}>Configure and run ▶</span>
      </div>
    </div>
  );
}

// ── Token Context Strip ───────────────────────────────────────────────────
function TokenContextStrip() {
  const { simulation, ui, setUI } = useStore();
  const maxTokens = useMemo(
    () => Math.max(1, ...simulation.chunks.map((c) => c.size)),
    [simulation.chunks],
  );
  const isEmpty = simulation.chunks.length === 0;

  if (isEmpty) {
    return (
      <div
        style={{
          padding: "4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Run simulation to view context strip
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "3rem 2rem",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "1.5rem",
        overflowY: "auto",
      }}
    >
      <div className="label">Context Window · Linear View</div>
      <div
        style={{
          display: "flex",
          gap: "2px",
          height: "64px",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        {simulation.chunks.map((chunk, i) => {
          const isSelected = ui.selectedNode === chunk.id;
          const isHovered = ui.hoveredNode === chunk.id;
          const attention = simulation.attention[i] ?? 0;
          const isRisk = chunk.risk_level === "high";
          const widthPct = (chunk.size / maxTokens) * 100;
          const brightness = attention * 0.7 + 0.05;
          return (
            <div
              key={chunk.id}
              onClick={() =>
                setUI({ selectedNode: isSelected ? null : chunk.id })
              }
              onMouseEnter={() => setUI({ hoveredNode: chunk.id })}
              onMouseLeave={() => setUI({ hoveredNode: null })}
              style={{
                flex: `${widthPct} 0 0`,
                minWidth: "10px",
                background: isSelected
                  ? "#FAFAFA"
                  : isHovered
                    ? `rgba(250,250,250,${Math.min(brightness + 0.2, 0.85).toFixed(2)})`
                    : `rgba(250,250,250,${brightness.toFixed(2)})`,
                borderRadius: "3px",
                cursor: "pointer",
                transition: "all 0.15s",
                position: "relative",
                borderBottom: isRisk ? "3px solid var(--danger)" : "none",
                boxShadow: isSelected
                  ? "0 0 10px rgba(255,255,255,0.12)"
                  : "none",
                opacity: ui.selectedNode && !isSelected ? 0.3 : 1,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1px",
                  fontSize: "9px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  color: isSelected
                    ? "#000"
                    : `rgba(0,0,0,${Math.min(brightness * 2, 0.5).toFixed(2)})`,
                  pointerEvents: "none",
                }}
              >
                <div>{i + 1}</div>
                <div style={{ fontSize: "7px" }}>{chunk.size}t</div>
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        <span>◻ Width = token count</span>
        <span>◼ Brightness = attention</span>
        <span style={{ color: "var(--danger)" }}>— Red = risk</span>
      </div>
      {ui.selectedNode &&
        (() => {
          const chunk = simulation.chunks.find((c) => c.id === ui.selectedNode);
          if (!chunk) return null;
          const idx = simulation.chunks.indexOf(chunk);
          return (
            <div
              className="fade-in"
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--elevated)",
                border: "1px solid var(--border)",
                display: "flex",
                gap: "2rem",
                alignItems: "center",
                fontSize: "13px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span style={{ color: "var(--text-muted)" }}>Chunk </span>
                <span className="value-mono">{idx + 1}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Tokens </span>
                <span className="value-mono">{chunk.size}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Attn </span>
                <span className="value-mono">
                  {((simulation.attention[idx] ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Rel </span>
                <span className="value-mono">
                  {(chunk.relevance * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                <span
                  style={{
                    color:
                      chunk.risk_level === "high"
                        ? "var(--danger)"
                        : "var(--text-muted)",
                  }}
                >
                  {chunk.risk_level === "high" ? "● HIGH RISK" : "○ Normal"}
                </span>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ── Attention heatmap view ────────────────────────────────────────────────
function AttentionView() {
  const { simulation, ui, setUI } = useStore();
  const isEmpty = simulation.attention.length === 0;

  if (isEmpty) {
    return (
      <div
        style={{
          padding: "3rem",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
        }}
      >
        Run a simulation to view attention heatmap
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "3rem 2.5rem",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "1rem",
      }}
    >
      <div className="label" style={{ marginBottom: "0.5rem" }}>
        Attention Distribution
      </div>
      <div
        style={{
          display: "flex",
          height: "56px",
          borderRadius: "6px",
          overflow: "hidden",
          gap: "2px",
        }}
      >
        {simulation.attention.map((a, i) => {
          const chunk = simulation.chunks[i];
          const isSelected = chunk?.id === ui.selectedNode;
          const isHovered = chunk?.id === ui.hoveredNode;
          return (
            <div
              key={i}
              title={`Chunk ${i + 1}: ${(a * 100).toFixed(0)}%`}
              style={{
                flex: 1,
                background: isSelected
                  ? "#FAFAFA"
                  : `rgba(250,250,250,${(a * 0.8).toFixed(2)})`,
                borderRadius: "3px",
                transition: "all 0.15s",
                cursor: "pointer",
                outline: isHovered
                  ? "1px solid rgba(255,255,255,0.3)"
                  : isSelected
                    ? "1px solid #fff"
                    : "none",
                opacity: ui.selectedNode && !isSelected ? 0.3 : 1,
              }}
              onClick={() => setUI({ selectedNode: chunk?.id ?? null })}
              onMouseEnter={() => setUI({ hoveredNode: chunk?.id ?? null })}
              onMouseLeave={() => setUI({ hoveredNode: null })}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>Low attention</span>
        <span>High attention</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export const CoreVisualization: React.FC = () => {
  const { simulation, analysis, ui, setUI } = useStore();
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isInspecting, setIsInspecting] = useState(false);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Physics setup
  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force("charge")?.strength(-260);
    fgRef.current
      .d3Force("link")
      ?.distance((link: any) => 80 - Math.min(45, (link.weight ?? 0.4) * 45));
    fgRef.current.d3ReheatSimulation?.();
    window.setTimeout(() => {
      fgRef.current?.zoomToFit?.(650, 80);
    }, 120);
  }, [simulation.runId, simulation.chunks.length]);

  // Neighbour map
  const neighbourMap = useMemo(
    () => buildNeighbourMap(simulation.edges),
    [simulation.edges],
  );

  // Graph data
  const graphData = useMemo(
    () => ({
      nodes: simulation.chunks.map((c, i) => ({
        ...c,
        val: Math.max(1, c.size / 60),
        seed: i,
      })),
      links: simulation.edges.map((edge, i) => ({
        ...edge,
        id: `${simulation.runId}-edge-${i}`,
      })),
    }),
    [simulation.runId, simulation.chunks, simulation.edges],
  );

  // Handlers
  const handleNodeHover = useCallback(
    (node: any) => {
      setUI({ hoveredNode: node ? node.id : null });
    },
    [setUI],
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      const alreadySelected = ui.selectedNode === node.id;
      setUI({ selectedNode: alreadySelected ? null : node.id });
      if (!alreadySelected && fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(2.0, 700);
        setIsInspecting(true);
      } else if (alreadySelected && fgRef.current) {
        fgRef.current.zoom(1, 400);
        setIsInspecting(false);
      }
    },
    [ui.selectedNode, setUI],
  );

  const handleBgClick = useCallback(() => {
    if (ui.selectedNode) {
      setUI({ selectedNode: null });
      fgRef.current?.zoom(1, 400);
      setIsInspecting(false);
    }
  }, [ui.selectedNode, setUI]);

  const fitGraph = useCallback(() => {
    fgRef.current?.zoomToFit?.(650, 90);
    setIsInspecting(false);
  }, []);

  const releasePinnedNodes = useCallback(() => {
    simulation.chunks.forEach((node) => {
      node.fx = undefined;
      node.fy = undefined;
    });
    fgRef.current?.d3ReheatSimulation?.();
  }, [simulation.chunks]);

  // ── Node painter — cause visualization ───────────────────────────────────
  const renderNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { selectedNode, hoveredNode } = useStore.getState().ui;
      const rawState = useStore.getState().simulation.raw;
      const ignored = new Set(rawState?.ignored_relevant_chunks ?? []);

      const isSelected = selectedNode === node.id;
      const isHovered = hoveredNode === node.id;
      const isNeighbour = selectedNode
        ? (neighbourMap.get(selectedNode)?.has(node.id) ?? false)
        : false;
      const isIgnored = ignored.has(node.chunk_index); // high relevance but positionally lost
      const lostReason = node.lost_reason as string | null;

      const hasFocus = selectedNode === null || isSelected || isNeighbour;
      const opacity = hasFocus ? 1 : 0.1;
      const attention = Math.max(0, Math.min(1, node.attention ?? 0));
      const relevance = Math.max(0, Math.min(1, node.relevance ?? 0));
      const radius = Math.max(5, Math.min(22, 5 + node.size / 18));

      // ── Semantic coloring by lost_reason / state ──────────────────────────
      let fill = `rgba(110,118,129,${(0.35 + attention * 0.45).toFixed(2)})`;
      let shadowColor = "transparent";
      let shadowBlur = 4 + attention * 12;
      let stroke = "transparent";

      if (isSelected) {
        fill = "#FFFFFF";
        shadowColor = "rgba(255,255,255,0.18)";
        shadowBlur = 24;
        stroke = "#FFFFFF";
      } else if (isIgnored) {
        // High relevance, ignored by position → red (the "wasted signal" nodes)
        fill = `rgba(239,68,68,${(0.35 + relevance * 0.35).toFixed(2)})`;
        shadowColor = "rgba(239,68,68,0.45)";
        shadowBlur = 14 + relevance * 8;
        stroke = `rgba(239,68,68,0.55)`;
      } else if (lostReason === "noise_attended") {
        // Noise stealing attention → orange
        fill = `rgba(249,115,22,${(0.3 + attention * 0.4).toFixed(2)})`;
        shadowColor = "rgba(249,115,22,0.25)";
        shadowBlur = 8 + attention * 10;
      } else if (lostReason === "lost_in_middle") {
        // Middle decay → muted gray, dim
        fill = `rgba(75,85,99,${(0.2 + attention * 0.2).toFixed(2)})`;
        shadowColor = "transparent";
        shadowBlur = 2;
      } else if (lostReason === "low_relevance") {
        // Very low relevance → barely visible
        fill = `rgba(55,65,81,${(0.12 + attention * 0.12).toFixed(2)})`;
        shadowColor = "transparent";
        shadowBlur = 1;
      } else if (lostReason === "context_dilution") {
        // Context dilution → indigo tint
        fill = `rgba(99,102,241,${(0.25 + attention * 0.3).toFixed(2)})`;
        shadowColor = "rgba(99,102,241,0.15)";
      } else if (node.used_by_model) {
        // Actively used → brightness = attention + relevance (the "working" nodes)
        const b = 0.4 + relevance * 0.45;
        fill = `rgba(232,240,255,${b.toFixed(2)})`;
        shadowColor = `rgba(255,255,255,${(0.06 + attention * 0.14).toFixed(2)})`;
        shadowBlur = 6 + attention * 16;
      } else if (isNeighbour) {
        fill = "#A1A1AA";
        shadowColor = "rgba(255,255,255,0.14)";
      } else if (isHovered) {
        stroke = "#525252";
        shadowBlur = 12;
        shadowColor = "rgba(255,255,255,0.08)";
      }

      ctx.globalAlpha = opacity;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowColor = shadowColor;

      // Outer halo ring (for used / selected / hovered / ignored nodes)
      if (isSelected || isHovered || node.used_by_model || isIgnored) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 7 + attention * 8, 0, 2 * Math.PI);
        ctx.strokeStyle = isIgnored
          ? `rgba(239,68,68,${(0.2 + relevance * 0.15).toFixed(2)})`
          : `rgba(255,255,255,${(0.05 + attention * 0.12).toFixed(2)})`;
        ctx.lineWidth = (isSelected ? 2.2 : 1.2) / globalScale;
        ctx.stroke();
      }

      // Main fill
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();

      // Border stroke
      if (stroke !== "transparent") {
        ctx.lineWidth = 1.5 / globalScale;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Label for selected node
      if (isSelected) {
        const label = node.display_id ?? node.id;
        const fontSize = Math.max(8, 10 / globalScale);
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = "rgba(250,250,250,0.7)";
        ctx.textAlign = "center";
        ctx.fillText(label, node.x, node.y + radius + fontSize * 1.4);
      }
    },
    [neighbourMap],
  );

  const isEmpty = simulation.chunks.length === 0;

  const graphStats = useMemo(() => {
    const used = simulation.chunks.filter((c) => c.used_by_model).length;
    const risk = simulation.chunks.filter(
      (c) => c.risk_level === "high",
    ).length;
    const waste =
      simulation.raw?.attention_waste != null
        ? `${Math.round(simulation.raw.attention_waste * 100)}%`
        : "—";
    return { used, risk, waste };
  }, [simulation.chunks, simulation.raw]);

  const overlay = analysis.diagnosis ? GRAPH_OVERLAY[analysis.diagnosis] : null;

  return (
    <div
      ref={containerRef}
      className="panel graph-stage"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="graph-aurora" />

      {/* View tabs */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "2px",
          zIndex: 10,
          background: "var(--elevated)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "3px",
        }}
      >
        {(["graph", "tokens", "attention"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setUI({ view: v })}
            style={{
              padding: "0.3rem 0.85rem",
              borderRadius: "5px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              letterSpacing: "0.04em",
              transition: "all 0.15s",
              fontFamily: "var(--font-sans)",
              background: ui.view === v ? "var(--surface)" : "transparent",
              color:
                ui.view === v ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {v === "tokens"
              ? "Context"
              : v === "graph"
                ? "Cause Graph"
                : "Attention"}
          </button>
        ))}
      </div>

      {/* Top-left status badge */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "7px 10px",
          borderRadius: "999px",
          background: "rgba(18,18,18,0.72)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(14px)",
          color: "var(--text-secondary)",
          fontSize: "12px",
        }}
      >
        <Sparkles size={14} />
        <span>
          {isEmpty
            ? "Awaiting context"
            : analysis.diagnosis
              ? analysis.diagnosis.replaceAll("_", " ")
              : `Run ${simulation.runId}`}
        </span>
      </div>

      {/* Top-right stats */}
      {!isEmpty && (
        <div
          style={{
            position: "absolute",
            right: "1rem",
            top: "1rem",
            zIndex: 10,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(70px, 1fr))",
            gap: "6px",
          }}
        >
          {[
            {
              k: "In Prompt",
              v: `${graphStats.used}/${simulation.chunks.length}`,
              danger: false,
            },
            {
              k: "Risk Nodes",
              v: String(graphStats.risk),
              danger: graphStats.risk > 0,
            },
            {
              k: "Attn Waste",
              v: graphStats.waste,
              danger: graphStats.risk > 0,
            },
          ].map((item) => (
            <div
              key={item.k}
              style={{
                padding: "7px 9px",
                borderRadius: "8px",
                background: "rgba(18,18,18,0.72)",
                border: `1px solid ${item.danger ? "rgba(220,38,38,0.42)" : "var(--border)"}`,
                backdropFilter: "blur(14px)",
              }}
            >
              <div
                className="label"
                style={{ fontSize: "9px", marginBottom: "1px" }}
              >
                {item.k}
              </div>
              <div
                className="value-mono"
                style={{
                  color: item.danger ? "var(--danger)" : "var(--text-primary)",
                  fontSize: "13px",
                }}
              >
                {item.v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom-left controls */}
      <div
        style={{
          position: "absolute",
          left: "1rem",
          bottom: "1rem",
          zIndex: 10,
          display: "flex",
          gap: "6px",
          alignItems: "center",
        }}
      >
        <button
          className="btn-ghost icon-btn"
          onClick={fitGraph}
          title="Fit graph"
        >
          <Maximize2 size={14} />
          <span>Fit</span>
        </button>
        <button
          className="btn-ghost icon-btn"
          onClick={releasePinnedNodes}
          title="Release nodes"
        >
          <RotateCcw size={14} />
          <span>Release</span>
        </button>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-muted)",
            fontSize: "11px",
            marginLeft: "4px",
          }}
        >
          <MousePointer2 size={13} />
          <span>
            {isInspecting ? "Inspecting chunk" : "Drag · hover · click"}
          </span>
        </div>
      </div>

      {/* Node legend (graph view only) */}
      {!isEmpty && ui.view === "graph" && (
        <div
          style={{
            position: "absolute",
            right: "1rem",
            bottom: "1rem",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(18,18,18,0.82)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(12px)",
          }}
        >
          {[
            { color: "rgba(232,240,255,0.85)", label: "Used · high attention" },
            { color: "rgba(239,68,68,0.75)", label: "Ignored (wasted signal)" },
            { color: "rgba(249,115,22,0.75)", label: "Noise attended" },
            { color: "rgba(75,85,99,0.55)", label: "Lost in middle" },
            { color: "rgba(99,102,241,0.55)", label: "Context dilution" },
            { color: "rgba(55,65,81,0.4)", label: "Low relevance" },
          ].map(({ color, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "10px",
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Diagnosis overlay pill */}
      {!isEmpty && overlay && ui.view === "graph" && (
        <div
          style={{
            position: "absolute",
            bottom: "3.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            padding: "7px 16px",
            borderRadius: "999px",
            background: "rgba(10,10,10,0.88)",
            border: `1px solid ${overlay.color}44`,
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: "12px" }}>{overlay.icon}</span>
          <span
            style={{ fontSize: "11px", color: overlay.color, fontWeight: 600 }}
          >
            {overlay.text}
          </span>
        </div>
      )}

      {/* ── GRAPH view ──────────────────────────────────────────────────── */}
      {ui.view === "graph" && (
        <>
          <ForceGraph2D
            key={`graph-${simulation.runId}-${dimensions.width}x${dimensions.height}`}
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeCanvasObject={renderNode}
            nodeCanvasObjectMode={() => "replace"}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBgClick}
            onNodeDragEnd={(node: any) => {
              node.fx = node.x;
              node.fy = node.y;
            }}
            linkColor={(link: any) => {
              const w = link.weight ?? 0.5;
              if (w < 0.3) return "rgba(239,68,68,0.3)"; // weak semantic → red
              if (w < 0.5) return "rgba(249,115,22,0.2)"; // moderate → orange
              return "rgba(255,255,255,0.12)"; // strong → white
            }}
            linkWidth={(link: any) => Math.max(0.5, (link.weight ?? 0.5) * 2)}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.003}
            linkDirectionalParticleWidth={1.2}
            linkDirectionalParticleColor={() => "rgba(255,255,255,0.3)"}
            backgroundColor="transparent"
            cooldownTicks={100}
          />
          {isEmpty && <GhostNodes />}
        </>
      )}

      {ui.view === "tokens" && <TokenContextStrip />}
      {ui.view === "attention" && <AttentionView />}

      {/* ── Progressive loading overlay ──────────────────────────────────── */}
      {simulation.loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10,10,10,0.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.55rem",
            zIndex: 20,
          }}
        >
          <div
            style={{
              marginBottom: "0.5rem",
              color: "var(--text-muted)",
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Simulating
          </div>

          {SIMULATION_STEPS.map((step, i) => {
            const stepNum = i + 1;
            const isDone = simulation.simulationStep > stepNum;
            const isActive = simulation.simulationStep === stepNum;
            return (
              <div
                key={step}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  opacity: stepNum > simulation.simulationStep ? 0.25 : 1,
                  transition: "opacity 0.4s ease",
                }}
              >
                {/* Step indicator circle */}
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDone
                      ? "rgba(22,163,74,0.18)"
                      : isActive
                        ? "var(--elevated)"
                        : "transparent",
                    border: isDone
                      ? "1px solid rgba(22,163,74,0.5)"
                      : isActive
                        ? "1px solid var(--border-hi)"
                        : "1px solid var(--border)",
                    transition: "all 0.4s ease",
                  }}
                >
                  {isDone ? (
                    <span style={{ color: "var(--success)", fontSize: "11px" }}>
                      ✓
                    </span>
                  ) : (
                    <span
                      style={{
                        color: isActive
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                      }}
                    >
                      {stepNum}
                    </span>
                  )}
                </div>

                {/* Step label */}
                <span
                  style={{
                    fontSize: "12px",
                    minWidth: "180px",
                    fontWeight: isActive ? 600 : 400,
                    color: isDone
                      ? "var(--text-muted)"
                      : isActive
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    transition: "color 0.3s",
                  }}
                >
                  {step}
                </span>

                {/* Active spinner */}
                {isActive && (
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      border: "1.5px solid var(--border)",
                      borderTopColor: "var(--text-primary)",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
