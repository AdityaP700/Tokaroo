import React from 'react';
import { Activity, BarChart2, Layers } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'simulate', label: 'Context Simulator', icon: Activity },
  { id: 'compare', label: 'Model Comparer', icon: BarChart2 },
  { id: 'rag', label: 'RAG Sandbox', icon: Layers },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ marginBottom: '2rem', paddingLeft: '0.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <span style={{ 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Tokaroo
          </span>
        </h2>
        <p style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>AI Tooling Interface</p>
      </div>

      <nav className="flex-col" style={{ gap: '0.5rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                width: '100%',
                background: isActive ? 'var(--bg-panel)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-color)' : 'transparent',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--accent-primary)' : 'currentColor' }} />
              <span style={{ fontWeight: isActive ? 600 : 500, fontSize: '0.95rem' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
