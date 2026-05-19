import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { InputConsole } from '../Panels/InputConsole';
import { CoreVisualization } from '../Panels/CoreVisualization';
import { AnalysisEngine } from '../Panels/AnalysisEngine';
import { BottomPanel } from '../Panels/BottomPanel';
import { CompareView } from '../CompareView';
import { RagView } from '../RagView';

const VIEW_LABELS: Record<string, string> = {
  context: 'Context Simulator',
  model: 'Model Compare',
  rag: 'RAG Sandbox',
};

export const MainWorkspace: React.FC = () => {
  const { view } = useParams<{ view: string }>();
  const navigate = useNavigate();
  const currentView = view || 'context';
  const [bottomCollapsed, setBottomCollapsed] = useState(true);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
    }}>
      <div className="sidebar-full" style={{ width: '250px', flexShrink: 0 }}>
        <Sidebar currentView={currentView} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '0 10px 10px 0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 6px 6px 6px',
          flexShrink: 0,
        }}>
          <button onClick={() => navigate('/')} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}>
            Home
          </button>
          <span style={{ color: 'var(--border-hi)', fontSize: '12px' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            {VIEW_LABELS[currentView] ?? currentView}
          </span>
        </div>

        {currentView === 'context' && (
          <>
            <div className="app-panels" style={{ flex: 1, display: 'flex', gap: '10px', minHeight: 0 }}>
              <div className="panel-side" style={{ width: '320px', flexShrink: 0 }}>
                <InputConsole />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CoreVisualization />
              </div>
              <div className="panel-side" style={{ width: '320px', flexShrink: 0 }}>
                <AnalysisEngine />
              </div>
            </div>

            <div style={{
              height: bottomCollapsed ? '28px' : '150px',
              transition: 'height 0.25s ease',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              marginTop: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                <button onClick={() => setBottomCollapsed(v => !v)} style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  padding: '2px 14px',
                }}>
                  {bottomCollapsed ? 'Show context strip' : 'Collapse context strip'}
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

        {currentView === 'model' && (
          <div className="panel" style={{ flex: 1, overflow: 'auto' }}>
            <CompareView />
          </div>
        )}

        {currentView === 'rag' && (
          <div className="panel" style={{ flex: 1, overflow: 'auto' }}>
            <RagView />
          </div>
        )}
      </div>
    </div>
  );
};
