import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useStore } from '../../store/useStore';
import { mockSimulation } from '../../api/mockSimulation';

// ── Neighbour map ─────────────────────────────────────────────────────────
function buildNeighbourMap(edges: any[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  edges.forEach(({ source, target }) => {
    const sId = typeof source === 'object' ? source.id : source;
    const tId = typeof target === 'object' ? target.id : target;
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
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1.25rem',
      pointerEvents: 'none',
    }}>
      {/* Animated ghost cluster */}
      <div style={{ position: 'relative', width: '120px', height: '80px' }}>
        {[
          { x: 20, y: 10, r: 10, delay: '0s' },
          { x: 55, y: 30, r: 16, delay: '0.3s' },
          { x: 90, y: 15, r: 8, delay: '0.6s' },
          { x: 35, y: 55, r: 12, delay: '0.9s' },
          { x: 75, y: 50, r: 6, delay: '1.2s' },
        ].map((n, i) => (
          <div key={i} style={{
            position: 'absolute', left: n.x - n.r, top: n.y - n.r,
            width: n.r * 2, height: n.r * 2, borderRadius: '50%',
            background: 'var(--border-hi)',
            animation: `pulse 2.5s ease-in-out ${n.delay} infinite`,
          }} />
        ))}
        {/* Ghost edges */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <line x1="20" y1="10" x2="55" y2="30" stroke="var(--border)" strokeWidth="1" />
          <line x1="55" y1="30" x2="90" y2="15" stroke="var(--border)" strokeWidth="1" />
          <line x1="55" y1="30" x2="35" y2="55" stroke="var(--border)" strokeWidth="1" />
        </svg>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', lineHeight: 1.5 }}>
        No simulation yet<br />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configure parameters and run ▶</span>
      </div>
    </div>
  );
}

// ── Token Context Strip (inline in graph panel) ───────────────────────────
function TokenContextStrip() {
  const { simulation, ui, setUI } = useStore();
  const maxTokens = useMemo(() => Math.max(1, ...simulation.chunks.map(c => c.size)), [simulation.chunks]);
  const isEmpty = simulation.chunks.length === 0;

  if (isEmpty) {
    return (
      <div style={{ padding: '4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Run simulation to view context strip</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 2rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5rem', overflowY: 'auto' }}>
      <div className="label">Context Window · Linear View</div>

      {/* Main strip */}
      <div style={{ display: 'flex', gap: '2px', height: '64px', borderRadius: '6px', overflow: 'hidden' }}>
        {simulation.chunks.map((chunk, i) => {
          const isSelected = ui.selectedNode === chunk.id;
          const isHovered  = ui.hoveredNode === chunk.id;
          const attention  = simulation.attention[i] ?? 0;
          const isRisk     = chunk.risk_level === 'high';
          const widthPct   = (chunk.size / maxTokens) * 100;
          const brightness = attention * 0.7 + 0.05;

          return (
            <div key={chunk.id}
              onClick={() => setUI({ selectedNode: isSelected ? null : chunk.id })}
              onMouseEnter={() => setUI({ hoveredNode: chunk.id })}
              onMouseLeave={() => setUI({ hoveredNode: null })}
              style={{
                flex: `${widthPct} 0 0`, minWidth: '10px',
                background: isSelected ? '#FAFAFA'
                  : isHovered ? `rgba(250,250,250,${Math.min(brightness + 0.2, 0.85).toFixed(2)})`
                  : `rgba(250,250,250,${brightness.toFixed(2)})`,
                borderRadius: '3px', cursor: 'pointer',
                transition: 'all 0.15s', position: 'relative',
                borderBottom: isRisk ? '3px solid var(--danger)' : 'none',
                boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.12)' : 'none',
                opacity: ui.selectedNode && !isSelected ? 0.3 : 1,
              }}
            >
              {/* Inline label */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '1px',
                fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: isSelected ? '#000' : `rgba(0,0,0,${Math.min(brightness * 2, 0.5).toFixed(2)})`,
                pointerEvents: 'none',
              }}>
                <div>{i + 1}</div>
                <div style={{ fontSize: '7px' }}>{chunk.size}t</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>◻ Width = token count</span>
        <span>◼ Brightness = attention</span>
        <span style={{ color: 'var(--danger)' }}>— Red = risk</span>
      </div>

      {/* Selected detail inline */}
      {ui.selectedNode && (() => {
        const chunk = simulation.chunks.find(c => c.id === ui.selectedNode);
        if (!chunk) return null;
        const idx = simulation.chunks.indexOf(chunk);
        return (
          <div className="fade-in" style={{
            padding: '12px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--elevated)', border: '1px solid var(--border)',
            display: 'flex', gap: '2rem', alignItems: 'center', fontSize: '13px',
          }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Chunk</span> <span className="value-mono">{idx + 1}</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Tokens</span> <span className="value-mono">{chunk.size}</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Attention</span> <span className="value-mono">{((simulation.attention[idx] ?? 0) * 100).toFixed(0)}%</span></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Relevance</span> <span className="value-mono">{(chunk.relevance * 100).toFixed(0)}%</span></div>
            <div>
              <span style={{ color: chunk.risk_level === 'high' ? 'var(--danger)' : 'var(--text-muted)' }}>
                {chunk.risk_level === 'high' ? '● HIGH RISK' : '○ Normal'}
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
      <div style={{ padding: '3rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Run a simulation to view attention heatmap
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 2.5rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
      <div className="label" style={{ marginBottom: '0.5rem' }}>Attention Distribution</div>
      <div style={{ display: 'flex', height: '56px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
        {simulation.attention.map((a, i) => {
          const chunk = simulation.chunks[i];
          const isSelected = chunk?.id === ui.selectedNode;
          const isHovered  = chunk?.id === ui.hoveredNode;
          return (
            <div key={i}
              title={`Chunk ${i + 1}: ${(a * 100).toFixed(0)}%`}
              style={{
                flex: 1,
                background: isSelected ? '#FAFAFA' : `rgba(250,250,250,${(a * 0.8).toFixed(2)})`,
                borderRadius: '3px', transition: 'all 0.15s', cursor: 'pointer',
                outline: isHovered ? '1px solid rgba(255,255,255,0.3)' : isSelected ? '1px solid #fff' : 'none',
                opacity: ui.selectedNode && !isSelected ? 0.3 : 1,
              }}
              onClick={() => setUI({ selectedNode: chunk?.id ?? null })}
              onMouseEnter={() => setUI({ hoveredNode: chunk?.id ?? null })}
              onMouseLeave={() => setUI({ hoveredNode: null })}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        <span>Low attention</span><span>High attention</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export const CoreVisualization: React.FC = () => {
  const { simulation, ui, setUI, setSimulation } = useStore();
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Physics
  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force('charge')?.strength(-200);
  }, [simulation.chunks]);

  // Neighbour map
  const neighbourMap = useMemo(() => buildNeighbourMap(simulation.edges), [simulation.edges]);

  // Graph data
  const graphData = useMemo(() => ({
    nodes: simulation.chunks.map(c => ({ ...c, val: Math.max(1, c.size / 60) })),
    links: simulation.edges,
  }), [simulation.chunks, simulation.edges]);

  // Handlers
  const handleNodeHover = useCallback((node: any) => {
    setUI({ hoveredNode: node ? node.id : null });
  }, [setUI]);

  const handleNodeClick = useCallback((node: any) => {
    const alreadySelected = ui.selectedNode === node.id;
    setUI({ selectedNode: alreadySelected ? null : node.id });
    if (!alreadySelected && fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 600);
      fgRef.current.zoom(2.0, 700);
    } else if (alreadySelected && fgRef.current) {
      fgRef.current.zoom(1, 400);
    }
  }, [ui.selectedNode, setUI]);

  const handleBgClick = useCallback(() => {
    if (ui.selectedNode) {
      setUI({ selectedNode: null });
      fgRef.current?.zoom(1, 400);
    }
  }, [ui.selectedNode, setUI]);

  // Node painter
  const renderNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { selectedNode, hoveredNode } = useStore.getState().ui;

    const isSelected  = selectedNode === node.id;
    const isHovered   = hoveredNode  === node.id;
    const isNeighbour = selectedNode ? (neighbourMap.get(selectedNode)?.has(node.id) ?? false) : false;
    const isRisk      = node.risk_level === 'high';

    const hasFocus = selectedNode === null || isSelected || isNeighbour;
    const opacity  = hasFocus ? 1 : 0.1;
    const radius   = Math.max(4, (node.size / 60) * 4);

    let fill = '#2A2A2A';
    let stroke = 'transparent';
    let shadowBlur = 0;
    let shadowColor = 'transparent';

    if (isRisk)          { fill = '#DC2626'; }
    else if (isSelected) { fill = '#FFFFFF'; }
    else if (isNeighbour){ fill = '#A1A1AA'; }

    if (isSelected || isHovered) {
      stroke     = isSelected ? '#FFFFFF' : '#525252';
      shadowBlur = isSelected ? 14 : 6;
      shadowColor = isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
    }

    ctx.globalAlpha = opacity;
    ctx.shadowBlur  = shadowBlur;
    ctx.shadowColor = shadowColor;

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.fill();

    if (stroke !== 'transparent') {
      ctx.lineWidth   = 1.5 / globalScale;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    if (isSelected) {
      const label    = node.id;
      const fontSize = Math.max(8, 10 / globalScale);
      ctx.font      = `600 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(250,250,250,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(label, node.x, node.y + radius + fontSize * 1.4);
    }
  }, [neighbourMap]);

  // Seed demo
  useEffect(() => {
    if (simulation.chunks.length === 0) {
      const demo = mockSimulation({ top_k: 9, chunk_size: 120, overlap: 20 });
      setSimulation({ chunks: demo.chunks, edges: demo.edges, attention: demo.attention });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEmpty = simulation.chunks.length === 0;

  return (
    <div ref={containerRef} className="panel" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)',
      }} />

      {/* View tabs */}
      <div style={{
        position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '2px', zIndex: 10,
        background: 'var(--elevated)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '3px',
      }}>
        {(['graph', 'tokens', 'attention'] as const).map(v => (
          <button key={v} onClick={() => setUI({ view: v })} style={{
            padding: '0.3rem 0.85rem', borderRadius: '5px', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', border: 'none', letterSpacing: '0.04em',
            transition: 'all 0.15s',
            background: ui.view === v ? 'var(--surface)' : 'transparent',
            color: ui.view === v ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {v === 'tokens' ? 'Context' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* ── GRAPH view ──────────────────────────────────────────────────── */}
      {ui.view === 'graph' && (
        <>
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeCanvasObject={renderNode}
            nodeCanvasObjectMode={() => 'replace'}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBgClick}
            linkColor={() => 'rgba(255,255,255,0.12)'}
            linkWidth={(link: any) => Math.max(1, (link.weight ?? 0.5) * 2)}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.003}
            linkDirectionalParticleWidth={1.2}
            linkDirectionalParticleColor={() => 'rgba(255,255,255,0.3)'}
            backgroundColor="transparent"
            cooldownTicks={100}
          />
          {isEmpty && <GhostNodes />}
        </>
      )}

      {/* ── TOKENS (Context Strip) view ─────────────────────────────────── */}
      {ui.view === 'tokens' && <TokenContextStrip />}

      {/* ── ATTENTION view ──────────────────────────────────────────────── */}
      {ui.view === 'attention' && <AttentionView />}

      {/* Loading */}
      {simulation.loading && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1rem', zIndex: 20,
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Simulating</div>
        </div>
      )}
    </div>
  );
};
