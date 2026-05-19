import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { InputConsole } from '../Panels/InputConsole';
import { CoreVisualization } from '../Panels/CoreVisualization';
import { AnalysisEngine } from '../Panels/AnalysisEngine';
import { BottomPanel } from '../Panels/BottomPanel';

const VIEW_LABELS: Record<string, string> = {
  context: 'Context Simulator',
  model:   'Model Compare',
  rag:     'RAG Sandbox',
};

export const MainWorkspace: React.FC = () => {
  const { view } = useParams<{ view: string }>();
  const navigate = useNavigate();
  const currentView = view || 'context';
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
      background: 'var(--bg)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
    }}>
      {/* Sidebar */}
      <div className="sidebar-full" style={{ width: '200px', flexShrink: 0 }}>
        <Sidebar currentView={currentView} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '0 10px 10px 0' }}>

        {/* ── Top bar: breadcrumb + view title ──────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 6px 6px 6px', flexShrink: 0,
        }}>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '12px',
          }}>
            Home
          </button>
          <span style={{ color: 'var(--border-hi)', fontSize: '12px' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            {VIEW_LABELS[currentView] ?? currentView}
          </span>
        </div>

        {/* ── Context Simulator ──────────────────────────────────────────── */}
        {currentView === 'context' && (
          <>
            <div className="app-panels" style={{ flex: 1, display: 'flex', gap: '8px', minHeight: 0 }}>
              <div className="panel-side" style={{ width: '260px', flexShrink: 0 }}>
                <InputConsole />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CoreVisualization />
              </div>
              <div className="panel-side" style={{ width: '260px', flexShrink: 0 }}>
                <AnalysisEngine />
              </div>
            </div>

            {/* Bottom — collapsible */}
            <div style={{
              height: bottomCollapsed ? '28px' : '160px',
              transition: 'height 0.25s ease', flexShrink: 0,
              display: 'flex', flexDirection: 'column', marginTop: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                <button onClick={() => setBottomCollapsed(v => !v)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.08em', padding: '2px 14px',
                }}>
                  {bottomCollapsed ? '▲  CONTEXT STRIP' : '▼  COLLAPSE'}
                </button>
              </div>
              {!bottomCollapsed && (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <BottomPanel />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Model Compare — Coming Soon ────────────────────────────────── */}
        {currentView === 'model' && (
          <div className="panel" style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'var(--elevated)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem auto', fontSize: '20px', color: 'var(--text-muted)',
              }}>
                ◇
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Model Compare</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Compare token counts, costs, and context windows across GPT-4o, Claude, Llama, and more.
              </div>
              <div style={{
                display: 'inline-flex', gap: '6px', padding: '6px 14px',
                background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: '99px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning)', marginTop: '3px' }} />
                Coming Soon
              </div>

              {/* Preview cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '1.5rem' }}>
                {[
                  { model: 'GPT-4o', ctx: '128k', cost: '$5/M' },
                  { model: 'Claude 3', ctx: '200k', cost: '$15/M' },
                ].map(m => (
                  <div key={m.model} style={{
                    padding: '12px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--elevated)', border: '1px solid var(--border)',
                    textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{m.model}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.ctx} context · {m.cost}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RAG Sandbox — Coming Soon ──────────────────────────────────── */}
        {currentView === 'rag' && (
          <div className="panel" style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'var(--elevated)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem auto', fontSize: '20px', color: 'var(--text-muted)',
              }}>
                ◆
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>RAG Sandbox</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Full pipeline simulation — chunking, embedding, retrieval, reranking — with live diagnostics.
              </div>
              <div style={{
                display: 'inline-flex', gap: '6px', padding: '6px 14px',
                background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: '99px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning)', marginTop: '3px' }} />
                Coming Soon
              </div>

              {/* Preview cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '1.5rem' }}>
                {['Chunk', 'Retrieve', 'Rerank'].map(s => (
                  <div key={s} style={{
                    padding: '10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--elevated)', border: '1px solid var(--border)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
