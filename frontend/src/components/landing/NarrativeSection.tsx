import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { NetworkCluster } from '../NetworkCluster';
import { COLORS, MOTION, SPACING, TYPOGRAPHY } from './tokens';
import { NARRATIVE_STEPS } from './constants';

gsap.registerPlugin(ScrollTrigger);

export const NarrativeSection: React.FC = () => {
  const sectionRef    = useRef<HTMLElement>(null);
  const narrativeStepRef = useRef(0);

  // ── Visual progress indicator (rAF-synced to ref, not canvas-affecting) ──
  const [visibleStep, setVisibleStep] = useState(0);

  useEffect(() => {
    let rafId: number;
    const sync = () => {
      const clamped = Math.max(0, Math.min(3, narrativeStepRef.current));
      setVisibleStep(Math.round(clamped));
      rafId = requestAnimationFrame(sync);
    };
    rafId = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── GSAP: scrub 0→3 + individual block fade-in ───────────────────────────
  useEffect(() => {
    if (!sectionRef.current) return;

    // Single scrub spanning the full section → drives canvas state
    const stepObj = { value: 0 };
    const scrub = gsap.to(stepObj, {
      value: 3,
      ease: 'none',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: () => { narrativeStepRef.current = stepObj.value; },
      },
    });

    // Individual block fade-in (scrubbed) as each enters center viewport
    const blocks = sectionRef.current.querySelectorAll<HTMLElement>('.narrative-block');
    const triggers: ScrollTrigger[] = [];
    blocks.forEach(block => {
      const t = ScrollTrigger.create({
        trigger: block,
        start: 'top 70%',
        end: 'top 42%',
        scrub: true,
        onUpdate: self => {
          block.style.opacity = String(self.progress);
          block.style.transform = `translateX(${(1 - self.progress) * -28}px)`;
        },
      });
      triggers.push(t);
    });

    return () => {
      scrub.kill();
      triggers.forEach(t => t.kill());
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes narrativeSectionLine { to { transform: scaleY(1); } }
      `}</style>

      <section
        ref={sectionRef}
        style={{ background: COLORS.darkBg, position: 'relative', zIndex: 10 }}
      >
        {/* Section eyebrow */}
        <div
          style={{
            maxWidth: SPACING.maxContent,
            margin: '0 auto',
            padding: '7rem 3.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{ width: '32px', height: '1px', background: COLORS.textDim }} />
          <span
            style={{
              color: COLORS.textMuted,
              fontSize: TYPOGRAPHY.caption,
              fontWeight: 700,
              letterSpacing: TYPOGRAPHY.trackingWide,
              textTransform: 'uppercase',
            }}
          >
            The Cognitive Autopsy
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            maxWidth: SPACING.maxContent,
            margin: '0 auto',
            padding: '0 3.5rem',
          }}
        >
          {/* ── Left: scrollable narrative ──────────────────────────── */}
          <div style={{ flex: '0 0 45%', paddingRight: '5rem', paddingBottom: '10rem' }}>
            {NARRATIVE_STEPS.map((step, i) => (
              <div
                key={i}
                className="narrative-block"
                style={{
                  minHeight: '100vh',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '4rem 0',
                  opacity: 0, // GSAP fades in
                }}
              >
                {/* Step label */}
                <div
                  style={{
                    fontSize: TYPOGRAPHY.caption,
                    fontWeight: 700,
                    letterSpacing: TYPOGRAPHY.trackingXWide,
                    textTransform: 'uppercase',
                    color: COLORS.accentPurple,
                    marginBottom: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {step.label}
                  <div
                    style={{
                      width: '36px',
                      height: '1px',
                      background: `rgba(168,85,247,0.35)`,
                    }}
                  />
                </div>

                {/* Title */}
                <h2
                  style={{
                    fontSize: TYPOGRAPHY.h3,
                    fontWeight: TYPOGRAPHY.weightSemi,
                    color: COLORS.textPrimary,
                    margin: '0 0 18px',
                    letterSpacing: TYPOGRAPHY.trackingTight,
                    lineHeight: 1.1,
                    maxWidth: '420px',
                  }}
                >
                  {step.title}
                </h2>

                {/* Body */}
                <p
                  style={{
                    fontSize: TYPOGRAPHY.body,
                    color: COLORS.textMuted,
                    lineHeight: 1.78,
                    margin: 0,
                    maxWidth: '380px',
                  }}
                >
                  {step.body}
                </p>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: '7px', marginTop: '40px' }}>
                  {NARRATIVE_STEPS.map((_, dotIdx) => (
                    <div
                      key={dotIdx}
                      style={{
                        width: dotIdx === i ? '22px' : '7px',
                        height: '7px',
                        borderRadius: '99px',
                        background: dotIdx === i
                          ? COLORS.accentPurple
                          : COLORS.textDim,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Right: sticky canvas + progress bar ─────────────────── */}
          <div
            style={{
              flex: '0 0 55%',
              position: 'sticky',
              top: 0,
              height: '100vh',
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'stretch',
              paddingTop: `${SPACING.navHeight}px`,
            }}
          >
            {/* Vertical progress bar */}
            <ProgressBar currentStep={visibleStep} totalSteps={NARRATIVE_STEPS.length} />

            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
              <NetworkCluster stepRef={narrativeStepRef} />

              {/* Scroll hint — fades after first step */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '28px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  pointerEvents: 'none',
                  opacity: visibleStep > 0 ? 0 : 0.6,
                  transition: 'opacity 0.6s ease',
                }}
              >
                <div
                  style={{
                    width: '1px',
                    height: '36px',
                    background: `linear-gradient(to bottom, transparent, ${COLORS.accentPurpleMuted})`,
                  }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    color: COLORS.textMuted,
                    letterSpacing: TYPOGRAPHY.trackingWide,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  scroll
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

// ─── Vertical Progress Bar ────────────────────────────────────────────────────
interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      gap: 0,
      flexShrink: 0,
    }}
  >
    {Array.from({ length: totalSteps }, (_, i) => (
      <React.Fragment key={i}>
        {/* Step dot */}
        <div
          style={{
            width: i === currentStep ? '10px' : '7px',
            height: i === currentStep ? '10px' : '7px',
            borderRadius: '50%',
            background: i <= currentStep ? COLORS.accentPurple : COLORS.textDim,
            boxShadow: i === currentStep
              ? `0 0 10px ${COLORS.glowPurple}`
              : 'none',
            transition: `all 0.4s ${MOTION.ease}`,
            flexShrink: 0,
          }}
        />
        {/* Connecting line between dots */}
        {i < totalSteps - 1 && (
          <div
            style={{
              width: '1px',
              height: '60px',
              background: `linear-gradient(to bottom, ${i < currentStep ? COLORS.accentPurpleMuted : COLORS.textDim} 0%, ${i + 1 <= currentStep ? COLORS.accentPurpleMuted : COLORS.textDim} 100%)`,
              transition: `background 0.4s ease`,
              opacity: 0.5,
              flexShrink: 0,
            }}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);
