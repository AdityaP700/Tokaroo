/**
 * LandingPage.tsx — Thin Orchestrator
 *
 * Responsibilities:
 *   1. Initialize Lenis smooth scroll + wire to GSAP ticker
 *   2. Compose section components in order
 *   3. Pass `onNavigate` down to sections that need CTA buttons
 *
 * All design logic, animations, and data live in ./landing/:
 *   tokens.ts          — design tokens (colors, type, motion, shadows)
 *   constants.ts       — narrative steps + bento card data
 *   LandingNav.tsx     — scroll-aware fixed navigation
 *   HeroSection.tsx    — cinematic theater hero + Spline orb
 *   NarrativeSection.tsx — sticky scroll "Cognitive Autopsy" + NetworkCluster
 *   BentoSection.tsx   — 6-card diagnostic panel
 *   CtaSection.tsx     — launch sequence CTA with pulsing button
 *   FooterSection.tsx  — minimal footer with wordmark easter egg
 */
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

import { LandingNav } from "./landing/LandingNav";
import { HeroSection } from "./landing/HeroSection";
import { NarrativeSection } from "./landing/NarrativeSection";
import { BentoSection } from "./landing/BentoSection";
import { CtaSection } from "./landing/CtaSection";
import { FooterSection } from "./landing/FooterSection";
import { COLORS } from "./landing/tokens";

gsap.registerPlugin(ScrollTrigger);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const goToApp = () => navigate("/app/context");

  // ── Lenis smooth scroll — keeps GSAP ScrollTrigger in sync
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    lenis.on("scroll", ScrollTrigger.update);
    const tickerId = gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(tickerId);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      style={{
        background: COLORS.darkBg,
        color: COLORS.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        overflow: "clip",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <LandingNav onNavigate={goToApp} />
      <HeroSection onNavigate={goToApp} />
      <NarrativeSection />
      <BentoSection />
      <CtaSection onNavigate={goToApp} />
      <FooterSection />
    </div>
  );
};
