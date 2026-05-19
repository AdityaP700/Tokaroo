import React from 'react';
import { Activity, BarChart2, Layers } from 'lucide-react';
import { useStore } from '../store/useStore';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'simulate', label: 'Context Sim',   icon: Activity  },
  { id: 'compare',  label: 'Model Compare', icon: BarChart2  },
  { id: 'rag',      label: 'RAG Sandbox',   icon: Layers     },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const { simulation } = useStore();
  const hasData = simulation.chunks.length > 0;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '1.25rem 0.75rem',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 0.5rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          {/* Logo mark */}
          <div style={{
            width: '24px', height: '24px', borderRadius: '6px',
            background: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Tokaroo
          </span>
        </div>
        <div className="label" style={{ paddingLeft: '32px' }}>AI Cognitive System</div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', width: '100%', borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.12s, color 0.12s',
                background: isActive ? 'var(--elevated)' : 'transparent',
              }}
            >
              <Icon
                size={15}
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0 }}
              />
              <span style={{
                fontSize: '13px', fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'color 0.12s',
              }}>
                {item.label}
              </span>
              {/* Active indicator */}
              {isActive && (
                <div style={{
                  marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%',
                  background: 'var(--text-primary)', flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
        background: 'var(--elevated)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: hasData ? 'var(--success)' : 'var(--border-hi)',
          }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: hasData ? 'var(--success)' : 'var(--text-muted)' }}>
            {hasData ? 'Active' : 'Idle'}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {hasData ? `${simulation.chunks.length} chunks` : 'No data'}
        </div>
      </div>
    </div>
  );
};
