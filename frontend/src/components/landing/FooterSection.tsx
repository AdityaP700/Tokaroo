import React, { useState } from 'react';
import { COLORS, MOTION, TYPOGRAPHY } from './tokens';

export const FooterSection: React.FC = () => {
  const [wordmarkHovered, setWordmarkHovered] = useState(false);

  return (
    <>
      <style>{`
        @keyframes footerWaveDistort {
          0%   { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
          25%  { clip-path: polygon(0 3%, 100% 0%, 100% 97%, 0 100%); }
          50%  { clip-path: polygon(0 0, 100% 3%, 100% 100%, 0 97%); }
          75%  { clip-path: polygon(0 2%, 100% 0%, 100% 98%, 2% 100%); }
          100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
        }
        .footer-wordmark {
          transition: color 0.3s ease, letter-spacing 0.4s ease;
        }
        .footer-wordmark:hover {
          animation: footerWaveDistort 0.6s ease-in-out;
          color: rgba(168,85,247,0.9) !important;
          letter-spacing: 0.08em !important;
        }
        .footer-link {
          color: ${COLORS.textMuted};
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
          transition: color 0.2s ease;
          letter-spacing: 0.04em;
        }
        .footer-link:hover { color: ${COLORS.textSecondary}; }
      `}</style>

      <footer
        style={{
          padding: '5rem 2rem 4rem',
          background: COLORS.black,
          borderTop: `1px solid rgba(255,255,255,0.04)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Large wordmark — easter egg on hover */}
        <div
          style={{
            marginBottom: '8px',
            cursor: 'default',
            userSelect: 'none',
          }}
          onMouseEnter={() => setWordmarkHovered(true)}
          onMouseLeave={() => setWordmarkHovered(false)}
        >
          <span
            className="footer-wordmark"
            style={{
              fontSize: 'clamp(2.8rem, 5vw, 4.5rem)',
              fontWeight: TYPOGRAPHY.weightBold,
              letterSpacing: wordmarkHovered ? '0.08em' : TYPOGRAPHY.trackingTight,
              color: wordmarkHovered ? 'rgba(168,85,247,0.9)' : 'rgba(255,255,255,0.08)',
              fontFamily: TYPOGRAPHY.display,
              lineHeight: 1,
              transition: `color ${MOTION.quick}s ease, letter-spacing 0.4s ease`,
            }}
          >
            tokaroo
          </span>
        </div>

        {/* Nav links */}
        <nav
          style={{
            display: 'flex',
            gap: '28px',
            alignItems: 'center',
          }}
        >
          {['Privacy Policy', 'Terms of Service', 'Contact'].map((label, i) => (
            <React.Fragment key={label}>
              <a href="#" className="footer-link">{label}</a>
              {i < 2 && (
                <span style={{ color: COLORS.textDim, fontSize: '10px' }}>·</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Copyright */}
        <p
          style={{
            color: COLORS.textDim,
            fontSize: '11px',
            margin: '4px 0 0',
            letterSpacing: '0.04em',
          }}
        >
          © {new Date().getFullYear()} Tokaroo. All rights reserved.
        </p>
      </footer>
    </>
  );
};
