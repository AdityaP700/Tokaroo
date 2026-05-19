import React from 'react';
import { useStore } from '../../store/useStore';

const SEVERITY_MAP: Record<string, { color: string; bg: string; label: string }> = {
  error:   { color: 'var(--danger)',  bg: 'rgba(220,38,38,0.08)',   label: 'Critical' },
  warning: { color: 'var(--warning)', bg: 'rgba(217,119,6,0.08)',   label: 'Warning'  },
  info:    { color: '#A1A1AA',         bg: 'rgba(161,161,170,0.08)', label: 'Info'     },
};

function HealthOrb({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  const label = score >= 80 ? 'Optimal' : score >= 50 ? 'Degraded' : 'Critical';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        border: `1px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', inset: '4px', borderRadius: '50%',
          background: `${color}18`,
        }} />
        <span className="value-mono" style={{ fontSize: '13px', fontWeight: 700, color, position: 'relative' }}>
          {score}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, color, fontSize: '13px' }}>{label}</div>
        <div className="label" style={{ marginTop: '2px' }}>System Health</div>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border)' }} />;
}

export const AnalysisEngine: React.FC = () => {
  const { analysis, simulation, ui, setUI } = useStore();
  const selectedChunk = simulation.chunks.find(c => c.id === ui.selectedNode);

  return (
    <div className="panel" style={{
      height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem',
      padding: '1.25rem', overflowY: 'auto',
    }}>
      {/* Header */}
      <div>
        <div className="label" style={{ marginBottom: '4px' }}>Diagnosis</div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Analysis Engine</div>
      </div>

      <Divider />

      {/* Health */}
      <HealthOrb score={analysis.health_score} />

      {/* Issues */}
      {analysis.issues && analysis.issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="label" style={{ marginBottom: '2px' }}>Detected Issues</div>
          {analysis.issues.map((issue: any, i: number) => {
            const s = SEVERITY_MAP[issue.severity] ?? SEVERITY_MAP.info;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: s.bg, border: `1px solid ${s.color}33`,
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: s.color, marginTop: '3px', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{issue.label}</div>
                  <div style={{ fontSize: '10px', color: s.color, fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Divider />

      {/* Selected node */}
      <div>
        <div className="label" style={{ marginBottom: '8px' }}>Selected Node</div>

        {selectedChunk ? (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* ID */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '4px',
              background: 'var(--elevated)', border: '1px solid var(--border)',
              width: 'fit-content',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: selectedChunk.risk_level === 'high' ? 'var(--danger)' : '#FAFAFA',
              }} />
              <span className="value-mono" style={{ fontSize: '12px' }}>{selectedChunk.id}</span>
            </div>

            {/* Metrics table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { k: 'Tokens',    v: `${selectedChunk.size}` },
                { k: 'Relevance', v: `${(selectedChunk.relevance * 100).toFixed(1)}%` },
                { k: 'Attention', v: `${(selectedChunk.attention * 100).toFixed(1)}%` },
                { k: 'Risk',      v: selectedChunk.risk_level },
              ].map(({ k, v }) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{k}</span>
                  <span className="value-mono" style={{
                    fontSize: '12px',
                    color: k === 'Risk' && selectedChunk.risk_level === 'high'
                      ? 'var(--danger)'
                      : 'var(--text-primary)',
                  }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Snippet */}
            <div style={{
              padding: '8px 10px', background: 'var(--elevated)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontSize: '11px', color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', lineHeight: 1.55,
              maxHeight: '72px', overflowY: 'auto',
            }}>
              {selectedChunk.boundary_snippet}
            </div>

            <button className="btn-ghost" onClick={() => setUI({ selectedNode: null })} style={{ width: '100%' }}>
              Clear selection
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '80px', gap: '6px',
          }}>
            <div style={{ fontSize: '18px', color: 'var(--border-hi)' }}>◎</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Click a node to inspect
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
