import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';

const AttentionTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--elevated)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '11px',
    }}>
      <div style={{ color: 'var(--text-muted)' }}>Chunk {payload[0].payload.index}</div>
      <div className="value-mono" style={{ color: 'var(--text-primary)' }}>{payload[0].value.toFixed(1)}%</div>
    </div>
  );
};

export const BottomPanel: React.FC = () => {
  const { simulation, ui, setUI } = useStore();

  const chartData = useMemo(() =>
    simulation.attention.map((val, i) => ({
      index: i,
      attention: parseFloat((val * 100).toFixed(1)),
      chunkId: simulation.chunks[i]?.id ?? `chunk-${i}`,
    })), [simulation.attention, simulation.chunks]);

  const tokenData = useMemo(() =>
    simulation.chunks.map((c, i) => ({ index: i, tokens: c.size, id: c.id })),
    [simulation.chunks]);

  const isEmpty = chartData.length === 0;

  return (
    <div className="panel" style={{
      height: '100%', display: 'flex', gap: '0', overflow: 'hidden',
    }}>
      {/* Attention curve */}
      <div style={{ flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <div className="label">Attention Curve</div>
          {!isEmpty && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>· hover to sync graph</div>}
        </div>
        {isEmpty ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            Run a simulation to visualize attention
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onMouseMove={(d: any) => {
                if (d?.activePayload?.[0]) setUI({ hoveredNode: d.activePayload[0].payload.chunkId });
              }}
              onMouseLeave={() => setUI({ hoveredNode: null })}
            >
              <XAxis dataKey="index" hide />
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<AttentionTooltip />} />
              {ui.selectedNode && (() => {
                const idx = chartData.findIndex(d => d.chunkId === ui.selectedNode);
                return idx >= 0 ? <ReferenceLine x={idx} stroke="rgba(250,250,250,0.25)" strokeWidth={1} strokeDasharray="3 3" /> : null;
              })()}
              <Line
                type="monotone" dataKey="attention"
                stroke="rgba(250,250,250,0.6)" strokeWidth={1.5}
                dot={(props: any) => {
                  const isSelected = chartData[props.index]?.chunkId === ui.selectedNode;
                  const isHovered  = chartData[props.index]?.chunkId === ui.hoveredNode;
                  if (!isSelected && !isHovered) return <g key={props.index} />;
                  return (
                    <circle key={props.index} cx={props.cx} cy={props.cy}
                      r={isSelected ? 4 : 3}
                      fill={isSelected ? '#FAFAFA' : '#A1A1AA'}
                      stroke="var(--surface)" strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{ r: 4, fill: '#FAFAFA', stroke: 'var(--surface)', strokeWidth: 1.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', background: 'var(--border)', flexShrink: 0 }} />

      {/* Token distribution */}
      <div style={{ width: '200px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className="label" style={{ marginBottom: '0.75rem' }}>Token Distribution</div>
        {isEmpty ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tokenData} barSize={10}>
              <XAxis dataKey="index" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px' }}
                formatter={(v: any) => [`${v} tokens`, '']}
                labelFormatter={(l: any) => `Chunk ${l}`}
              />
              <Bar dataKey="tokens" radius={[2, 2, 0, 0]}>
                {tokenData.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={
                      entry.id === ui.selectedNode ? '#FAFAFA' :
                      entry.id === ui.hoveredNode  ? '#525252' :
                      '#2A2A2A'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
