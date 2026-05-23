import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spline from '@splinetool/react-spline';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// ─── Data ────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    title: 'Lost in the Middle',
    desc: 'LLMs systematically ignore context placed in the center of the window. Chunks 3–7 are often invisible to the model.',
  },
  {
    title: 'Semantic Mismatch',
    desc: 'Retrieved chunks match lexically but diverge semantically. The model confidently produces wrong answers.',
  },
  {
    title: 'Context Overflow',
    desc: 'When total tokens exceed the window, chunks get silently dropped. The model never sees critical information.',
  },
];

const STEPS = [
  { num: '01', title: 'Input', desc: 'Paste document or parameters.' },
  { num: '02', title: 'Process', desc: 'Chunk, rerank, and model.' },
  { num: '03', title: 'Visualize', desc: 'See failures in real time.' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const goToApp = () => navigate('/app/context');

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Hero Refs
  const heroRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const orbWrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Section Refs for GSAP
  const whatItDoesRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // ── Header Scroll Behavior
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Cursor Reactive Lighting (Subtle)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  useEffect(() => {
    if (!orbWrapperRef.current) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (cursorPos.x - cx) / cx;
    const dy = (cursorPos.y - cy) / cy;
    gsap.to(orbWrapperRef.current, {
      x: dx * 15,
      y: dy * 15,
      rotationX: -dy * 2,
      rotationY: dx * 2,
      duration: 2,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }, [cursorPos]);

  // ── Lenis Smooth Scroll & GSAP Animations
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // 1. HERO SCROLL TRANSITION (Very Subtle)
    if (heroRef.current && textRef.current && orbWrapperRef.current && overlayRef.current) {
      const heroTl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });

      // Text fades out and moves up smoothly
      heroTl.to(textRef.current, { opacity: 0, y: -60, duration: 1, ease: 'power2.inOut' }, 0);
      // Blob grows very slightly and fades down a bit for depth
      heroTl.to(orbWrapperRef.current, { scale: 1.1, opacity: 0.6, duration: 1, ease: 'power1.inOut' }, 0);
      // Background darkens
      heroTl.to(overlayRef.current, { opacity: 1, duration: 1, ease: 'power2.inOut' }, 0);
    }

    // 2. WHAT IT DOES - Reveal Animation
    if (whatItDoesRef.current) {
      const els = whatItDoesRef.current.querySelectorAll('.reveal-el');
      gsap.fromTo(els, 
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0,
          duration: 1.2,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: whatItDoesRef.current,
            start: 'top 75%',
          }
        }
      );
    }

    // 3. FEATURES - Parallax & Stagger
    if (featuresRef.current) {
      const items = featuresRef.current.querySelectorAll('.feature-item');
      items.forEach((item, i) => {
        gsap.fromTo(item,
          { opacity: 0, y: 60 },
          {
            opacity: 1, y: 0,
            duration: 1.4,
            ease: 'expo.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 80%',
            }
          }
        );
      });
    }

    // 4. HOW IT WORKS - Grid Stagger
    if (howItWorksRef.current) {
      const steps = howItWorksRef.current.querySelectorAll('.step-card');
      gsap.fromTo(steps,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0,
          duration: 1,
          stagger: 0.15,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: howItWorksRef.current,
            start: 'top 80%',
          }
        }
      );
    }

    // 5. CTA - Scale & Fade
    if (ctaRef.current) {
      const elements = ctaRef.current.querySelectorAll('.cta-reveal');
      gsap.fromTo(elements,
        { opacity: 0, scale: 0.95, y: 20 },
        {
          opacity: 1, scale: 1, y: 0,
          duration: 1.2,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ctaRef.current,
            start: 'top 85%',
          }
        }
      );
    }

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        background: '#0A0A0A',
        color: '#EAEAEA',
        fontFamily: 'Inter, sans-serif',
        overflow: 'clip',
      }}
    >
      <style>{`
        body { background: #0A0A0A; }
        .line-anim {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, #8B5CF6, transparent);
          background-size: 200% 100%;
          animation: scan 4s linear infinite;
          opacity: 0.5;
        }
        @keyframes scan {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 8px rgba(255,59,59,0.5); }
          50%       { box-shadow: 0 0 16px rgba(255,59,59,0.8); }
        }
      `}</style>

      {/* ── FIXED BACKGROUND LAYER ──────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
        }}
      >
        {/* Blob Wrapper: Center aligned, preserving aspect ratio so it isn't completely distorted */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100vw', height: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            perspective: '1000px',
          }}
        >
          <div
            ref={orbWrapperRef}
            style={{
              width: '80vw', height: '80vw',
              maxWidth: '900px', maxHeight: '900px',
              position: 'relative',
              filter: 'saturate(0.75) brightness(0.85) contrast(1.05)',
            }}
          >
            <Spline
              scene="https://prod.spline.design/UP63e84psthVrHsD/scene.splinecode"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* Cinematic Darkness Overlay */}
        <div
          ref={overlayRef}
          style={{
            position: 'absolute', inset: 0, zIndex: 2,
            background: '#0A0A0A', opacity: 0, // Gets darker on scroll
          }}
        />

        {/* Global Vignette to ensure text readability */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10,10,10,0.85) 100%)',
        }} />
      </div>

      {/* ── SCROLL CONTENT LAYER ────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10 }}>

        {/* ── NAV ──────────────────────────────────────────────────────── */}
        <nav
          style={{
            position: 'fixed', top: 0, width: '100%', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 3.5rem', height: '70px',
            background: headerScrolled ? 'rgba(10,10,10,0.85)' : 'transparent',
            backdropFilter: headerScrolled ? 'blur(16px)' : 'none',
            borderBottom: headerScrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Tokaroo Logo Icon restored */}
            <div style={{
              width: '26px', height: '26px', borderRadius: '8px',
              background: '#EAEAEA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0A0A0A' }} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '16px', letterSpacing: '-0.02em', color: '#EAEAEA' }}>
              Tokaroo
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              style={{
                background: 'transparent', border: 'none',
                color: '#A1A1AA', padding: '0.5rem 1rem',
                fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.color = '#EAEAEA'}
              onMouseOut={e => e.currentTarget.style.color = '#A1A1AA'}
            >
              Docs
            </button>
            <button
              onClick={goToApp}
              style={{
                background: '#EAEAEA', color: '#0A0A0A',
                border: 'none', borderRadius: '99px',
                padding: '8px 20px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', transition: 'transform 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'none'}
            >
              Open App
            </button>
          </div>
        </nav>

        {/* ── HERO SECTION ─────────────────────────────────────────────── */}
        {/* 200vh gives us plenty of scroll distance for the GSAP scrub transition */}
        <section ref={heroRef} style={{ position: 'relative', minHeight: '200vh', width: '100%' }}>
          <div style={{
            position: 'sticky', top: 0,
            height: '100vh', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div ref={textRef} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', textAlign: 'center',
              maxWidth: '800px', pointerEvents: 'none',
              marginTop: '-4vh',
            }}>
              {/* Badge Restored */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 16px', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '99px', marginBottom: '32px',
                background: 'rgba(10,10,10,0.5)', backdropFilter: 'blur(8px)',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#FF3B3B', animation: 'badgePulse 2.4s ease-in-out infinite',
                }} />
                <span style={{
                  color: 'rgba(234,234,234,0.7)', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Tokaroo Core Active
                </span>
              </div>

              {/* Headline */}
              <h1 style={{
                fontSize: 'clamp(3rem, 6vw, 5.5rem)', fontWeight: 600,
                lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0,
                color: '#EAEAEA', textShadow: '0 4px 32px rgba(0,0,0,0.8)',
              }}>
                See how your AI thinks <span style={{ opacity: 0.5, fontWeight: 400 }}>—</span>
              </h1>
              
              {/* Correct Identity Hook (Red) */}
              <h1 style={{
                fontSize: 'clamp(3.2rem, 6.2vw, 5.8rem)', fontWeight: 600,
                lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, marginTop: '4px',
                color: '#FF3B3B', opacity: 0.9, textShadow: '0 4px 32px rgba(0,0,0,0.8)',
              }}>
                Then watch it break
              </h1>

              <p style={{
                fontSize: '19px', color: '#A1A1AA',
                lineHeight: 1.6, margin: '24px 0 0 0', maxWidth: '520px',
                fontWeight: 400, textShadow: '0 2px 16px rgba(0,0,0,0.8)',
              }}>
                Visualize token flow, attention decay, and failure patterns in real time.
              </p>

              <div style={{ display: 'flex', gap: '16px', marginTop: '40px', pointerEvents: 'auto' }}>
                <button
                  onClick={goToApp}
                  style={{
                    background: '#EAEAEA', color: '#0A0A0A',
                    border: 'none', borderRadius: '99px',
                    padding: '14px 32px', fontSize: '15px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 4px 16px rgba(234,234,234,0.1)',
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'none'}
                >
                  Start Simulation
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHAT IT DOES ─────────────────────────────────────────────── */}
        {/* Background #0A0A0A masks the fixed layer cleanly from this point down */}
        <section ref={whatItDoesRef} style={{
          padding: '10rem 2rem', background: '#0A0A0A',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          position: 'relative', zIndex: 10,
        }}>
          <h2 className="reveal-el" style={{ fontSize: '3.2rem', fontWeight: 600, color: '#EAEAEA', margin: '0 0 16px 0', letterSpacing: '-0.03em' }}>
            Understand how your AI behaves
          </h2>
          <p className="reveal-el" style={{ fontSize: '1.25rem', color: '#A1A1AA', margin: '0 0 80px 0', fontWeight: 400 }}>
            Visualize token flow, attention, and failure
          </p>
          
          <div className="reveal-el" style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="line-anim" style={{ height: '2px' }} />
            <div className="line-anim" style={{ height: '2px', animationDelay: '0.8s', opacity: 0.3 }} />
            <div className="line-anim" style={{ height: '2px', animationDelay: '1.6s', opacity: 0.15 }} />
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────────────── */}
        <section ref={featuresRef} style={{ padding: '8rem 2rem 14rem 2rem', background: '#0A0A0A', maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14rem' }}>
            {FEATURES.map((feature, idx) => (
              <div key={idx} className="feature-item" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ fontSize: '2.8rem', fontWeight: 600, color: '#EAEAEA', margin: 0, letterSpacing: '-0.03em' }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: '1.2rem', color: '#A1A1AA', margin: 0, maxWidth: '600px', lineHeight: 1.6 }}>
                  {feature.desc}
                </p>
                <div style={{ width: '48px', height: '2px', background: '#8B5CF6', marginTop: '16px' }} />
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
        <section ref={howItWorksRef} style={{ padding: '12rem 2rem', background: '#0A0A0A', borderTop: '1px solid rgba(234,234,234,0.06)', position: 'relative', zIndex: 10 }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '64px' }}>
            {STEPS.map((step) => (
              <div key={step.num} className="step-card" style={{ flex: '1 1 280px' }}>
                <div style={{ color: '#8B5CF6', fontSize: '14px', fontWeight: 600, marginBottom: '24px', letterSpacing: '0.05em' }}>
                  {step.num}
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 600, color: '#EAEAEA', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                  {step.title}
                </div>
                <div style={{ color: '#A1A1AA', fontSize: '1.15rem', lineHeight: 1.6 }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
        <section ref={ctaRef} style={{
          padding: '16rem 2rem 20rem 2rem', background: '#0A0A0A',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          position: 'relative', zIndex: 10,
        }}>
          <h2 className="cta-reveal" style={{ fontSize: '4rem', fontWeight: 600, color: '#EAEAEA', margin: '0 0 48px 0', letterSpacing: '-0.04em' }}>
            Start exploring your AI
          </h2>
          <button
            onClick={goToApp}
            className="cta-reveal"
            style={{
              background: '#EAEAEA', color: '#0A0A0A',
              border: 'none', borderRadius: '99px',
              padding: '18px 48px', fontSize: '17px', fontWeight: 600,
              cursor: 'pointer', marginBottom: '24px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 8px 32px rgba(234,234,234,0.1)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(234,234,234,0.15)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(234,234,234,0.1)';
            }}
          >
            Start Simulation
          </button>
          <div className="cta-reveal" style={{ color: '#A1A1AA', fontSize: '15px' }}>
            Connect to the Tokaroo backend for real diagnostics.
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer style={{
          padding: '4rem 2rem',
          background: '#050505',
          borderTop: '1px solid rgba(234,234,234,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          position: 'relative',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '6px',
              background: '#EAEAEA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0A0A0A' }} />
            </div>
            <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.02em', color: '#EAEAEA' }}>
              Tokaroo
            </span>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: '#A1A1AA', fontSize: '13px' }}>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Contact</a>
          </div>
          <div style={{ color: '#52525B', fontSize: '12px', marginTop: '16px' }}>
            © {new Date().getFullYear()} Tokaroo. All rights reserved.
          </div>
        </footer>

      </div>
    </div>
  );
};
