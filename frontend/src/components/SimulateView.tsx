import React, { useState } from 'react';
import { apiRequest } from '../api/client';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export const SimulateView: React.FC = () => {
  const [text, setText] = useState('Enter a long text here to simulate context window limitations...');
  const [model, setModel] = useState('gpt-4o');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/simulate', {
        text,
        model,
        decay_power: 2.0,
        recency_strength: 0.3
      });
      setResult(data);
    } catch (e) {
      console.error(e);
      alert('Error simulating');
    }
    setLoading(false);
  };

  const chartData = result?.attention_weights?.map((weight: number, i: number) => ({
    index: i,
    weight: weight * 100
  })) || [];

  return (
    <div className="flex-col" style={{ gap: '2rem' }}>
      <header>
        <h1>Context Simulator</h1>
        <p>Visualize how tokenization and context windows affect AI attention.</p>
      </header>

      <div className="grid-2">
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3>Input Configuration</h3>
          <div className="flex-col mt-4">
            <div>
              <label>Model</label>
              <select value={model} onChange={e => setModel(e.target.value)}>
                <option value="gpt-4o">GPT-4o (128k)</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (1M)</option>
                <option value="gemini-3.1-pro">Gemini 3.1 Pro (1M)</option>
                <option value="llama-3-8b-instruct">Llama 3 8B (8k)</option>
              </select>
            </div>
            
            <div>
              <label>Prompt Text</label>
              <textarea 
                value={text} 
                onChange={e => setText(e.target.value)}
                style={{ height: '200px' }}
              />
            </div>
            
            <button className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
              {loading ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {result && (
          <div className="glass-panel flex-col" style={{ padding: '1.5rem' }}>
            <h3>Simulation Results</h3>
            <div className="grid-2 mt-4">
              <div>
                <label>Total Tokens</label>
                <div style={{ fontSize: '2rem', fontWeight: 600 }}>{result.token_count}</div>
              </div>
              <div>
                <label>Context Limit</label>
                <div style={{ fontSize: '2rem', fontWeight: 600 }}>{result.context_window}</div>
              </div>
              <div>
                <label>Status</label>
                <div>
                  <span className={`badge ${result.fits ? 'badge-success' : 'badge-danger'}`}>
                    {result.fits ? 'FITS' : 'OVERFLOW'}
                  </span>
                </div>
              </div>
              <div>
                <label>Estimated Cost</label>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--success)' }}>
                  ${result.cost.input.toFixed(4)}
                </div>
              </div>
            </div>

            <div className="mt-4" style={{ height: '250px' }}>
              <label>Attention Weight Decay</label>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="index" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                  />
                  <Area type="monotone" dataKey="weight" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorWeight)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
