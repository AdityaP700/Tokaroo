import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { COLORS, MOTION, RADII, SHADOWS, SPACING, TYPOGRAPHY } from "./tokens";
import { BENTO_CARDS } from "./constants";
import type { BentoCard, BentoVisualType } from "./constants";

gsap.registerPlugin(ScrollTrigger);

// ─── Section ──────────────────────────────────────────────────────────────────
export const BentoSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const cards = sectionRef.current.querySelectorAll(".bento-card");
    const trigger = gsap.fromTo(
      cards,
      { opacity: 0, y: 32 },
      {
        opacity: 1,
        y: 0,
        stagger: MOTION.stagger,
        duration: MOTION.normal,
        ease: MOTION.ease,
        scrollTrigger: { trigger: sectionRef.current, start: "top 76%" },
      },
    );
    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <>
      <style>{`
        /* Bento micro-animations */
        @keyframes bentoFadeCenter {
          0%,100% { opacity: 0.12; }
          50%      { opacity: 0.88; }
        }
        @keyframes bentoGlitch {
          0%,88%,100% { transform: translateX(0) skewX(0deg); opacity:1; }
          90%  { transform: translateX(-4px) skewX(-1.5deg); opacity:0.8; }
          93%  { transform: translateX(4px) skewX(1.5deg); opacity:0.9; }
          96%  { transform: translateX(-1px) skewX(0); }
        }
        @keyframes bentoFillCut {
          0%   { width:0%; }
          65%  { width:100%; clip-path:inset(0 0 0 0); }
          68%  { width:100%; clip-path:inset(0 24% 0 0); }
          100% { width:100%; clip-path:inset(0 24% 0 0); }
        }
        @keyframes bentoNodePulse {
          0%,100% { transform:scale(1); opacity:0.5; box-shadow:0 0 0 ${COLORS.glowPurple}; }
          50%      { transform:scale(1.4); opacity:1; box-shadow:0 0 14px ${COLORS.accentPurple}; }
        }
        @keyframes bentoLineFade {
          0%,100% { opacity:0.07; }
          50%      { opacity:0.38; }
        }
        @keyframes bentoFeedbackSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes bentoBlobPulse {
          0%,100% { transform: scale(1); opacity: 0.45; }
          50%      { transform: scale(1.08); opacity: 0.7; }
        }
      `}</style>

      <section
        ref={sectionRef}
        style={{
          background: COLORS.darkBg,
          padding: SPACING.sectionPad,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: SPACING.maxText, margin: "0 auto" }}>
          {/* Section header */}
          <div style={{ marginBottom: "56px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "1px",
                  background: COLORS.textDim,
                }}
              />
              <span
                style={{
                  color: COLORS.textMuted,
                  fontSize: TYPOGRAPHY.caption,
                  fontWeight: 700,
                  letterSpacing: TYPOGRAPHY.trackingWide,
                  textTransform: "uppercase",
                }}
              >
                What Tokaroo Catches
              </span>
            </div>
            <h2
              style={{
                fontSize: TYPOGRAPHY.h2,
                fontWeight: TYPOGRAPHY.weightSemi,
                color: COLORS.textPrimary,
                margin: 0,
                letterSpacing: TYPOGRAPHY.trackingTight,
                lineHeight: 1.1,
                maxWidth: "480px",
              }}
            >
              Where retrieval goes wrong
            </h2>
          </div>

          {/* 3-column grid — alternating span pattern */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "10px",
            }}
          >
            {BENTO_CARDS.map((card, i) => (
              <BentoCardItem key={i} card={card} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

// ─── Individual Card ──────────────────────────────────────────────────────────
const BentoCardItem: React.FC<{ card: BentoCard }> = ({ card }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bento-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: `span ${card.colSpan}`,
        background: COLORS.darkCard,
        border: `1px solid ${hovered ? "rgba(168,85,247,0.38)" : COLORS.border}`,
        borderRadius: RADII.xl,
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "220px",
        position: "relative",
        overflow: "hidden",
        opacity: 0, // GSAP will animate in
        cursor: "default",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? SHADOWS.cardHover : "none",
        transition: `transform ${MOTION.quick}s ${MOTION.ease}, box-shadow ${MOTION.quick}s ease, border-color ${MOTION.quick}s ease`,
      }}
    >
      {/* Radial glow accent — top corner */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "220px",
          height: "220px",
          background: `radial-gradient(circle at 75% 15%, rgba(168,85,247,${hovered ? "0.1" : "0.05"}) 0%, transparent 70%)`,
          pointerEvents: "none",
          transition: `all ${MOTION.quick}s ease`,
        }}
      />

      {/* Visual */}
      <div style={{ marginBottom: "28px" }}>
        <BentoVisual type={card.visual} />
      </div>

      {/* Text */}
      <div>
        <h3
          style={{
            fontSize: "1.05rem",
            fontWeight: TYPOGRAPHY.weightSemi,
            color: COLORS.textPrimary,
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}
        >
          {card.title}
        </h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: COLORS.textMuted,
            margin: 0,
            lineHeight: 1.68,
            maxWidth: "360px",
          }}
        >
          {card.desc}
        </p>
      </div>
    </div>
  );
};

// ─── Visual Micro-Animations ──────────────────────────────────────────────────
interface BentoVisualProps {
  type: BentoVisualType;
}

