import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';

export const BottomPanel: React.FC = () => {
  const { simulation, ui, setUI } = useStore();

  const isEmpty = simulation.chunks.length === 0;

  // Attention sparkline data
  const sparkData = useMemo(() =>
    simulation.attention.map((val, i) => ({
      index: i,
      attention: val * 100,
      chunkId: simulation.chunks[i]?.id ?? `chunk-${i}`,
    })), [simulation.attention, simulation.chunks]);

  // Max token size for normalizing widths
  const maxTokens = useMemo(() =>
    Math.max(1, ...simulation.chunks.map(c => c.size)),
    [simulation.chunks]);

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Context Strip (tokens as spatial blocks) ──────────────────── */}
      <div style={{ flex: 1, padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div className="label">Context Strip</div>
          {!isEmpty && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              width = tokens · brightness = attention · red = risk
            </div>
          )}
        </div>

        {isEmpty ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Run a simulation to view the context strip
          </div>
        ) : (
          <div style={{
            display: 'flex', gap: '2px', flex: 1, minHeight: '36px', maxHeight: '56px',
            borderRadius: '4px', overflow: 'hidden',
          }}>
            {simulation.chunks.map((chunk, i) => {
              const isSelected = ui.selectedNode === chunk.id;
              const isHovered  = ui.hoveredNode === chunk.id;
              const attention  = simulation.attention[i] ?? 0;
              const isRisk     = chunk.risk_level === 'high';

              // Width proportional to token count
              const widthPct = (chunk.size / maxTokens) * 100;
              // Brightness = attention
              const brightness = attention * 0.75 + 0.05;

              return (
                <div
                  key={chunk.id}
                  onClick={() => setUI({ selectedNode: chunk.id })}
                  onMouseEnter={() => setUI({ hoveredNode: chunk.id })}
                  onMouseLeave={() => setUI({ hoveredNode: null })}
                  title={`Chunk ${i + 1} · ${chunk.size}t · ${(attention * 100).toFixed(0)}% attention${isRisk ? ' · HIGH RISK' : ''}`}
                  style={{
                    flex: `${widthPct} 0 0`,
                    minWidth: '8px',
                    background: isSelected
                      ? '#FAFAFA'
                      : isHovered
                        ? `rgba(250,250,250,${Math.min(brightness + 0.2, 0.9).toFixed(2)})`
                        : `rgba(250,250,250,${brightness.toFixed(2)})`,
                    borderRadius: '2px',
                    cursor: 'pointer',
                    transition: 'background 0.15s, box-shadow 0.15s',
                    position: 'relative',
                    borderBottom: isRisk ? '2px solid var(--danger)' : 'none',
                    boxShadow: isSelected ? '0 0 8px rgba(255,255,255,0.12)' : 'none',
                    opacity: ui.selectedNode && !isSelected ? 0.35 : 1,
                  }}
                >
                  {/* Chunk index label for wider blocks */}
                  {widthPct > 8 && (
                    <div style={{
                      position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
                      fontSize: '8px', fontWeight: 600, fontFamily: 'var(--font-mono)',
                      color: isSelected ? '#000' : `rgba(0,0,0,${Math.min(brightness * 1.5, 0.5).toFixed(2)})`,
                      pointerEvents: 'none',
                    }}>
                      {chunk.chunk_index ?? i + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border)', flexShrink: 0 }} />

      {/* ── Attention sparkline (synced) ──────────────────────────────── */}
      <div style={{ height: '60px', padding: '0.4rem 1rem', flexShrink: 0 }}>
        {isEmpty ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            Attention curve appears after simulation
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sparkData}
              onMouseMove={(d: any) => {
                if (d?.activePayload?.[0]) setUI({ hoveredNode: d.activePayload[0].payload.chunkId });
              }}
              onMouseLeave={() => setUI({ hoveredNode: null })}
            >
              <XAxis dataKey="index" hide />
              <YAxis hide domain={[0, 100]} />
              {ui.selectedNode && (() => {
                const idx = sparkData.findIndex(d => d.chunkId === ui.selectedNode);
                return idx >= 0
                  ? <ReferenceLine x={idx} stroke="rgba(250,250,250,0.2)" strokeWidth={1} strokeDasharray="2 2" />
                  : null;
              })()}
              <Line
                type="monotone" dataKey="attention"
                stroke="rgba(250,250,250,0.45)" strokeWidth={1.2}
                dot={false}
                activeDot={{ r: 3, fill: '#FAFAFA', stroke: 'var(--surface)', strokeWidth: 1 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
