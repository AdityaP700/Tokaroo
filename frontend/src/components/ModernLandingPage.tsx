import React from 'react';
import { useNavigate } from 'react-router-dom';

const heroStats = [
  { value: '99.2%', label: 'traceability coverage' },
  { value: '3x', label: 'faster issue spotting' },
  { value: '24/7', label: 'pipeline visibility' },
];

const featureCards = [
  {
    title: 'Chunk heatmap',
    text: 'See which chunks carry the answer and which ones fade out in the middle of the window.',
  },
  {
    title: 'Retrieval drift',
    text: 'Track semantic mismatch before the model starts confidently hallucinating from the wrong context.',
  },
  {
    title: 'Live diagnostics',
    text: 'Watch the simulation breathe with attention shifts, token pressure, and ranking changes.',
  },
];

export const ModernLandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="modern-landing">
      <div className="modern-landing__glow modern-landing__glow--left" />
      <div className="modern-landing__glow modern-landing__glow--right" />
      <div className="modern-landing__grid" />

      <nav className="modern-landing__nav">
        <div className="modern-landing__nav-inner">
          <div className="modern-landing__brand" onClick={() => navigate('/')}>
            <img src="/ChatGPT_Image_May_24__2026__04_48_23_PM-removebg-preview.png" alt="Tokaroo" className="modern-landing__brand-mark" />
            <span>Tokaroo</span>
          </div>

          <div className="modern-landing__nav-links">
            <a href="#features">Features</a>
            <a href="#preview">Preview</a>
            <a href="#diagnostics">Diagnostics</a>
          </div>

          <button className="landing-cta landing-cta--small" onClick={() => navigate('/app')}>
            Open App
          </button>
        </div>
      </nav>

      <main className="modern-landing__main">
        <section className="modern-landing__hero">
          <div className="modern-landing__hero-copy">
            <div className="modern-landing__eyebrow">
              <span className="modern-landing__eyebrow-dot" />
              Context visibility for messy RAG systems
            </div>

            <h1>
              Messy RAG.
              <br />
              Meet predictable AI.
            </h1>

            <p>
              Tokaroo gives you a sharper view into retrieval, ranking, and attention so you can spot failure modes before they reach production.
            </p>

            <div className="modern-landing__actions">
              <button className="landing-cta" onClick={() => navigate('/app')}>
                Start Simulation
              </button>
              <button className="landing-cta landing-cta--ghost">
                Watch 2-min Demo
              </button>
            </div>

            <div className="modern-landing__stats">
              {heroStats.map((stat) => (
                <div key={stat.label} className="modern-landing__stat-card">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="modern-landing__visual">
            <div className="modern-landing__visual-frame">
              <img src="/ChatGPT Image May 24, 2026, 04_50_40 PM.png" alt="Tokaroo RAG Flow" className="modern-landing__visual-image" />
              <div className="modern-landing__badge">Live Diagnostics</div>
              <div className="modern-landing__scanline" />
            </div>

            <div className="modern-landing__mini-panel">
              <div>
                <span>Attention drift</span>
                <strong>Middle chunks fall off first</strong>
              </div>
              <div>
                <span>Current state</span>
                <strong>Tracing retrieval + ranking in real time</strong>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="modern-landing__feature-grid">
          {featureCards.map((card) => (
            <article key={card.title} className="modern-landing__feature-card">
              <div className="modern-landing__feature-kicker" />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </section>

        <section id="preview" className="modern-landing__strip">
          <div>
            <span>Preview</span>
            <strong>Graph, context strip, and signal checks in one place.</strong>
          </div>
          <button className="landing-cta landing-cta--ghost" onClick={() => navigate('/app/context')}>
            Explore workspace
          </button>
        </section>

        <section id="diagnostics" className="modern-landing__diagnostics">
          <div>
            <span>Signal quality</span>
            <strong>Sharper feedback loops</strong>
          </div>
          <div>
            <span>Failure modes</span>
            <strong>Visible before the prompt leaves the model</strong>
          </div>
          <div>
            <span>Workflow</span>
            <strong>Inspect, adjust, and rerun with confidence</strong>
          </div>
        </section>
      </main>
    </div>
  );
};