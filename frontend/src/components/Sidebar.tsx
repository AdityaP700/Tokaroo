import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BarChart2, Layers, ArrowLeft, AlertOctagon, Database, Eye, BookOpen, FileText } from 'lucide-react';
import { useStore } from '../store/useStore';

const navGroups = [
  {
    title: 'Core',
    items: [
      { id: 'context', path: '/app/context', label: 'Context Debugger', icon: Activity },
    ]
  },
  {
    title: 'Analysis',
    items: [
      { id: 'cause-explorer', path: '#', label: 'Cause Explorer', icon: AlertOctagon, disabled: true },
      { id: 'retrieval-debugger', path: '#', label: 'Retrieval Debugger (future)', icon: Database, disabled: true },
      { id: 'attention-inspector', path: '#', label: 'Attention Inspector (future)', icon: Eye, disabled: true },
    ]
  },
  {
    title: 'Playground',
    items: [
      { id: 'rag', path: '/app/rag', label: 'RAG Sandbox', icon: Layers },
      { id: 'model', path: '/app/model', label: 'Model Compare', icon: BarChart2 },
    ]
  },
  {
    title: 'Learn',
    items: [
      { id: 'failure-patterns', path: '#', label: 'Failure Patterns', icon: AlertOctagon, disabled: true },
      { id: 'docs', path: '#', label: 'Docs / Examples', icon: FileText, disabled: true },
    ]
  }
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            <div style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: '6px', paddingLeft: '11px'
            }}>
              {group.title}
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { if (!item.disabled) navigate(item.path); }}
                    disabled={item.disabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 11px', width: '100%', borderRadius: 'var(--radius-sm)',
                      border: 'none', cursor: item.disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                      transition: 'background 0.12s, color 0.12s',
                      background: isActive ? 'var(--elevated)' : 'transparent',
                      opacity: item.disabled ? 0.5 : 1,
                    }}
                  >
                    <Icon
                      size={15}
                      style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0 }}
                    />
                    <span style={{
                      fontSize: '13px', fontWeight: isActive ? 500 : 400,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'color 0.12s',
                    }}>
                      {item.label}
                    </span>
                    {isActive && (
                      <div style={{
                        marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%',
                        background: 'var(--text-primary)', flexShrink: 0,
                      }} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

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
