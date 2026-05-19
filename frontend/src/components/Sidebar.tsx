import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BarChart2, Layers, ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';

const navItems = [
  { id: 'context', path: '/app/context', label: 'Context Sim',   icon: Activity  },
  { id: 'model',   path: '/app/model',   label: 'Model Compare', icon: BarChart2 },
  { id: 'rag',     path: '/app/rag',     label: 'RAG Sandbox',   icon: Layers    },
];

interface SidebarProps {
  currentView: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView }) => {
  const navigate = useNavigate();
  const { simulation } = useStore();
  const hasData = simulation.chunks.length > 0;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '1.25rem 0.85rem',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 0.4rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '6px',
            background: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Tokaroo
          </span>
        </div>
      </div>

      {/* Back to home */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 10px', width: '100%', borderRadius: 'var(--radius-sm)',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          background: 'transparent', marginBottom: '1rem',
        }}
      >
        <ArrowLeft size={14} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Back to Home</span>
      </button>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 0.75rem 0' }} />

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 11px', width: '100%', borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.12s, color 0.12s',
                background: isActive ? 'var(--elevated)' : 'transparent',
              }}
            >
              <Icon
                size={16}
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0 }}
              />
              <span style={{
                fontSize: '14px', fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'color 0.12s',
              }}>
                {item.label}
              </span>
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
            width: '6px', height: '6px', borderRadius: '50%',
            background: hasData ? 'var(--success)' : 'var(--border-hi)',
          }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: hasData ? 'var(--success)' : 'var(--text-muted)' }}>
            {hasData ? 'Active' : 'Idle'}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {hasData ? `${simulation.chunks.length} chunks` : 'No data'}
        </div>
      </div>
    </div>
  );
};