const BentoVisual: React.FC<BentoVisualProps> = ({ type }) => {
  switch (type) {
    // ── "Lost in the Middle" — 7 token chunks, center 3 ghost in/out ──────
    case "fade-center":
      return (
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          {Array.from({ length: 7 }, (_, i) => {
            const isCenter = i >= 2 && i <= 4;
            return (
              <div
                key={i}
                style={{
                  height: "26px",
                  width: isCenter ? "38px" : "26px",
                  borderRadius: RADII.sm,
                  background: COLORS.darkElevated,
                  border: `1px solid ${COLORS.border}`,
                  animation: isCenter
                    ? `bentoFadeCenter ${1.8 + i * 0.35}s ease-in-out infinite`
                    : "none",
                  opacity: isCenter ? 0.12 : 0.72,
                }}
              />
            );
          })}
        </div>
      );

    // ── "Semantic Mismatch" — QUERY ↛ RESULT with red break dot ──────────
    case "glitch-word":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {["QUERY", "RESULT"].map((label, i) => (
            <React.Fragment key={label}>
              <div
                style={{
                  padding: "6px 13px",
                  borderRadius: RADII.sm,
                  background: COLORS.darkElevated,
                  border: `1px solid ${COLORS.border}`,
                  fontSize: "11px",
                  fontWeight: 700,
                  color: COLORS.textSecondary,
                  letterSpacing: "0.04em",
                  animation: `bentoGlitch ${3.8 + i * 0.4}s ease-in-out infinite`,
                }}
              >
                {label}
              </div>
              {i === 0 && (
                <div
                  style={{
                    flex: 1,
                    maxWidth: "44px",
                    height: "1px",
                    background: COLORS.border,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "-3px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: COLORS.accentRed,
                      opacity: 0.75,
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      );

    // ── "Context Overflow" — gradient bar fills then hard-clips ──────────
    case "overflow-bar":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: COLORS.textDim,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Token Budget
            </span>
            <span
              style={{
                fontSize: "10px",
                color: COLORS.accentRed,
                fontWeight: 700,
              }}
            >
              OVERFLOW
            </span>
          </div>
          <div
            style={{
              height: "5px",
              borderRadius: "99px",
              background: COLORS.darkElevated,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: "99px",
                background: `linear-gradient(90deg, ${COLORS.accentPurpleMuted}, ${COLORS.accentRed})`,
                animation: "bentoFillCut 3.2s ease-in-out infinite",
                width: "0%",
              }}
            />
          </div>
          {/* Chunk slots */}
          <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: "18px",
                  borderRadius: RADII.sm,
                  background:
                    i < 4 ? COLORS.darkElevated : `rgba(239,68,68,0.12)`,
                  border: `1px solid ${i < 4 ? COLORS.border : "rgba(239,68,68,0.28)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "8px",
                  fontWeight: 700,
                  color: i < 4 ? COLORS.textDim : COLORS.accentRed,
                }}
              >
                {i < 4 ? `C${i + 1}` : "✕"}
              </div>
            ))}
          </div>
        </div>
      );

    // ── "Real-time Visualization" — pulsing node + lines ─────────────────
    case "pulse-node":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              position: "relative",
              width: "38px",
              height: "38px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: COLORS.accentPurpleMuted,
                animation: "bentoNodePulse 2.2s ease-in-out infinite",
                opacity: 0.5,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "8px",
                borderRadius: "50%",
                background: COLORS.textPrimary,
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {[42, 66, 50].map((w, i) => (
              <div
                key={i}
                style={{
                  height: "3px",
                  width: `${w}px`,
                  borderRadius: "99px",
                  background: `rgba(168,85,247,0.35)`,
                  animation: `bentoLineFade ${1.6 + i * 0.45}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>
      );

    // ── "Adaptive Optimizer" — circular feedback arrow ────────────────────
    case "feedback-loop":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              flexShrink: 0,
              border: `2px solid rgba(168,85,247,0.4)`,
              borderTopColor: COLORS.accentPurple,
              borderRadius: "50%",
              animation: "bentoFeedbackSpin 2.4s linear infinite",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {["pass 1 — analyze", "pass 2 — optimize"].map((label, i) => (
              <div
                key={i}
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: i === 0 ? COLORS.textSecondary : COLORS.accentPurple,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      );

    // ── "Cinematic 3D Engine" — mini blob representation ─────────────────
    case "engine-blob":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              position: "relative",
              width: "44px",
              height: "44px",
              flexShrink: 0,
            }}
          >
            {/* Outer glow rings */}
            {[44, 34, 24].map((size, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: `${size}px`,
                  height: `${size}px`,
                  marginTop: `-${size / 2}px`,
                  marginLeft: `-${size / 2}px`,
                  borderRadius: "50%",
                  background:
                    i === 2 ? COLORS.accentPurpleMuted : "transparent",
                  border:
                    i < 2
                      ? `1px solid rgba(168,85,247,${0.25 - i * 0.1})`
                      : "none",
                  animation: `bentoBlobPulse ${2 + i * 0.4}s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {["React + Canvas", "Physics sim"].map((label, i) => (
              <div
                key={i}
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: COLORS.textMuted,
                  letterSpacing: "0.03em",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
};
