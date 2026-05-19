import React, { useState } from 'react';
import { Sidebar } from '../Sidebar';
import { InputConsole } from '../Panels/InputConsole';
import { CoreVisualization } from '../Panels/CoreVisualization';
import { AnalysisEngine } from '../Panels/AnalysisEngine';
import { BottomPanel } from '../Panels/BottomPanel';

export const MainWorkspace: React.FC = () => {
  const [currentView, setCurrentView] = useState('simulate');
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
    }}>
      {/* Sidebar */}
      <div style={{ width: '190px', flexShrink: 0 }}>
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '10px 10px 10px 0', gap: '8px' }}>

        {/* Main 3-panel row */}
        <div style={{ flex: 1, display: 'flex', gap: '8px', minHeight: 0 }}>

          {/* LEFT — Input Console, narrow */}
          <div style={{ width: '250px', flexShrink: 0 }}>
            <InputConsole />
          </div>

          {/* CENTER — Graph dominates */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <CoreVisualization />
          </div>

          {/* RIGHT — Analysis Engine, narrow */}
          <div style={{ width: '250px', flexShrink: 0 }}>
            <AnalysisEngine />
          </div>
        </div>

        {/* Bottom panel — collapsible */}
        <div style={{
          height: bottomCollapsed ? '28px' : '170px',
          transition: 'height 0.25s ease',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Collapse toggle tab */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <button
              onClick={() => setBottomCollapsed(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '10px',
                letterSpacing: '0.1em', padding: '2px 12px',
              }}
            >
              {bottomCollapsed ? '▲  INSIGHTS' : '▼  COLLAPSE'}
            </button>
          </div>
          {!bottomCollapsed && (
            <div style={{ flex: 1, minHeight: 0 }}>
              <BottomPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
