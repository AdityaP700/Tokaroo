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
          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
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
            {/* Graph preview */}
            <div style={{ padding: '1.5rem', background: 'var(--bg)' }}>
              <div className="label" style={{ marginBottom: '12px' }}>Graph</div>
              <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {/* Mini node cluster */}
                {[
                  { x: 40, y: 30, r: 10 }, { x: 90, y: 55, r: 14 }, { x: 140, y: 25, r: 8 },
                  { x: 70, y: 80, r: 12 }, { x: 120, y: 70, r: 6 }, { x: 160, y: 60, r: 9 },
                ].map((n, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: n.x, top: n.y,
                    width: n.r * 2, height: n.r * 2, borderRadius: '50%',
                    background: i === 1 ? '#FAFAFA' : '#2A2A2A',
                    boxShadow: i === 1 ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.5 }}>
                Chunks as nodes. Edges as semantic flow. Center = highest relevance.
              </div>
            </div>

            {/* Token strip preview */}
            <div style={{ padding: '1.5rem', background: 'var(--bg)' }}>
              <div className="label" style={{ marginBottom: '12px' }}>Context Strip</div>
              <div style={{ display: 'flex', gap: '2px', height: '32px', borderRadius: '4px', overflow: 'hidden', marginTop: '44px' }}>
                {[0.8, 0.6, 0.3, 0.2, 0.15, 0.5, 0.7, 0.4].map((a, i) => (
                  <div key={i} style={{
                    flex: 1,
                    background: `rgba(250,250,250,${(a * 0.7).toFixed(2)})`,
                    borderBottom: i === 3 ? '2px solid var(--danger)' : 'none',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.5 }}>
                Width = tokens. Brightness = attention. Red border = risk.
              </div>
            </div>

            {/* Sparkline preview */}
            <div style={{ padding: '1.5rem', background: 'var(--bg)' }}>
              <div className="label" style={{ marginBottom: '12px' }}>Attention</div>
              <svg width="100%" height="60" viewBox="0 0 200 60" style={{ marginTop: '44px' }}>
                <polyline
                  points="0,20 25,15 50,30 75,45 100,50 125,35 150,18 175,12 200,22"
                  fill="none" stroke="rgba(250,250,250,0.5)" strokeWidth="1.5"
                />
              </svg>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.5 }}>
                Real-time attention curve synced to nodes and tokens.
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
          Connected to the Tokaroo backend. Real diagnostics, real chunk analysis, no mock graph.
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
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Tokaroo</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AI Cognitive Visualization System</div>
      </footer>
    </div>
  );
};
