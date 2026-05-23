import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sphere, Line } from '@react-three/drei';

interface NodeSpec {
  id: number;
  angle: number;
  radius: number;
  tier: number;
  clusterId: number;
  isAttentional: boolean;
  baseRadius: number;
  color: string;
}

interface EdgeSpec {
  a: number; // index of node a
  b: number; // index of node b
}

interface NetworkClusterProps {
  stepRef?: React.MutableRefObject<number>;
}

function NodeSphere({ spec, activeRef }: { spec: NodeSpec; activeRef: React.MutableRefObject<number> }) {
  const ref = useRef<any>(null);
  const { mouse, viewport } = useThree();

  // convert polar to initial position
  const target = useMemo(() => {
    const x = Math.cos(spec.angle) * spec.radius;
    const y = Math.sin(spec.angle) * spec.radius;
    return { x, y };
  }, [spec.angle, spec.radius]);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const sp = Math.max(0, Math.min(3, activeRef.current));

    // base target morph per step
    let tx = target.x;
    let ty = target.y;
    // chunking pushes out mid/outer nodes
    if (spec.tier > 0) {
      tx *= 1 + 0.25 * Math.max(0, 1 - Math.abs(sp - 1));
      ty *= 1 + 0.25 * Math.max(0, 1 - Math.abs(sp - 1));
    }

    // mouse gravity well (in screen-space scale)
    const mx = mouse.x * (viewport.width / 2);
    const my = mouse.y * (viewport.height / 2);

    // simple spring to target
    ref.current.position.x += (tx - ref.current.position.x) * 0.08;
    ref.current.position.y += (ty - ref.current.position.y) * 0.08;

    // apply mouse attraction if close
    const dx = mx - ref.current.position.x;
    const dy = my - ref.current.position.y;
    const dist2 = dx * dx + dy * dy;
    const influence = 5.6 + (spec.tier === 0 ? 12 : spec.tier === 1 ? 8 : 5);
    if (dist2 < influence * influence) {
      const f = (1 - Math.sqrt(dist2) / influence) * 0.25;
      ref.current.position.x += dx * f * dt * 55;
      ref.current.position.y += dy * f * dt * 55;
    }

    // violent shake during failure step
    const wFailure = Math.max(0, sp - 2);
    if (wFailure > 0.001) {
      ref.current.position.x += (Math.random() - 0.5) * 0.25 * wFailure;
      ref.current.position.y += (Math.random() - 0.5) * 0.25 * wFailure;
    }
  });

  return (
    <mesh ref={ref} position={[target.x, target.y, 0]}>
      <sphereGeometry args={[spec.baseRadius * 0.04, 16, 12]} />
      <meshStandardMaterial emissive={spec.isAttentional ? '#ffffff' : spec.color} color={spec.color} metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

function Scene({ nodes, edges, stepRef }: { nodes: NodeSpec[]; edges: EdgeSpec[]; stepRef?: React.MutableRefObject<number> }) {
  const activeRef = stepRef ?? { current: 0 } as React.MutableRefObject<number>;

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 5, 5]} intensity={0.6} />

      {edges.map((e, i) => {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const pa = [Math.cos(a.angle) * a.radius, Math.sin(a.angle) * a.radius, 0] as [number, number, number];
        const pb = [Math.cos(b.angle) * b.radius, Math.sin(b.angle) * b.radius, 0] as [number, number, number];
        return <Line key={`edge-${i}`} points={[pa, pb]} color={'#7C5BFF'} lineWidth={1} transparent opacity={0.75} />;
      })}

      {nodes.map((n) => (
        <NodeSphere key={n.id} spec={n} activeRef={activeRef} />
      ))}
    </>
  );
}

export const NetworkCluster: React.FC<NetworkClusterProps> = ({ stepRef }) => {
  // build nodes/edges in polar coordinates (three units)
  const { nodes, edges } = useMemo(() => {
    const nodes: NodeSpec[] = [];
    const edges: EdgeSpec[] = [];
    let id = 0;
    // center
    nodes.push({ id: id++, angle: 0, radius: 0, tier: 0, clusterId: -1, isAttentional: false, baseRadius: 6, color: '#FAFAFA' });

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + 0.15;
      const dist = 2.6 + (i % 3) * 0.12;
      const midId = id;
      nodes.push({ id: id++, angle, radius: dist, tier: 1, clusterId: i, isAttentional: i % 3 === 0, baseRadius: 3.8, color: '#EDE7FF' });
      edges.push({ a: 0, b: midId });

      const outerCount = 3 + (i % 2);
      const outerList: number[] = [];
      for (let j = 0; j < outerCount; j++) {
        const oa = angle + (j - (outerCount - 1) / 2) * 0.45;
        const od = dist + 0.86 + (j % 2) * 0.18;
        const oid = id;
        nodes.push({ id: id++, angle: oa, radius: od, tier: 2, clusterId: i, isAttentional: false, baseRadius: 2.0, color: Math.random() > 0.55 ? '#C9B7FF' : '#8F8F9F' });
        edges.push({ a: midId, b: oid });
        outerList.push(oid);
      }
      for (let j = 0; j < outerList.length; j++) {
        edges.push({ a: outerList[j], b: outerList[(j + 1) % outerList.length] });
      }
    }

    return { nodes, edges };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas orthographic camera={{ zoom: 80, position: [0, 0, 100] }}>
        <Scene nodes={nodes} edges={edges} stepRef={stepRef} />
      </Canvas>
    </div>
  );
};
