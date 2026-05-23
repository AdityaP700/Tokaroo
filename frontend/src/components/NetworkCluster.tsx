import React, { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NodeData {
  id: number;
  x: number;
  y: number;
  ox: number; // origin x
  oy: number; // origin y
  vx: number;
  vy: number;
  tier: number; // 0 = center, 1 = mid-ring, 2 = outer
  clusterId: number; // which of the 8 clusters
  isAttentional: boolean;
  baseRadius: number;
  color: string;
}

interface EdgeData {
  a: NodeData;
  b: NodeData;
  baseAlpha: number;
  isClusterLocal: boolean; // same cluster
}

interface Pulse {
  active: boolean;
  edges: EdgeData[];
  progress: number; // 0 → edges.length
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface NetworkClusterProps {
  /** Mutable ref holding a float 0.0–3.0 updated externally (e.g. by GSAP scrub).
   *  The canvas reads it every frame — no re-mounts on step changes. */
  stepRef?: React.MutableRefObject<number>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const NetworkCluster: React.FC<NetworkClusterProps> = ({ stepRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef(0);
  const activeStepRef = stepRef ?? fallbackRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Palette (minimal: black / white / muted-purple / subtle-red) ──────
    const WHITE = "#FAFAFA";
    const MUTED_PURPLE = "#A78BFA";
    const DIM_GRAY = "#3F3F46";
    const SUBTLE_RED = "#EF4444";

    // ── Dimensions ────────────────────────────────────────────────────────
    let w = 0;
    let h = 0;
    const resize = () => {
      const el = canvas.parentElement;
      if (!el) return;
      w = canvas.width = el.clientWidth;
      h = canvas.height = el.clientHeight || 540;
    };
    resize();

    // ── Mouse (force-based damped pull — premium inertial feel) ───────────
    const mouse = { x: w / 2, y: h / 2, active: false };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x =
        (e.clientX - rect.left) * (w / canvas.getBoundingClientRect().width);
      mouse.y =
        (e.clientY - rect.top) * (h / canvas.getBoundingClientRect().height);
      mouse.active = true;
    };
    const onMouseLeave = () => {
      mouse.active = false;
    };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    // ── Graph ─────────────────────────────────────────────────────────────
    let nodes: NodeData[] = [];
    let edges: EdgeData[] = [];
    let idCounter = 0;

    const makeNode = (
      x: number,
      y: number,
      tier: number,
      cId: number,
    ): NodeData => ({
      id: idCounter++,
      x,
      y,
      ox: x,
      oy: y,
      vx: 0,
      vy: 0,
      tier,
      clusterId: cId,
      // only mid-ring nodes become attentional — deterministic so it's consistent
      isAttentional: tier === 1 && cId % 3 === 0,
      baseRadius: tier === 0 ? 5 : tier === 1 ? 3 : 1.5,
      color:
        tier === 0
          ? WHITE
          : tier === 1
            ? WHITE
            : Math.random() > 0.55
              ? MUTED_PURPLE
              : DIM_GRAY,
    });

    const buildGraph = () => {
      nodes = [];
      edges = [];
      idCounter = 0;
      const cx = w / 2,
        cy = h / 2;

      const root = makeNode(cx, cy, 0, -1);
      nodes.push(root);

      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + 0.15;
        const dist = 68 + (i % 3) * 8;
        const mid = makeNode(
          cx + Math.cos(angle) * dist,
          cy + Math.sin(angle) * dist,
          1,
          i,
        );
        nodes.push(mid);
        edges.push({ a: root, b: mid, baseAlpha: 0.07, isClusterLocal: false });

        const outerList: NodeData[] = [];
        const count = 3 + (i % 2);
        for (let j = 0; j < count; j++) {
          const oa = angle + (j - (count - 1) / 2) * 0.45;
          const od = 36 + (j % 2) * 10;
          const outer = makeNode(
            mid.ox + Math.cos(oa) * od,
            mid.oy + Math.sin(oa) * od,
            2,
            i,
          );
          nodes.push(outer);
          edges.push({
            a: mid,
            b: outer,
            baseAlpha: 0.05 + j * 0.02,
            isClusterLocal: true,
          });
          outerList.push(outer);
        }
        // ring edges within cluster
        for (let j = 0; j < outerList.length; j++) {
          edges.push({
            a: outerList[j],
            b: outerList[(j + 1) % outerList.length],
            baseAlpha: 0.035,
            isClusterLocal: true,
          });
        }
      }
    };
    buildGraph();

    // ── Cinematic Pulse (BFS, directional, glow intensity drop) ──────────
    const pulse: Pulse = { active: false, edges: [], progress: 0 };
    let lastPulseAt = 0;

    const triggerPulse = (time: number) => {
      if (pulse.active) return;
      lastPulseAt = time;
      const root = nodes[0];
      const midNodes = nodes.filter((n) => n.tier === 1);
      if (!midNodes.length) return;
      const midNode = midNodes[Math.floor(Math.random() * midNodes.length)];
      const e1 = edges.find(
        (e) =>
          (e.a === root && e.b === midNode) ||
          (e.b === root && e.a === midNode),
      );
      if (!e1) return;
      // pick a secondary edge going deeper into the cluster
      const secondary = edges.filter(
        (e) =>
          (e.a === midNode || e.b === midNode) && e !== e1 && e.isClusterLocal,
      );
      pulse.edges = secondary.length
        ? [e1, secondary[Math.floor(Math.random() * secondary.length)]]
        : [e1];
      pulse.active = true;
      pulse.progress = 0;
    };

    // ── Render loop ───────────────────────────────────────────────────────
    let startTime: number | null = null;
    let animId: number;

    const render = (ts: number) => {
      if (!startTime) startTime = ts;
      const time = ts - startTime;
      const sp = Math.max(0, Math.min(3, activeStepRef.current));

      ctx.clearRect(0, 0, w, h);

      // Pulse management
      if (!pulse.active && time - lastPulseAt > 2600) triggerPulse(time);
      if (pulse.active) {
        // Non-linear speed: fast start, slows at end (cinematic)
        const speedCurve = 0.03 - pulse.progress * 0.003;
        pulse.progress += Math.max(0.006, speedCurve);
        if (pulse.progress > pulse.edges.length + 0.8) pulse.active = false;
      }

      // ── Derive step weights ──
      const wInput = Math.max(0, 1 - sp); // 1 at step 0
      const wChunking = Math.max(0, 1 - Math.abs(sp - 1)); // 1 at step 1
      const wAttention = Math.max(0, 1 - Math.abs(sp - 2)); // 1 at step 2
      const wFailure = Math.max(0, sp - 2); // 0→1 at step 2→3

      // ── Draw Edges ────────────────────────────────────────────────────
      for (const e of edges) {
        let alpha = e.baseAlpha;

        // Step 0 — minimal edges, calm
        if (wInput > 0) alpha *= 1 - 0.45 * wInput;
        // Step 1 — cluster-local edges brighten
        if (wChunking > 0 && e.isClusterLocal) alpha += 0.13 * wChunking;
        // Step 2 — focus edges toward attentional nodes; dim others
        if (wAttention > 0) {
          if (e.a.isAttentional || e.b.isAttentional)
            alpha += 0.28 * wAttention;
          else alpha *= 1 - 0.78 * wAttention;
        }
        // Step 3 — edges flicker / break
        if (wFailure > 0 && Math.random() < 0.09 * wFailure) continue;

        // Pulse glow (skip during failure)
        let pulseGlow = 0;
        if (pulse.active && wFailure === 0) {
          const idx = pulse.edges.indexOf(e);
          if (idx >= 0) {
            const dist = Math.abs(pulse.progress - (idx + 0.5));
            pulseGlow = Math.max(0, 1 - dist * 2.2);
          }
        }

        ctx.beginPath();
        ctx.moveTo(e.a.x, e.a.y);
        ctx.lineTo(e.b.x, e.b.y);

        if (pulseGlow > 0) {
          ctx.strokeStyle = `rgba(250,250,250,${alpha + pulseGlow * 0.55})`;
          ctx.lineWidth = 0.8 + pulseGlow * 1.8;
          ctx.shadowBlur = pulseGlow * 10;
          ctx.shadowColor = WHITE;
        } else {
          ctx.strokeStyle = `rgba(139,92,246,${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Update + Draw Nodes ───────────────────────────────────────────
      for (const n of nodes) {
        // ── Target position per step ──
        let tx = n.ox,
          ty = n.oy;

        if (wChunking > 0 && n.tier > 0) {
          // clusters push outward along their radial angle
          const a = (Math.PI * 2 * n.clusterId) / 8;
          tx += Math.cos(a) * 22 * wChunking;
          ty += Math.sin(a) * 22 * wChunking;
        }
        // Step 0: gentle inward drift for outer nodes
        if (wInput > 0 && n.tier === 2) {
          const cx = w / 2,
            cy = h / 2;
          tx += (cx - n.ox) * 0.12 * wInput;
          ty += (cy - n.oy) * 0.12 * wInput;
        }

        // ── Mouse: force-based damped pull ──
        // force = (mouse - node) × 0.0008 → velocity += force → velocity *= 0.92
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const influence = 180; // px radius
          if (dist < influence && dist > 0) {
            const f = ((influence - dist) / influence) * 0.0006;
            n.vx += dx * f;
            n.vy += dy * f;
          }
        }

        // ── Return-to-target spring ──
        const gravity = n.tier === 0 ? 0.02 : 0.01;
        n.vx += (tx - n.x) * gravity;
        n.vy += (ty - n.y) * gravity;

        // ── Failure jitter ──
        if (wFailure > 0) {
          n.vx += (Math.random() - 0.5) * 0.55 * wFailure;
          n.vy += (Math.random() - 0.5) * 0.55 * wFailure;
        }

        // ── Dampen (inertial feel) ──
        n.vx *= 0.92;
        n.vy *= 0.92;
        n.x += n.vx;
        n.y += n.vy;

        // ── Breathing via node radius (not canvas scale — avoids blur) ──
        const phase = time * 0.00075 + n.ox * 0.018 + n.oy * 0.012;
        const breath = 1 + Math.sin(phase) * 0.12;
        let r = n.baseRadius * breath;

        // ── Per-step appearance ──
        let alpha = 1.0;
        let glow = 0;
        let color = n.color;

        if (wAttention > 0) {
          if (n.isAttentional) {
            r *= 1 + 0.65 * wAttention;
            glow = 14 * wAttention;
            color = WHITE;
          } else {
            alpha = 1 - 0.68 * wAttention;
          }
        }

        if (wFailure > 0) {
          // subtle red tint flicker — not neon, NOT WebGL3 aesthetic
          if (Math.random() > 0.88) color = SUBTLE_RED;
          alpha = Math.max(0.25, alpha - Math.random() * 0.25 * wFailure);
        }

        // ── Draw ──
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        if (glow > 0) {
          ctx.shadowBlur = glow;
          ctx.shadowColor = WHITE;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const onResize = () => {
      resize();
      buildGraph();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []); // ← empty: canvas runs forever, reads stepRef each frame

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          background: "transparent",
        }}
      />
    </div>
  );
};
