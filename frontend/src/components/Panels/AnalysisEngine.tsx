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
        <span className="value-mono" style={{ fontSize: '15px', fontWeight: 700, color, position: 'relative' }}>
          {score}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, color, fontSize: '14px' }}>{label}</div>
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
  const raw = simulation.raw;
  const request = simulation.request;

  return (
    <div className="panel" style={{
      height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem',
      padding: '1.25rem', overflowY: 'auto',
    }}>
      {/* Header */}
      <div>
        <div className="label" style={{ marginBottom: '4px' }}>Diagnosis</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Analysis Engine</div>
      </div>

      <Divider />

      {/* Health */}
      <HealthOrb score={analysis.health_score} />

      {raw && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '10px 12px',
          background: 'var(--elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}>
          {[
            { k: 'Model', v: raw.model },
            { k: 'Mode', v: raw.retrieval_mode ?? 'rag' },
            { k: 'Chunks', v: `${raw.chunks_in_prompt}/${raw.total_chunks_created}` },
            { k: 'Reranked', v: raw.reranked ? 'true' : 'false' },
            { k: 'Waste', v: raw.attention_waste == null ? '0%' : `${(raw.attention_waste * 100).toFixed(0)}%` },
            { k: 'Overlap +', v: `${raw.extra_tokens_due_to_overlap}t` },
          ].map(({ k, v }) => (
            <div key={k}>
              <div className="label" style={{ marginBottom: '2px' }}>{k}</div>
              <div className="value-mono" style={{ fontSize: '12px' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {(request || raw) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <details style={{
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '9px 10px',
          }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
              Backend request
            </summary>
            <pre style={{
              marginTop: '8px',
              maxHeight: '150px',
              overflow: 'auto',
              color: 'var(--text-muted)',
              fontSize: '10px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>{JSON.stringify(request, null, 2)}</pre>
          </details>
          <details style={{
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '9px 10px',
          }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
              Backend response
            </summary>
            <pre style={{
              marginTop: '8px',
              maxHeight: '190px',
              overflow: 'auto',
              color: 'var(--text-muted)',
              fontSize: '10px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>{JSON.stringify(raw, null, 2)}</pre>
          </details>
        </div>
      )}

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
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{issue.label}</div>
                  <div style={{ fontSize: '11px', color: s.color, fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Divider + Selected node — only when selected */}
      {selectedChunk && (
        <>
          <Divider />
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="label" style={{ marginBottom: '4px' }}>Selected Node</div>
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
              <span className="value-mono" style={{ fontSize: '13px' }}>{selectedChunk.display_id ?? selectedChunk.id}</span>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { k: 'Tokens',    v: `${selectedChunk.size}` },
                { k: 'Relevance', v: `${(selectedChunk.relevance * 100).toFixed(1)}%` },
                { k: 'Attention', v: `${(selectedChunk.attention * 100).toFixed(1)}%` },
                { k: 'Risk',      v: selectedChunk.risk_label ?? selectedChunk.risk_level },
              ].map(({ k, v }) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{k}</span>
                  <span className="value-mono" style={{
                    fontSize: '13px',
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
        </>
      )}
    </div>
  );
};
