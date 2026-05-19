import React, { useState } from 'react';
import { apiRequest } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const RagView: React.FC = () => {
  const [text, setText] = useState('Retrieval-Augmented Generation (RAG) is a technique that grants generative AI models information retrieval capabilities. It modifies interactions with a Large Language Model (LLM) so that the model responds to user queries with reference to a specified set of documents, using this information in preference to information drawn from its own vast, static training data. RAG can be used to answer questions about a specific dataset, or to generate text that is grounded in facts from a particular source. The quality of RAG depends heavily on how the source documents are chunked and the quality of the retrieval system.');
  const [chunkSize, setChunkSize] = useState(50);
  const [overlap, setOverlap] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/simulate-rag', { 
        text,
        model: 'gpt-4o',
        chunk_size: chunkSize,
        overlap: overlap,
        top_k: 5,
        final_k: 3
      });
      setResult(data);
    } catch (e) {
      console.error(e);
      alert('Error simulating RAG');
    }
    setLoading(false);
  };

  const chartData = result?.chunks?.map((chunk: any) => ({
    name: `Chunk ${chunk.chunk_index}`,
    relevance: chunk.final_importance * 100,
    used: chunk.used_by_model
  })) || [];

  return (
    <div className="flex-col" style={{ gap: '2rem' }}>
      <header>
        <h1>RAG Sandbox</h1>
        <p>Visualize how chunking and retrieval strategies impact context.</p>
      </header>

      <div className="grid-2">
        <div className="glass-panel flex-col" style={{ padding: '1.5rem' }}>
          <h3>Configuration</h3>
          <div className="mt-4 flex-col">
             <div>
              <label>Source Document</label>
              <textarea 
                value={text} 
                onChange={e => setText(e.target.value)}
                style={{ height: '150px' }}
              />
            </div>
            <div className="grid-2">
              <div>
                <label>Chunk Size (Tokens)</label>
                <input type="number" value={chunkSize} onChange={e => setChunkSize(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label>Overlap (Tokens)</label>
                <input type="number" value={overlap} onChange={e => setOverlap(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <button className="btn btn-primary mt-4" onClick={handleSimulate} disabled={loading}>
              {loading ? 'Processing...' : 'Simulate RAG Pipeline'}
            </button>
          </div>
        </div>

        {result && (
          <div className="glass-panel flex-col" style={{ padding: '1.5rem' }}>
            <h3>Pipeline Results</h3>
            <div className="grid-2 mt-4">
              <div>
                <label>Total Chunks</label>
                <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{result.total_chunks_created}</div>
              </div>
              <div>
                <label>Chunks In Prompt</label>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--success)' }}>{result.chunks_in_prompt}</div>
              </div>
            </div>
            
            <div className="mt-4" style={{ height: '220px' }}>
              <label>Chunk Relevance Scores</label>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  />
                  <Bar dataKey="relevance" radius={[4, 4, 0, 0]}>
                    {
                      chartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.used ? 'var(--success)' : 'var(--text-muted)'} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Green</span> blocks were retrieved and inserted into the prompt.
              </p>
            </div>
          </div>
        )}
      </div>

      {result && result.optimization && (
        <div className="glass-panel flex-col" style={{ padding: '1.5rem' }}>
          <h3>Optimization Insights</h3>
          <div className="mt-4 p-4" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>{result.optimization.diagnosis.primary_issue}</h4>
            <p>{result.optimization.diagnosis.short_summary}</p>
            {result.optimization.actionable_steps?.length > 0 && (
              <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {result.optimization.actionable_steps.map((step: string, i: number) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
