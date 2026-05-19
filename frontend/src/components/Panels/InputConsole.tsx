import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { apiRequest, type RagResponse } from '../../api/client';

const MODELS = [
  { id: 'gpt-4o',        label: 'GPT-4o',         ctx: '128k' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', ctx: '1M' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', ctx: '1M' },
  { id: 'llama-3-8b-instruct', label: 'Llama 3 8B', ctx: '8k' },
];

function riskKind(riskLevel: string) {
  const value = riskLevel.toLowerCase();
  if (value.includes('critical') || value.includes('high')) return 'high';
  if (value.includes('medium')) return 'medium';
  return 'low';
}

function severityFromBackend(severity: string) {
  const value = severity.toLowerCase();
  if (value.includes('critical') || value.includes('high')) return 'error';
  if (value.includes('medium') || value.includes('warning')) return 'warning';
  return 'info';
}

function graphFromRagResponse(result: RagResponse, runId: number) {
  const chunks = result.chunks.map((chunk, index) => ({
    id: `run-${runId}-chunk-${chunk.chunk_index}`,
    display_id: `chunk-${chunk.chunk_index}`,
    chunk_index: chunk.chunk_index,
    size: chunk.token_count,
    relevance: chunk.relevance_score ?? chunk.similarity_score ?? 0,
    attention: chunk.attention_weight ?? chunk.positional_weight ?? 0,
    final_importance: chunk.final_importance,
    risk_level: riskKind(chunk.risk_level),
    risk_label: chunk.risk_level,
    used_by_model: chunk.used_by_model ?? false,
    lost_reason: chunk.lost_reason,
    boundary_snippet: chunk.boundary_snippet,
    start_token: chunk.start_token,
    end_token: chunk.end_token,
    x: Math.cos(index * 1.9) * (80 + index * 10),
    y: Math.sin(index * 1.9) * (80 + index * 10),
  }));

  const edges = chunks.slice(1).map((chunk, index) => ({
    source: chunks[index].id,
    target: chunk.id,
    weight: Math.max(0.2, Math.min(1, (chunks[index].relevance + chunk.relevance) / 2)),
  }));

  const usedChunks = chunks.filter((chunk) => chunk.used_by_model);
  for (let i = 1; i < usedChunks.length; i += 1) {
    edges.push({
      source: usedChunks[i - 1].id,
      target: usedChunks[i].id,
      weight: 0.85,
    });
  }

  const attention = result.optimization.attention_curve?.length
    ? result.optimization.attention_curve
    : chunks.map((chunk) => chunk.attention);

  return { chunks, edges, attention };
}

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border)', margin: '0.25rem 0' }} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function SliderField({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{min}{unit}</span>
        <span className="value-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}{unit}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{max}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))} />
    </Field>
  );
}

export const InputConsole: React.FC = () => {
  const { input, simulation, setInput, setSimulation, setAnalysis, setUI } = useStore();

  const estimatedTokens = useMemo(() => Math.ceil(input.text.length / 4), [input.text]);
  const estimatedChunks = useMemo(() => {
    if (!input.text.length) return 0;
    const effective = Math.max(1, input.chunk_size - input.overlap);
    return Math.max(1, Math.ceil(estimatedTokens / effective));
  }, [estimatedTokens, input.chunk_size, input.overlap]);

  const handleSimulate = async () => {
    const nextRunId = simulation.runId + 1;
    const requestPayload = {
      text: input.text,
      model: input.model,
      chunk_size: input.chunk_size,
      overlap: input.overlap,
      top_k: input.top_k,
      final_k: Math.min(4, input.top_k),
      retrieval_strategy: 'relevance_sorted',
      auto_optimize: true,
    };
    setUI({ selectedNode: null, hoveredNode: null, view: 'graph' });
    setSimulation({ runId: nextRunId, loading: true, chunks: [], edges: [], attention: [], error: null, raw: null, request: requestPayload });

    try {
      const result = await apiRequest<RagResponse>('/simulate-rag', requestPayload);

      const graph = graphFromRagResponse(result, nextRunId);
      const backendIssues = result.optimization.issues ?? [];
      const issues = backendIssues.length > 0
        ? backendIssues.map((issue) => ({
            type: issue.type,
            label: `${issue.type.replaceAll('_', ' ')} (${issue.severity})`,
            severity: severityFromBackend(issue.severity),
          }))
        : [{
            type: result.optimization.diagnosis.primary_issue,
            label: result.optimization.diagnosis.short_summary,
            severity: 'info',
          }];

      setSimulation({ runId: nextRunId, ...graph, loading: false, error: result.error, raw: result, request: requestPayload });
      setAnalysis({
        health_score: result.optimization.health_score ?? 0,
        issues,
        diagnosis: result.optimization.diagnosis.primary_issue,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach Tokaroo backend.';
      setSimulation({ runId: nextRunId, loading: false, chunks: [], edges: [], attention: [], error: message, raw: null, request: requestPayload });
      setAnalysis({
        health_score: 0,
        issues: [{ type: 'backend_unavailable', label: message, severity: 'error' }],
        diagnosis: 'backend_unavailable',
      });
    }
  };

  const isLoading = simulation.loading;
  const canRun = input.text.trim().length > 0 && !isLoading;

  return (
    <div className="panel" style={{
      height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem',
    }}>
      {/* Header */}
      <div>
        <div className="label" style={{ marginBottom: '4px' }}>Control Console</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Input Config</div>
      </div>

      <Divider />

      {/* Model */}
      <Field label="Model">
        <select value={input.model} onChange={(e) => setInput({ model: e.target.value })}>
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label} · {m.ctx}</option>
          ))}
        </select>
      </Field>

      {/* Sliders */}
      <SliderField label="Chunk Size" value={input.chunk_size} min={50} max={1000} step={10} unit=" t" onChange={v => setInput({ chunk_size: v })} />
      <SliderField label="Overlap"    value={input.overlap}    min={0}  max={200} step={5}  unit=" t" onChange={v => setInput({ overlap: v })} />
      <SliderField label="Top K"      value={input.top_k}      min={1}  max={20}  step={1}  unit=""   onChange={v => setInput({ top_k: v })} />

      <Divider />

      {/* Text input */}
      <Field label="Context Text">
        <textarea
          value={input.text}
          onChange={(e) => setInput({ text: e.target.value })}
          placeholder="Paste a long document here…"
          style={{ height: '100px', flex: 'none' }}
        />
      </Field>

      {/* Live estimates */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '8px', padding: '10px 12px',
        background: 'var(--elevated)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}>
        <div>
          <div className="label" style={{ marginBottom: '3px' }}>Est. Tokens</div>
          <div className="value-mono">{estimatedTokens > 0 ? estimatedTokens.toLocaleString() : '—'}</div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: '3px' }}>Est. Chunks</div>
          <div className="value-mono">{estimatedChunks > 0 ? estimatedChunks : '—'}</div>
        </div>
      </div>

      {simulation.error && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.28)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--danger)',
          fontSize: '12px',
          lineHeight: 1.45,
        }}>
          {simulation.error}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* CTA button — pure white, prominent */}
      <div style={{ paddingTop: '0.5rem' }}>
        <button className="btn-primary" onClick={handleSimulate} disabled={!canRun}
          style={{ fontSize: '15px', padding: '0.85rem' }}>
          {isLoading ? 'Loading' : 'Run Simulation'}
        </button>
      </div>
    </div>
  );
};
