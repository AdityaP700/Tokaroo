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

export const CoreVisualization: React.FC = () => {
  const { simulation, ui, setUI, setSimulation } = useStore();
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // ── Resize observer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Tune physics ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force('charge')?.strength(-200);
  }, [simulation.chunks]);

  // ── Neighbour map ──────────────────────────────────────────────────────
  const neighbourMap = useMemo(
    () => buildNeighbourMap(simulation.edges),
    [simulation.edges]
  );

  // ── Graph data ─────────────────────────────────────────────────────────
  const graphData = useMemo(() => ({
    nodes: simulation.chunks.map(c => ({ ...c, val: Math.max(1, c.size / 60) })),
    links: simulation.edges,
  }), [simulation.chunks, simulation.edges]);

  // ── Handlers ───────────────────────────────────────────────────────────
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

  // ── Node painter (PREMIUM GRAYSCALE SYSTEM) ───────────────────────────
  const renderNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { selectedNode, hoveredNode } = useStore.getState().ui;

    const isSelected   = selectedNode === node.id;
    const isHovered    = hoveredNode  === node.id;
    const isNeighbour  = selectedNode ? (neighbourMap.get(selectedNode)?.has(node.id) ?? false) : false;
    const isRisk       = node.risk_level === 'high';

    // Focus logic
    const hasFocus = selectedNode === null || isSelected || isNeighbour;
    const opacity  = hasFocus ? 1 : 0.1;

    const radius = Math.max(4, (node.size / 60) * 4);

    // ── Color (strict semantic palette) ──────────────────────────────────
    let fill   = '#2A2A2A';              // default: dark gray
    let stroke = 'transparent';
    let shadowBlur  = 0;
    let shadowColor = 'transparent';

    if (isRisk)        { fill = '#DC2626'; }           // danger
    else if (isSelected) { fill = '#FFFFFF'; }         // selected: pure white
    else if (isNeighbour){ fill = '#A1A1AA'; }         // neighbour: mid gray

    if (isSelected || isHovered) {
      stroke     = isSelected ? '#FFFFFF' : '#525252';
      shadowBlur  = isSelected ? 12 : 6;
      shadowColor = isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
    }

    ctx.globalAlpha = opacity;

    // Glow
    ctx.shadowBlur  = shadowBlur;
    ctx.shadowColor = shadowColor;

    // Main circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.fill();

    // Stroke ring
    if (stroke !== 'transparent') {
      ctx.lineWidth   = 1.5 / globalScale;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    // Label for selected only
    if (isSelected) {
      const label    = node.id;
      const fontSize = Math.max(7, 9 / globalScale);
      ctx.font      = `600 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(250,250,250,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(label, node.x, node.y + radius + fontSize * 1.4);
    }
  }, [neighbourMap]);

  // ── Seed demo data on first mount ─────────────────────────────────────
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

      {/* ── Subtle ambient glow dead-center ─────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)',
      }} />

      {/* ── View-mode tabs ───────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '2px', zIndex: 10,
        background: 'var(--elevated)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '3px',
      }}>
        {(['graph', 'tokens', 'attention'] as const).map(v => (
          <button key={v} onClick={() => setUI({ view: v })} style={{
            padding: '0.25rem 0.75rem', borderRadius: '5px', fontSize: '11px',
            fontWeight: 600, cursor: 'pointer', border: 'none', letterSpacing: '0.04em',
            transition: 'all 0.15s',
            background: ui.view === v ? 'var(--surface)' : 'transparent',
            color: ui.view === v ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Graph ───────────────────────────────────────────────────────── */}
      {ui.view === 'graph' && (
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
          linkColor={() => 'rgba(255,255,255,0.07)'}
          linkWidth={(link: any) => (link.weight ?? 0.5) * 1.5}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1}
          linkDirectionalParticleColor={() => 'rgba(255,255,255,0.25)'}
          backgroundColor="transparent"
          cooldownTicks={100}
        />
      )}

      {/* ── Token strip ─────────────────────────────────────────────────── */}
      {ui.view === 'tokens' && (
        <div style={{ padding: '4rem 2rem', display: 'flex', flexWrap: 'wrap', gap: '6px', overflowY: 'auto', height: '100%', alignContent: 'flex-start' }}>
          {simulation.chunks.map((chunk, i) => {
            const isSelected = ui.selectedNode === chunk.id;
            const isRisk     = chunk.risk_level === 'high';
            return (
              <div key={chunk.id} onClick={() => setUI({ selectedNode: chunk.id })}
                style={{
                  padding: '5px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontWeight: 500, transition: 'all 0.15s',
                  background: isSelected ? '#FAFAFA' : isRisk ? 'rgba(220,38,38,0.15)' : 'var(--elevated)',
                  border: `1px solid ${isSelected ? '#FAFAFA' : isRisk ? '#DC2626' : 'var(--border)'}`,
                  color: isSelected ? '#000' : isRisk ? '#DC2626' : 'var(--text-secondary)',
                  opacity: ui.selectedNode && !isSelected ? 0.4 : 1,
                }}
              >
                {i + 1} · {chunk.size}t
              </div>
            );
          })}
          {isEmpty && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No chunks yet.</div>}
        </div>
      )}

      {/* ── Attention heatmap ────────────────────────────────────────────── */}
      {ui.view === 'attention' && (
        <div style={{ padding: '3rem 2.5rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
          <div className="label" style={{ marginBottom: '0.5rem' }}>Attention Distribution</div>
          <div style={{ display: 'flex', height: '56px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
            {simulation.attention.map((a, i) => (
              <div key={i} title={`Chunk ${i}: ${(a * 100).toFixed(0)}%`}
                style={{
                  flex: 1,
                  background: `rgba(250,250,250,${(a * 0.8).toFixed(2)})`,
                  borderRadius: '3px', transition: 'all 0.2s',
                  cursor: 'pointer',
                  outline: simulation.chunks[i]?.id === ui.selectedNode ? '1px solid #fff' : 'none',
                }}
                onClick={() => setUI({ selectedNode: simulation.chunks[i]?.id ?? null })}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <span>Low attention</span><span>High attention</span>
          </div>
          {isEmpty && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>Run a simulation to view heatmap.</div>}
        </div>
      )}

      {/* ── Empty-state overlay ──────────────────────────────────────────── */}
      {isEmpty && ui.view === 'graph' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: '0.5rem',
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border-hi)' }} />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Run a simulation to visualize AI reasoning</div>
        </div>
      )}

      {/* ── Loading overlay ──────────────────────────────────────────────── */}
      {simulation.loading && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.8)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1rem',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Simulating</div>
        </div>
      )}
    </div>
  );
};
