import React, { useEffect, useState } from 'react';
import { COLORS, MOTION, SPACING } from './tokens';

interface LandingNavProps {
  onNavigate: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onNavigate }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 3.5rem`,
        height: `${SPACING.navHeight}px`,
        background: scrolled ? 'rgba(10,10,10,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled
          ? `1px solid ${COLORS.border}`
          : '1px solid transparent',
        transition: `all ${MOTION.quick}s ${MOTION.ease}`,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <LogoMark />
        <span
          style={{
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '-0.02em',
            color: COLORS.textPrimary,
          }}
        >
          Tokaroo
        </span>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <NavLink>Docs</NavLink>
        <button
          onClick={onNavigate}
          style={{
            background: COLORS.textPrimary,
            color: COLORS.darkBg,
            border: 'none',
            borderRadius: '99px',
            padding: '8px 22px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            transition: `transform ${MOTION.micro}s ease, box-shadow ${MOTION.micro}s ease`,
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,255,255,0.12)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Open App
        </button>
      </div>
    </nav>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const LogoMark: React.FC = () => (
  <div
    style={{
      width: '26px',
      height: '26px',
      borderRadius: '8px',
      background: COLORS.textPrimary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: COLORS.darkBg,
      }}
    />
  </div>
);

const NavLink: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <button
    style={{
      background: 'transparent',
      border: 'none',
      color: COLORS.textMuted,
      padding: '0.5rem 1rem',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: `color ${MOTION.micro}s ease`,
      letterSpacing: '-0.01em',
    }}
    onMouseOver={e => (e.currentTarget.style.color = COLORS.textPrimary)}
    onMouseOut={e => (e.currentTarget.style.color = COLORS.textMuted)}
  >
    {children}
  </button>
);
