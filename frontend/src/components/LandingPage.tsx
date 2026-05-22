import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spline from '@splinetool/react-spline';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// Data ─────────────────────────────────────────────────────────────────
const FAILURES = [
  { title: 'Lost in the Middle', desc: 'LLMs systematically ignore context placed in the center of the window. Chunks 3–7 are often invisible to the model.', metric: '40–60%', metricLabel: 'attention lost' },
  { title: 'Semantic Mismatch', desc: 'Retrieved chunks match lexically but diverge semantically. The model confidently produces wrong answers.', metric: '23%', metricLabel: 'avg. retrieval noise' },
  { title: 'Context Overflow', desc: 'When total tokens exceed the window, chunks get silently dropped. The model never sees critical information.', metric: '128k →', metricLabel: 'silent truncation' },
];

const PIPELINE = [
  { num: '01', label: 'Input',    desc: 'Paste any document or set retrieval parameters.' },
  { num: '02', label: 'Simulate', desc: 'Chunk, rerank, and model attention across the context window.' },
  { num: '03', label: 'Diagnose', desc: 'Issues ranked by severity, mapped to graph nodes.' },
  { num: '04', label: 'Optimize', desc: 'Adjust parameters in real time to resolve failures.' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const goToApp = () => navigate('/app/context');

  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const systemSectionRef = useRef<HTMLDivElement>(null);
  
  const splineOrbRef = useRef<any>();

  useEffect(() => {
    // Smooth Scrolling with Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Hero GSAP Scroll Timeline
    if (heroRef.current && orbRef.current && particlesRef.current && textRef.current) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: '+=150%',
          scrub: 1,
          pin: true,
        }
      });

      // Phase 1 (0-30%) - Calm to slight scale
      tl.to(textRef.current, { opacity: 0, y: -50, duration: 0.3 }, 0)
        .to(orbRef.current, { scale: 1.5, duration: 0.6 }, 0)
        .to(particlesRef.current, { scale: 1.2, opacity: 0.5, duration: 0.6 }, 0);

      // Phase 2 (30-60%) - Destabilize
      tl.to(orbRef.current, { 
          scale: 3, 
          opacity: 0, 
          filter: 'blur(20px) contrast(150%)',
          duration: 0.4 
        }, 0.6)
        .to(particlesRef.current, { 
          scale: 2, 
          opacity: 1,
          duration: 0.4 
        }, 0.6);
    }

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div ref={containerRef} style={{ background: '#050505', color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 3.5rem', height: '64px',
        background: 'rgba(5, 5, 5, 0.4)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#050505' }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', color: '#F5F5F5' }}>Tokaroo</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={{ background: 'transparent', border: 'none', color: '#9CA3AF', padding: '0.5rem 1rem', fontSize: '13px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#F5F5F5'} onMouseOut={e => e.currentTarget.style.color = '#9CA3AF'}>Docs</button>
          <button onClick={goToApp} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F5F5', padding: '0.45rem 1.2rem', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>Open App</button>
        </div>
      </nav>

      {/* ── CINEMATIC HERO ─────────────────────────────────────────────── */}
      <section ref={heroRef} style={{
        position: 'relative',
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#050505',
      }}>
        {/* Layer 1: Subtle Vignette / Gradient Light */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(circle at center, rgba(255,59,59,0.03) 0%, rgba(5,5,5,1) 70%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          boxShadow: 'inset 0 0 150px rgba(0,0,0,0.9)',
        }} />

        {/* Layer 2: Particle Field */}
        <div ref={particlesRef} style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          opacity: 0.3,
          transformOrigin: 'center center',
        }}>
          <Spline scene="https://prod.spline.design/LHmTpPo9cVW2yCtl/scene.splinecode" />
        </div>

        {/* Layer 3: Main Cognitive Orb */}
        <div ref={orbRef} style={{
          position: 'absolute',
          width: '100%', height: '100%',
          zIndex: 3,
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transformOrigin: 'center center',
          mixBlendMode: 'screen',
        }}>
           <div style={{ width: '800px', height: '800px', position: 'absolute' }}>
             <Spline scene="https://prod.spline.design/UP63e84psthVrHsD/scene.splinecode" onLoad={(splineApp) => { splineOrbRef.current = splineApp; }} />
           </div>
        </div>

        {/* Layer 4: Floating Token Fragments */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
           <div style={{ position: 'absolute', top: '30%', left: '20%', width: '4px', height: '4px', background: 'rgba(255,255,255,0.2)' }} />
           <div style={{ position: 'absolute', top: '60%', left: '75%', width: '3px', height: '3px', background: 'rgba(255,59,59,0.3)' }} />
           <div style={{ position: 'absolute', top: '70%', left: '30%', width: '5px', height: '5px', background: 'rgba(79,140,255,0.2)' }} />
        </div>

        {/* Layer 5: UI Overlay */}
        <div ref={textRef} style={{
          position: 'relative', zIndex: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          gap: '1.5rem', maxWidth: '800px', pointerEvents: 'none',
          marginTop: '-4vh'
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', background: 'rgba(11,11,11,0.6)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '99px', backdropFilter: 'blur(12px)',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#FF3B3B',
              boxShadow: '0 0 10px rgba(255,59,59,0.6)',
            }} />
            <span style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tokaroo Core Active</span>
          </div>

          <h1 style={{
             fontSize: '5rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.04em', margin: 0,
             color: '#F5F5F5',
             textShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            See how your AI thinks — <br />
            <span style={{ color: '#9CA3AF' }}>Then watch it break</span>
          </h1>

          <p style={{ fontSize: '1.25rem', color: '#9CA3AF', lineHeight: 1.6, margin: 0, maxWidth: '520px', fontWeight: 400 }}>
            Visualize token flow, attention decay, and failure patterns in real time.
          </p>

          <div style={{ display: 'flex', gap: '16px', marginTop: '1rem', pointerEvents: 'auto' }}>
            <button onClick={goToApp} style={{ 
              background: '#F5F5F5', color: '#050505', 
              border: 'none', borderRadius: '8px', 
              padding: '1rem 2rem', fontSize: '14px', fontWeight: 500, 
              cursor: 'pointer', transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(255,255,255,0.1)'
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,255,255,0.15)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,255,255,0.1)'; }}
            >
              Start Simulation
            </button>
            <button onClick={goToApp} style={{ 
              background: 'rgba(255,255,255,0.03)', color: '#F5F5F5', 
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', 
              padding: '1rem 2rem', fontSize: '14px', fontWeight: 500, 
              cursor: 'pointer', transition: 'all 0.3s', backdropFilter: 'blur(8px)'
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              View Pipeline
            </button>
          </div>
        </div>

        {/* Scroll Hint */}
        <div style={{
          position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          color: '#9CA3AF', fontSize: '12px', fontWeight: 500, letterSpacing: '0.05em',
          opacity: 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
        }}>
          Scroll to explore system
          <div style={{ width: '1px', height: '24px', background: 'linear-gradient(to bottom, rgba(156,163,175,0.5), transparent)' }} />
        </div>
      </section>

      {/* ── SECTION 1 — Feature System (Transitioned from Hero) ──────── */}
      <section ref={systemSectionRef} style={{ 
        position: 'relative', padding: '8rem 5rem', background: '#0B0B0B',
        borderTop: '1px solid rgba(255,255,255,0.05)', zIndex: 10 
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ marginBottom: '4rem', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#4F8CFF', textTransform: 'uppercase', marginBottom: '12px' }}>System Architecture</div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: '#F5F5F5' }}>
              The invisible failures
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '1.1rem', marginTop: '1rem', maxWidth: '600px', margin: '1rem auto 0' }}>
              These problems exist in every RAG system. Most teams never see them until it's too late.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
            {FAILURES.map((f, i) => (
              <div key={f.title} style={{ padding: '3rem 2rem', background: '#0B0B0B', display: 'flex', flexDirection: 'column', gap: '1.5rem', transition: 'background 0.3s' }}
                   onMouseOver={e => e.currentTarget.style.background = '#111111'}
                   onMouseOut={e => e.currentTarget.style.background = '#0B0B0B'}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 700, color: i === 0 ? '#FF3B3B' : '#F5F5F5', letterSpacing: '-0.02em' }}>{f.metric}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>{f.metricLabel}</div>
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '18px', marginBottom: '10px', color: '#F5F5F5' }}>{f.title}</div>
                  <div style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — Tokaroo reveals it (pipeline) ────────────────── */}
      <section style={{ padding: '8rem 5rem', maxWidth: '1280px', margin: '0 auto', background: '#050505' }}>
        <div style={{ marginBottom: '4rem' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: '#FF3B3B', textTransform: 'uppercase', marginBottom: '12px' }}>Tokaroo reveals it</div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: '#F5F5F5' }}>
            Visualize → Diagnose → Optimize
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
          {PIPELINE.map((step) => (
            <div key={step.num} style={{ padding: '2.5rem 2rem', background: '#0B0B0B' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#4F8CFF', marginBottom: '16px' }}>{step.num}</div>
              <div style={{ fontWeight: 600, fontSize: '18px', marginBottom: '10px', color: '#F5F5F5' }}>{step.label}</div>
              <div style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────── */}
      <section style={{
        padding: '8rem 5rem', background: '#0B0B0B', borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '2rem',
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F5F5F5', boxShadow: '0 0 20px rgba(255,255,255,0.3)' }} />
        </div>
        <h2 style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.03em', margin: 0, maxWidth: '600px', color: '#F5F5F5' }}>
          Start understanding your RAG pipeline
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: '1.15rem', margin: 0, maxWidth: '500px' }}>
          Connected to the Tokaroo backend. Real diagnostics, real chunk analysis, no mock graph.
        </p>
        <button onClick={goToApp} style={{ 
          marginTop: '1rem', background: '#F5F5F5', color: '#050505', 
          border: 'none', borderRadius: '8px', 
          padding: '1rem 2.5rem', fontSize: '15px', fontWeight: 600, 
          cursor: 'pointer', transition: 'transform 0.3s, box-shadow 0.3s',
          boxShadow: '0 4px 20px rgba(255,255,255,0.1)'
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,255,255,0.15)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,255,255,0.1)'; }}
        >
          Open Simulator
        </button>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.05)', padding: '2rem 5rem', background: '#050505',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#050505' }} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#F5F5F5' }}>Tokaroo</span>
        </div>
        <div style={{ fontSize: '13px', color: '#9CA3AF' }}>AI Cognitive Visualization System</div>
      </footer>

      {/* Grain Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
      }} />
    </div>
  );
};

