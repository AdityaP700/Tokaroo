import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SemanticNetworkEngine } from './SemanticNetworkEngine';

// ── Scroll fade-in hook ──────────────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, style: {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 0.7s ease, transform 0.7s ease',
  } as React.CSSProperties };
}

// ── Data ─────────────────────────────────────────────────────────────────
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
  const fgRef = useRef<any>(null);
  const goToApp = () => navigate('/app/context');

  const [engineState, setEngineState] = useState<'normal' | 'failure' | 'recovery'>('normal');

  // Reveal hooks for each section
  const failuresReveal = useScrollReveal();
  const pipelineReveal = useScrollReveal();
  const previewReveal  = useScrollReveal();
  const ctaReveal      = useScrollReveal();

  useEffect(() => {
    if (fgRef.current) fgRef.current.d3Force('charge')?.strength(-60);
  }, []);

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 3.5rem', height: '54px',
        background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/ChatGPT_Image_May_24__2026__04_48_23_PM-removebg-preview.png" alt="Kangaroo logo" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }} />
          <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.01em' }}>Tokaroo</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn-ghost" style={{ padding: '0.4rem 1rem', fontSize: '13px' }}>Docs</button>
          <button className="btn-primary" onClick={goToApp} style={{ padding: '0.45rem 1.2rem', fontSize: '13px', width: 'auto' }}>Open App</button>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '0 5rem',
        overflow: 'hidden',
        background: '#050505',
      }}>
        {/* Cinematic gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(circle at center, transparent 40%, #000 100%)'
        }} />

        {/* 3D Canvas Full Bleed on Right */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '65%', zIndex: 0
        }}>
          <SemanticNetworkEngine onStateChange={setEngineState} />
        </div>

        {/* Content (Left) */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px', pointerEvents: 'none' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '99px', width: 'fit-content', backdropFilter: 'blur(8px)', pointerEvents: 'auto',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            opacity: engineState === 'failure' ? 0.6 : 1,
            transform: engineState === 'failure' ? 'translateY(-2px)' : 'translateY(0)',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: engineState === 'failure' ? '#FF3B3B' : 'var(--success)',
              boxShadow: engineState === 'failure' ? '0 0 8px #FF3B3B' : '0 0 8px var(--success)',
              transition: 'background 0.4s ease, box-shadow 0.4s ease'
            }} />
            <span className="label" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Tokaroo v2 Open Beta</span>
          </div>

          <h1 style={{
             fontSize: '4.5rem', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.04em', margin: 0,
             transition: 'color 0.4s ease, transform 0.4s ease',
             transform: engineState === 'failure' ? 'translateY(2px)' : 'translateY(0)'
          }}>
            {engineState === 'normal' || engineState === 'recovery' ? (
              <>See how your AI actually thinks — <br />
              <span style={{ color: 'rgba(255,255,255,0.4)', transition: 'color 0.4s ease' }}>before it fails</span></>
            ) : (
              <><span style={{ color: 'rgba(255,255,255,0.4)' }}>See how your AI actually thinks — </span><br />
              <span style={{ color: '#FF3B3B', transition: 'color 0.4s ease' }}>Then watch it break</span></>
            )}
          </h1>

          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxWidth: '440px' }}>
            Visualize attention decay, chunking failures, and retrieval blind spots in real-time inside the LLM context window.
          </p>

          <div style={{ display: 'flex', gap: '16px', marginTop: '1rem', pointerEvents: 'auto' }}>
            <button className="btn-primary" onClick={goToApp} style={{ width: 'auto', padding: '1rem 2.25rem', fontSize: '15px' }}>
              Start Simulation
            </button>
            <button className="btn-ghost" onClick={goToApp} style={{ padding: '1rem 2.25rem', fontSize: '15px' }}>
              View Pipeline  →
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 1 — Where AI fails silently ──────────────────────── */}
      <section ref={failuresReveal.ref} style={{ ...failuresReveal.style, padding: '6rem 5rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <div className="label" style={{ marginBottom: '8px' }}>Where AI fails silently</div>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              The invisible failures
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.75rem', maxWidth: '560px' }}>
              These problems exist in every RAG system. Most teams never see them.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            {FAILURES.map((f) => (
              <div key={f.title} style={{ padding: '2rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div className="value-mono" style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}>{f.metric}</div>
                  <div className="label" style={{ marginTop: '2px' }}>{f.metricLabel}</div>
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>{f.title}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — Tokaroo reveals it (pipeline) ────────────────── */}
      <section ref={pipelineReveal.ref} style={{ ...pipelineReveal.style, padding: '6rem 5rem', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem' }}>
          <div className="label" style={{ marginBottom: '8px' }}>Tokaroo reveals it</div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Visualize → Diagnose → Optimize
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {PIPELINE.map((step) => (
            <div key={step.num} style={{ padding: '2rem 1.75rem', background: 'var(--surface)' }}>
              <div className="value-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>{step.num}</div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>{step.label}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3 — Demo preview ─────────────────────────────────── */}
      <section ref={previewReveal.ref} style={{ ...previewReveal.style, padding: '6rem 5rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="label" style={{ marginBottom: '8px' }}>Product Preview</div>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              Three views. One system.
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '1rem' }}>
              Graph, Context Strip, and Attention — all synchronized.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            {/* Graph preview (enhanced) */}
            <div style={{ padding: '1.5rem', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="label">Graph</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nodes · Edges · Attention</div>
              </div>
              <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {[
                  { x: 38, y: 40, r: 10 }, { x: 90, y: 55, r: 16 }, { x: 140, y: 28, r: 8 },
                  { x: 70, y: 86, r: 12 }, { x: 118, y: 72, r: 6 }, { x: 162, y: 62, r: 9 },
                ].map((n, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: n.x, top: n.y,
                    width: n.r * 2, height: n.r * 2, borderRadius: '50%',
                    background: i === 1 ? 'rgba(250,250,250,0.95)' : 'rgba(255,255,255,0.06)',
                    boxShadow: i === 1 ? '0 0 12px rgba(255,255,255,0.08)' : 'none',
                    border: i === 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                  }} />
                ))}
                {/* mini legend */}
                <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(250,250,250,0.95)' }} /> <span>Used</span>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(249,115,22,0.8)' }} /> <span>Noise</span>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Visualize chunks as nodes and semantic edges. Bright nodes indicate high attention and usage.
              </div>
            </div>

            {/* Token strip preview (enhanced Flow) */}
            <div style={{ padding: '1.5rem', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="label">Context Strip</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Width = tokens · Brightness = attention</div>
              </div>
              <div style={{ display: 'flex', gap: '2px', height: '36px', borderRadius: '6px', overflow: 'hidden', alignItems: 'center' }}>
                {[0.85, 0.65, 0.35, 0.22, 0.18, 0.5, 0.75, 0.45].map((a, i) => (
                  <div key={i} title={`Chunk ${i + 1}`} style={{
                    flex: `${Math.max(0.6, a * 3)} 0 0`,
                    minWidth: 6,
                    background: `rgba(250,250,250,${(a * 0.75).toFixed(2)})`,
                    borderBottom: i === 3 ? '3px solid var(--danger)' : 'none',
                    opacity: i >= 2 && i <= 4 ? 0.6 : 1,
                    transition: 'transform 0.18s',
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <div>⟲ Start bias</div>
                <div style={{ opacity: 0.8 }}>↕ Middle decay</div>
                <div>⚠ Risk marker</div>
              </div>
            </div>

            {/* Sparkline preview (enhanced) */}
            <div style={{ padding: '1.5rem', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="label">Attention</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Low ↔ High</div>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="100%" height="60" viewBox="0 0 200 60">
                  <defs>
                    <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(250,250,250,0.12)" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                  <polyline points="0,30 28,22 56,38 84,50 112,48 140,32 168,18 200,26" fill="none" stroke="rgba(250,250,250,0.65)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Live attention distribution across the context window. Peaks indicate chunks the model focuses on.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────── */}
      <section ref={ctaReveal.ref} style={{
        ...ctaReveal.style,
        padding: '6rem 5rem', borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: '1.5rem',
      }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, maxWidth: '520px' }}>
          Start understanding your RAG pipeline
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0 }}>
          No backend required. Runs entirely in your browser.
        </p>
        <button className="btn-primary" onClick={goToApp} style={{ width: 'auto', padding: '0.85rem 2.25rem', fontSize: '15px' }}>
          Open Simulator  →
        </button>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '1.5rem 5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/ChatGPT_Image_May_24__2026__04_48_23_PM-removebg-preview.png" alt="Kangaroo logo" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover', boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }} />
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Tokaroo</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AI Cognitive Visualization System</div>
      </footer>
    </div>
  );
};