import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { mockSimulation } from '../api/mockSimulation';

// ── Demo graph data ──────────────────────────────────────────────────────
const DEMO = mockSimulation({ top_k: 16, chunk_size: 120, overlap: 20 });
const GRAPH_DATA = {
  nodes: DEMO.chunks.map(c => ({ ...c, val: Math.max(1, c.size / 60) })),
  links: DEMO.edges,
};

function renderDemoNode(node: any, ctx: CanvasRenderingContext2D) {
  const radius = Math.max(3, (node.size / 60) * 3.5);
  const isRisk = node.risk_level === 'high';
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = isRisk ? 'rgba(220,38,38,0.4)' : 'rgba(250,250,250,0.1)';
  ctx.fill();
  if (node.attention > 0.7) {
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = 'rgba(250,250,250,0.2)';
    ctx.stroke();
  }
}

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
        minHeight: '90vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
        alignItems: 'center', padding: '0 5rem', gap: '4rem',
        maxWidth: '1280px', margin: '0 auto',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', background: 'var(--elevated)', border: '1px solid var(--border)',
            borderRadius: '99px', width: 'fit-content',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
            <span className="label" style={{ color: 'var(--text-secondary)' }}>Open Beta</span>
          </div>

          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.04em', margin: 0 }}>
            Debug how your AI<br />actually reasons
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, maxWidth: '440px' }}>
            Visualize attention decay, chunking failures, and retrieval blind spots inside LLM context windows.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
            <button className="btn-primary" onClick={goToApp} style={{ width: 'auto', padding: '0.85rem 1.75rem', fontSize: '15px' }}>
              Start Simulation
            </button>
            <button className="btn-ghost" onClick={goToApp} style={{ padding: '0.85rem 1.75rem', fontSize: '15px' }}>
              View Demo  →
            </button>
          </div>
        </div>

        {/* Right — animated graph */}
        <div style={{
          height: '480px', borderRadius: '16px', overflow: 'hidden',
          background: 'var(--surface)', border: '1px solid var(--border)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)',
          }} />
          <ForceGraph2D
            ref={fgRef}
            width={580} height={480}
            graphData={GRAPH_DATA}
            nodeCanvasObject={renderDemoNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={() => 'rgba(255,255,255,0.06)'}
            linkWidth={(link: any) => Math.max(0.5, (link.weight ?? 0.5) * 1.2)}
            linkDirectionalParticles={1}
            linkDirectionalParticleSpeed={0.002}
            linkDirectionalParticleWidth={0.8}
            linkDirectionalParticleColor={() => 'rgba(255,255,255,0.18)'}
            backgroundColor="transparent"
            enableNodeDrag={false}
            enableZoomInteraction={false}
            enablePanInteraction={false}
            cooldownTicks={80}
            warmupTicks={40}
          />
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
