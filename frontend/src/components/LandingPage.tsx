import React, { useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { mockSimulation } from '../api/mockSimulation';

// Static demo graph data for the hero
const DEMO = mockSimulation({ top_k: 14, chunk_size: 120, overlap: 20 });
const GRAPH_DATA = {
  nodes: DEMO.chunks.map(c => ({ ...c, val: Math.max(1, c.size / 60) })),
  links: DEMO.edges,
};

function renderDemoNode(node: any, ctx: CanvasRenderingContext2D) {
  const radius = Math.max(3, (node.size / 60) * 3.5);
  const isRisk = node.risk_level === 'high';
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = isRisk ? 'rgba(220,38,38,0.5)' : 'rgba(250,250,250,0.12)';
  ctx.fill();
  if (node.attention > 0.75) {
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(250,250,250,0.3)';
    ctx.stroke();
  }
}

const FEATURE_CARDS = [
  {
    icon: '⬡',
    title: 'Lost in the Middle',
    desc: 'LLMs systematically ignore context placed in the center of the window. Tokaroo makes this decay visible.',
  },
  {
    icon: '⬡',
    title: 'Semantic Mismatch',
    desc: 'Retrieved chunks may match lexically but diverge semantically. Catch retrieval failures before they reach the model.',
  },
  {
    icon: '⬡',
    title: 'Context Overflow',
    desc: 'When total tokens exceed the window, chunks get silently dropped. See exactly what the model never reads.',
  },
];

const HOW_STEPS = [
  { num: '01', label: 'Input',       desc: 'Paste any long-form document or set retrieval parameters.' },
  { num: '02', label: 'Simulate',    desc: 'The pipeline chunks, reranks, and models attention across the context window.' },
  { num: '03', label: 'Diagnose',    desc: 'Issues are ranked by severity and mapped back to the graph nodes.' },
  { num: '04', label: 'Optimize',    desc: 'Adjust chunk size, overlap, and top-k in real time to resolve identified failures.' },
];

interface LandingPageProps {
  onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(-80);
    }
  }, []);

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 3rem', height: '56px',
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '5px',
            background: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em' }}>Tokaroo</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn-ghost" style={{ padding: '0.35rem 1rem', fontSize: '12px' }}>
            Documentation
          </button>
          <button className="btn-primary" onClick={onEnter} style={{ padding: '0.4rem 1.1rem', fontSize: '12px', width: 'auto' }}>
            Open App
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '88vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
        alignItems: 'center', padding: '0 5rem', gap: '4rem',
        maxWidth: '1280px', margin: '0 auto',
      }}>
        {/* Left text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', background: 'var(--elevated)', border: '1px solid var(--border)',
            borderRadius: '99px', width: 'fit-content',
          }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success)' }} />
            <span className="label" style={{ color: 'var(--text-secondary)' }}>Open Beta</span>
          </div>

          <h1 style={{
            fontSize: '3.25rem', fontWeight: 800, lineHeight: 1.1,
            letterSpacing: '-0.03em', margin: 0,
            color: 'var(--text-primary)',
          }}>
            Understand how AI thinks —{' '}
            <span style={{ color: 'var(--text-secondary)' }}>not just what it outputs</span>
          </h1>

          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, maxWidth: '480px' }}>
            Tokaroo visualizes attention decay, chunking failures, and retrieval blind spots inside LLM context windows — before they silently degrade your system.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
            <button className="btn-primary" onClick={onEnter} style={{ width: 'auto', padding: '0.7rem 1.5rem', fontSize: '14px' }}>
              Start Simulation
            </button>
            <button className="btn-ghost" style={{ padding: '0.7rem 1.5rem', fontSize: '14px' }}>
              View Demo  →
            </button>
          </div>
        </div>

        {/* Right — Live graph */}
        <div style={{
          height: '480px', borderRadius: '16px', overflow: 'hidden',
          background: 'var(--surface)', border: '1px solid var(--border)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)',
          }} />
          <ForceGraph2D
            ref={fgRef}
            width={580}
            height={480}
            graphData={GRAPH_DATA}
            nodeCanvasObject={renderDemoNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={() => 'rgba(255,255,255,0.05)'}
            linkWidth={() => 0.8}
            backgroundColor="transparent"
            enableNodeDrag={false}
            enableZoomInteraction={false}
            enablePanInteraction={false}
            cooldownTicks={100}
          />
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────────────────────────── */}
      <section style={{
        padding: '5rem', borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3rem' }}>
            <div className="label" style={{ marginBottom: '8px' }}>What Tokaroo detects</div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              The invisible failures
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {FEATURE_CARDS.map((card) => (
              <div key={card.title} className="panel" style={{ padding: '1.5rem' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'var(--elevated)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '1rem',
                }}>
                  {card.icon}
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>{card.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div className="label" style={{ marginBottom: '8px' }}>Pipeline</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>How it works</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {HOW_STEPS.map((step, i) => (
            <div key={step.num} style={{
              padding: '2rem 1.5rem',
              background: 'var(--surface)',
            }}>
              <div className="value-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>{step.num}</div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>{step.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section style={{
        padding: '5rem', borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: '1.5rem',
      }}>
        <h2 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, maxWidth: '520px' }}>
          Start understanding your RAG pipeline
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
          No backend required. Runs entirely in your browser.
        </p>
        <button className="btn-primary" onClick={onEnter} style={{ width: 'auto', padding: '0.75rem 2rem', fontSize: '14px' }}>
          Open Simulator  →
        </button>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '1.5rem 5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--bg)' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>Tokaroo</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          AI Cognitive Visualization System
        </div>
      </footer>
    </div>
  );
};
