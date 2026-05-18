import React, { useState } from 'react';
import { apiRequest } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const CompareView: React.FC = () => {
  const [text, setText] = useState('Type your prompt here to compare tokenizer efficiency and costs across different AI models. Some models are much more efficient at English than others!');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCompare = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/compare', { text });
      setResult(data);
    } catch (e) {
      console.error(e);
      alert('Error comparing');
    }
    setLoading(false);
  };

  const chartData = result ? Object.keys(result.models).map(modelName => ({
    name: modelName,
    tokens: result.models[modelName].token_count,
    cost: result.models[modelName].est_input_cost,
    isRecommended: modelName === result.recommended_model
  })) : [];

  return (
    <div className="flex-col" style={{ gap: '2rem' }}>
      <header>
        <h1>Model Comparer</h1>
        <p>Analyze token efficiency and estimate costs across top models.</p>
      </header>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div className="flex-col">
          <label>Test Text</label>
          <textarea 
            value={text} 
            onChange={e => setText(e.target.value)}
            style={{ height: '120px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleCompare} disabled={loading}>
              {loading ? 'Analyzing...' : 'Compare Models'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="grid-2">
          <div className="glass-panel flex-col" style={{ padding: '1.5rem' }}>
            <h3>Recommendation</h3>
            <div className="mt-4" style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Most Efficient Model</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-primary)', margin: '1rem 0' }}>
                {result.recommended_model}
              </div>
              <p>Estimated Cost Multiplier: <strong>{result.estimated_cost_multiplier}</strong></p>
            </div>
          </div>

          <div className="glass-panel flex-col" style={{ padding: '1.5rem' }}>
            <h3>Token Count Comparison</h3>
            <div style={{ height: '250px', marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="var(--text-muted)" />
                  <YAxis dataKey="name" type="category" stroke="var(--text-muted)" width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  />
                  <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                    {
                      chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isRecommended ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
