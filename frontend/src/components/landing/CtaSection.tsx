import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { COLORS, MOTION, TYPOGRAPHY } from './tokens';

gsap.registerPlugin(ScrollTrigger);

interface CtaSectionProps {
  onNavigate: () => void;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ onNavigate }) => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const items = sectionRef.current.querySelectorAll('.cta-reveal');
    const trigger = gsap.fromTo(items,
      { opacity: 0, scale: 0.96, y: 20 },
      {
        opacity: 1, scale: 1, y: 0,
        stagger: 0.12,
        duration: 1.1,
        ease: MOTION.ease,
        scrollTrigger: { trigger: sectionRef.current, start: 'top 82%' },
      },
    );
    return () => { trigger.kill(); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes ctaButtonPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
          50%      { box-shadow: 0 0 28px 6px rgba(168,85,247,0.22), 0 0 60px 12px rgba(168,85,247,0.1); }
        }
      `}</style>

      <section
        ref={sectionRef}
        style={{
          padding: '14rem 2rem 18rem',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          overflow: 'hidden',
          /* Radial gradient — dark purple center → pure black */
          background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(88,28,135,0.12) 0%, #0a0a0a 65%)',
        }}
      >
        {/* Faint grid lines — Vercel-style depth */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            pointerEvents: 'none',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 100%)',
          }}
        />

        {/* Eyebrow */}
        <div
          className="cta-reveal"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '36px',
          }}
        >
          <div style={{ width: '40px', height: '1px', background: COLORS.textDim }} />
          <span
            style={{
              color: COLORS.textMuted,
              fontSize: TYPOGRAPHY.caption,
              fontWeight: 700,
              letterSpacing: TYPOGRAPHY.trackingWide,
              textTransform: 'uppercase',
            }}
          >
            Start Now
          </span>
          <div style={{ width: '40px', height: '1px', background: COLORS.textDim }} />
        </div>

        {/* Headline */}
        <h2
          className="cta-reveal"
          style={{
            fontSize: 'clamp(2.8rem, 5vw, 4.5rem)',
            fontWeight: TYPOGRAPHY.weightBold,
            color: COLORS.textPrimary,
            margin: '0 0 52px',
            letterSpacing: TYPOGRAPHY.trackingTight,
            lineHeight: 1.04,
            maxWidth: '520px',
          }}
        >
          Start exploring your AI
        </h2>

        {/* Pulsing CTA button */}
        <button
          onClick={onNavigate}
          className="cta-reveal"
          style={{
            background: COLORS.textPrimary,
            color: COLORS.darkBg,
            border: 'none',
            borderRadius: '99px',
            padding: '18px 56px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            marginBottom: '24px',
            animation: 'ctaButtonPulse 3.5s ease-in-out infinite',
            transition: `transform ${MOTION.micro}s ${MOTION.ease}`,
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'none';
          }}
        >
          Start Simulation
        </button>

        {/* Subtext */}
        <p
          className="cta-reveal"
          style={{
            color: COLORS.textMuted,
            fontSize: '14px',
            margin: 0,
          }}
        >
          Connect to the Tokaroo backend for real diagnostics.
        </p>
      </section>
    </>
  );
};
