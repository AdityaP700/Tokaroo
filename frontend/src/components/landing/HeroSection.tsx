import React, { useEffect, useRef } from "react";
import Spline from "@splinetool/react-spline";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { COLORS, MOTION, TYPOGRAPHY } from "./tokens";

gsap.registerPlugin(ScrollTrigger);

interface HeroSectionProps {
  onNavigate: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  const heroRef = useRef<HTMLElement>(null);
  const orbWrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const revealLineRef = useRef<HTMLHeadingElement>(null);

  // Mouse parallax is already good. No changes needed here.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
        if (!orbWrapRef.current) return;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        gsap.to(orbWrapRef.current, {
          x: dx * 18,
          y: dy * 14,
          rotationX: -dy * 2.5,
          rotationY: dx * 2.5,
          duration: 2.2,
          ease: MOTION.ease,
          overwrite: "auto",
        });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Entrance + scroll exit animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance — staggered text reveal
      gsap.fromTo(
        ".hero-reveal",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          duration: MOTION.normal,
          ease: MOTION.ease,
          delay: 0.2,
        }
      );

      // Delayed reveal for the red "break" line
      gsap.fromTo(
        revealLineRef.current,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.9, ease: MOTION.ease, delay: 0.55 }
      );

      // Scroll exit animation
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
      tl.to(textRef.current, { opacity: 0, y: -70 }, 0)
        .to(orbWrapRef.current, { scale: 1.08, opacity: 0.55 }, 0)
        .to(overlayRef.current, { opacity: 1 }, 0);
    });
    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* CSS for blob breathing + chromatic text */}
      <style>{`
        @keyframes heroBlobBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .chromatic-text-shadow {
          text-shadow:
            1px 1px 0px #ef4444,
            -1px -1px 0px #3b82f6;
        }
        @keyframes heroBadgePulse {
            0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
            50% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.5); }
        }
      `}</style>

      {/* Fixed Spline Background */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* REFINED: Removed size constraints for full-bleed effect */}
          <div
            ref={orbWrapRef}
            style={{
              width: "120vw", // Larger than viewport
              height: "120vh",
              position: "relative",
              animation: "heroBlobBreathe 5s ease-in-out infinite",
            }}
          >
            <Spline
              scene="https://prod.spline.design/UP63e84psthVrHsD/scene.splinecode"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            background: COLORS.darkBg,
            opacity: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            background: "radial-gradient(ellipse at center, transparent 35%, rgba(10,10,10,0.9) 100%)",
          }}
        />
      </div>

      {/* Hero Section */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          minHeight: "200vh", // For scroll effect
          width: "100%",
          zIndex: 10,
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            ref={textRef}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              maxWidth: "820px",
              pointerEvents: "none",
            }}
          >
            {/* REFINED: Badge matches new spec */}
            <div
              className="hero-reveal"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                border: `1px solid ${COLORS.borderMid}`,
                borderRadius: "99px",
                marginBottom: "36px",
                background: "rgba(10,10,10,0.6)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: COLORS.accentRed,
                  animation: "heroBadgePulse 2.4s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  color: COLORS.textSecondary,
                  fontSize: TYPOGRAPHY.caption, // 11px
                  fontWeight: 700,
                  letterSpacing: TYPOGRAPHY.trackingXWide, // 0.12em
                  textTransform: "uppercase",
                }}
              >
                Tokaroo Core Active
              </span>
            </div>

            {/* REFINED: Primary headline with new typography */}
            <h1
              className="hero-reveal"
              style={{
                fontSize: "clamp(48px, 7vw, 96px)", // H1 size
                fontWeight: TYPOGRAPHY.weightBold, // 700
                lineHeight: 1.04,
                letterSpacing: "-0.02em", // Close to -2%
                margin: 0,
                color: COLORS.textPrimary,
              }}
            >
              See how your AI thinks{" "}
              <span style={{ opacity: 0.35, fontWeight: 400 }}>—</span>
            </h1>

            {/* REFINED: Reveal line with gradient and chromatic split effect */}
            <h1
              ref={revealLineRef}
              className="chromatic-text-shadow" // Added for effect
              style={{
                fontSize: "clamp(48px, 7vw, 96px)",
                fontWeight: TYPOGRAPHY.weightBold,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
                margin: "6px 0 0",
                opacity: 0, // GSAP reveals
                background: `linear-gradient(90deg, ${COLORS.accentRed} 0%, ${COLORS.accentPurple} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Then watch it break
            </h1>

            {/* REFINED: Subtext with new typography */}
            <p
              className="hero-reveal"
              style={{
                fontSize: "16px", // Body size
                color: COLORS.textSecondary,
                lineHeight: 1.6, // New line height
                margin: "28px 0 0",
                maxWidth: "520px", // New max width
                fontWeight: TYPOGRAPHY.weightNormal,
              }}
            >
              Visualize token flow, attention decay, and failure patterns in real-time. The X-ray your RAG pipeline has been missing.
            </p>

            <div
              className="hero-reveal"
              style={{
                display: "flex",
                gap: "14px",
                marginTop: "44px",
                pointerEvents: "auto",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <PrimaryButton onClick={onNavigate}>Start Diagnosis</PrimaryButton>
              <GlassButton onClick={onNavigate}>Watch Demo</GlassButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

// Button components remain the same, styles are good.
const PrimaryButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      background: COLORS.textPrimary,
      color: COLORS.darkBg,
      border: "none",
      borderRadius: "99px",
      padding: "14px 36px",
      fontSize: "15px",
      fontWeight: 700,
      cursor: "pointer",
      letterSpacing: "-0.01em",
      transition: `transform ${MOTION.micro}s ${MOTION.ease}, box-shadow ${MOTION.micro}s ease`,
    }}
    onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
    onMouseOut={(e) => (e.currentTarget.style.transform = "none")}
  >
    {children}
  </button>
);

const GlassButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      background: "rgba(168,85,247,0.08)",
      color: COLORS.textPrimary,
      border: `1px solid rgba(168,85,247,0.25)`,
      borderRadius: "99px",
      padding: "14px 36px",
      fontSize: "15px",
      fontWeight: 600,
      cursor: "pointer",
      letterSpacing: "-0.01em",
      backdropFilter: "blur(16px)",
      transition: `all ${MOTION.micro}s ${MOTION.ease}`,
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.background = "rgba(168,85,247,0.14)";
      e.currentTarget.style.borderColor = "rgba(168,85,247,0.5)";
      e.currentTarget.style.boxShadow = `0 0 24px rgba(168,85,247,0.2)`;
      e.currentTarget.style.transform = "translateY(-3px)";
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.background = "rgba(168,85,247,0.08)";
      e.currentTarget.style.borderColor = "rgba(168,85,247,0.25)";
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.transform = "none";
    }}
  >
    {children}
  </button>
);