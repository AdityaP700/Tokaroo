import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Layers, SearchCheck, Sparkles } from 'lucide-react';
import { apiRequest, type RagResponse } from '../api/client';

const SAMPLE_TEXT = `FastAPI is a modern high-performance web framework for building APIs with Python 3.7+. It is commonly used for AI backends because it supports async request handling, dependency injection, and clean validation with Pydantic. In RAG systems, documents are split into chunks, retrieved by semantic similarity, reranked, and inserted into a prompt. Critical information can be lost when the most relevant chunk sits in the middle of a long context window. Prometheus metrics help teams observe latency, retrieval quality, and model behavior in production.`;

export const RagView: React.FC = () => {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [query, setQuery] = useState('Why do RAG systems lose useful chunks in the middle?');
  const [chunkSize, setChunkSize] = useState(70);
  const [overlap, setOverlap] = useState(12);
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RagResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPayload = useMemo(() => ({
    text,
    query,
    model: 'gpt-4o',
    chunk_size: chunkSize,
    overlap,
    top_k: topK,
    final_k: Math.min(4, topK),
    retrieval_strategy: 'relevance_sorted',
    auto_optimize: true,
  }), [text, query, chunkSize, overlap, topK]);

  const runPipeline = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await apiRequest<RagResponse>('/simulate-rag', requestPayload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run RAG simulation.');
    } finally {
      setLoading(false);
    }
  };

  const chunkBars = result?.chunks.map((chunk) => ({
    name: `C${chunk.chunk_index}`,
    score: Math.round((chunk.relevance_score ?? chunk.similarity_score) * 100),
    attention: Math.round((chunk.attention_weight ?? chunk.positional_weight) * 100),
    used: chunk.used_by_model,
    risk: chunk.risk_level,
  })) ?? [];

  return (
    <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <section className="workspace-hero">
        <div>
          <div className="label">RAG Pipeline Sandbox</div>
          <h1 style={{ fontSize: '30px', margin: '8px 0 6px 0', letterSpacing: 0 }}>Chunk, retrieve, rerank, inspect.</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', lineHeight: 1.6 }}>
            Run the same backend pipeline used by the context simulator, then inspect which chunks entered the prompt and which ones became waste.
          </p>
        </div>
        <div className="workspace-hero-metric">
          <Sparkles size={18} />
          <span>{result ? `${result.chunks_in_prompt}/${result.total_chunks_created} chunks in prompt` : 'Ready'}</span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 0.85fr) minmax(520px, 1.4fr)', gap: '14px' }}>
        <section className="panel-elevated" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div className="label">Source document</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ height: '220px', marginTop: '8px' }} />
          </div>
          <div>
            <div className="label">Retrieval query</div>
            <textarea value={query} onChange={(e) => setQuery(e.target.value)} style={{ height: '70px', marginTop: '8px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              ['Chunk', chunkSize, setChunkSize, 30, 200],
              ['Overlap', overlap, setOverlap, 0, 80],
              ['Top K', topK, setTopK, 1, 12],
            ].map(([label, value, setter, min, max]: any) => (
              <div key={label} className="mini-control">
                <span>{label}</span>
                <strong>{value}</strong>
                <input type="range" min={min} max={max} value={value} onChange={(e) => setter(Number(e.target.value))} />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={runPipeline} disabled={loading || !text.trim()}>
            {loading ? 'Running pipeline' : 'Run RAG Pipeline'}
          </button>
          {error && <div className="error-callout">{error}</div>}
        </section>

        <section className="panel-elevated" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '560px' }}>
          <div className="metric-grid">
            {[
              { icon: Layers, label: 'Total chunks', value: result?.total_chunks_created ?? '-' },
              { icon: SearchCheck, label: 'Reranked', value: result ? String(result.reranked) : '-' },
              { icon: Activity, label: 'Health', value: result?.optimization.health_score ?? '-' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="metric-tile">
                <Icon size={16} />
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ height: '250px' }}>
            <div className="label" style={{ marginBottom: '8px' }}>Relevance vs attention</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chunkBars}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" tickLine={false} />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="score" radius={[5, 5, 0, 0]}>
                  {chunkBars.map((entry, index) => (
                    <Cell key={index} fill={entry.used ? '#FAFAFA' : 'rgba(255,255,255,0.24)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {(result?.chunks ?? []).map((chunk) => (
              <div key={chunk.chunk_index} className="chunk-row">
                <div>
                  <strong>Chunk {chunk.chunk_index}</strong>
                  <p>{chunk.boundary_snippet}</p>
                </div>
                <span className={chunk.used_by_model ? 'status-pill good' : 'status-pill'}>{chunk.used_by_model ? 'used' : 'ignored'}</span>
              </div>
            ))}
            {!result && (
              <div className="empty-state">Run the pipeline to see chunk scoring, reranker impact, and optimization advice.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
