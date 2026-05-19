import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export function SemanticNetworkEngine({ onStateChange }: { onStateChange?: (state: 'normal' | 'failure' | 'recovery') => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const container = containerRef.current;
    container.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
    const winWidth = Math.max(320, container.clientWidth);
    const winHeight = Math.max(320, container.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, winWidth / winHeight, 1, 1400);
    camera.position.set(-90, 18, 420);
    camera.lookAt(40, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      setWebglError(error instanceof Error ? error.message : 'WebGL could not start.');
      return;
    }
    setWebglError(null);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(winWidth, winHeight);
    renderer.domElement.style.cursor = 'crosshair';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // --- Data Configuration ---
    // Increase density -> represents chunks of information
    const numParticles = 650;
    const maxConnections = numParticles * 25;

    const positions = new Float32Array(numParticles * 3);
    const colors = new Float32Array(numParticles * 3);
    const sizes = new Float32Array(numParticles);

    // Network mechanics & clustering
    const velocities: THREE.Vector3[] = [];
    const clusterCenters = [
      new THREE.Vector3(120, 80, 0),    // Right Top
      new THREE.Vector3(-60, -90, 60),  // Left Bottom
      new THREE.Vector3(80, -110, -50), // Right Bottom
      new THREE.Vector3(0, 40, 120),    // Center front (Failure Cluster)
    ];
    const particleClusters: number[] = [];
    const phaseOffsets: number[] = [];

    const radius = 250;
    for (let i = 0; i < numParticles; i++) {
        const clusterIndex = i % clusterCenters.length;
        const center = clusterCenters[clusterIndex];
        const phi = Math.random() * Math.PI * 2;
        const spread = 52 + Math.random() * 88;
        const x = center.x + Math.cos(phi) * spread + (Math.random() - 0.5) * 45;
        const y = center.y + Math.sin(phi) * spread + (Math.random() - 0.5) * 45;
        const z = center.z + (Math.random() - 0.5) * 110;

        positions[3 * i] = x;
        positions[3 * i + 1] = y;
        positions[3 * i + 2] = z;

        velocities.push(
            new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0
            )
        );

        // Subgroups for clustering
        particleClusters.push(clusterIndex);
        phaseOffsets.push(Math.random() * Math.PI * 2);

        colors[3 * i] = 0.82;
        colors[3 * i + 1] = 0.9;
        colors[3 * i + 2] = 1;

        sizes[i] = Math.random() * 3 + 2.2;
    }

    // Speed multiplier per particle to create motion contrast
    const speedMultipliers = new Float32Array(numParticles);
    for (let i = 0; i < numParticles; i++) {
        speedMultipliers[i] = (i % 3 === 0) ? 2.5 : 0.6; // High contrast
    }

    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pointsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage)); // Re-uploading for dynamic

    // Particles material
    const pointsMaterial = new THREE.PointsMaterial({
      size: 5.2,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleCloud = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(particleCloud);

    // --- Relationship Lines ---
    const linePositions = new Float32Array(maxConnections * 6);
    const lineColors = new Float32Array(maxConnections * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

    const lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.52,
        depthWrite: false
    });
    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineMesh);

    let time = 0;
    let lastState = 'normal';
    let manualFailureUntil = 0;
    let manualBurstArmed = false;
    let isVisible = true;
    const pointer = new THREE.Vector2(0.55, 0.42);
    const pointerTarget = new THREE.Vector2(0.55, 0.42);
    const focusPoint = new THREE.Vector3(120, 30, 0);
    const clock = new THREE.Clock();

    const triggerFailure = () => {
      manualFailureUntil = performance.now() + 2200;
      manualBurstArmed = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerTarget.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointerTarget.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    };

    const handlePointerLeave = () => {
      pointerTarget.set(0.55, 0.42);
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('pointerdown', triggerFailure);

    const animate = () => {
        if (!isVisible) {
            renderer.render(scene, camera);
            return;
        }
        const delta = Math.min(clock.getDelta(), 0.045);
        time += delta * 0.75;
        const cycle = time % 11; // calmer 11 second storytelling loop
        pointer.lerp(pointerTarget, 0.04);
        focusPoint.set(
          60 + pointer.x * 170,
          110 - pointer.y * 170,
          (pointer.x - 0.5) * 90
        );

        // --- Storytelling Loop ---
        // 0.0s - 5.0s: System normal & processing well
        // 5.0s - 7.1s: The failure zone malfunctions, or pointer/tap can trigger it
        // 7.1s - 11.0s: Recovery
        let currentState: 'normal' | 'failure' | 'recovery' = 'normal';
        const manualFailureActive = performance.now() < manualFailureUntil;
        if (manualFailureActive || (cycle >= 5.0 && cycle < 7.1)) currentState = 'failure';
        else if (cycle >= 7.1 || manualFailureUntil > 0) currentState = 'recovery';

        if (currentState !== lastState) {
            lastState = currentState;
            if (onStateChange) onStateChange(currentState);
        }

        const loopFailureFactor = cycle > 5.0 && cycle < 7.1
            ? Math.min((cycle - 5.0) * 1.25, 1)
            : (cycle >= 7.1 ? Math.max(1 - (cycle - 7.1) * 0.55, 0) : 0);
        const manualFailureFactor = manualFailureActive ? 1 : 0;
        const failureFactor = Math.max(loopFailureFactor, manualFailureFactor);

        // Camera shake during failure
        if (failureFactor > 0.1 && failureFactor < 0.9) {
            const shake = failureFactor * 2.5;
            camera.position.x = -80 + (pointer.x - 0.5) * 28 + (Math.random() - 0.5) * shake;
            camera.position.y = (Math.random() - 0.5) * shake;
        } else {
            camera.position.x += (-80 + (pointer.x - 0.5) * 28 - camera.position.x) * 0.08;
            camera.position.y += ((0.5 - pointer.y) * 22 - camera.position.y) * 0.08;
        }

        scene.rotation.y += 0.0012 + (pointer.x - 0.5) * 0.0008;
        scene.rotation.x += 0.0004 + (0.5 - pointer.y) * 0.0004;

        const posAttr = pointsGeometry.attributes.position;
        const colorAttr = pointsGeometry.attributes.color;
        const sizeAttr = pointsGeometry.attributes.size;

        let vertexPos = 0;
        let colorPos = 0;
        let connections = 0;

        for (let i = 0; i < numParticles; i++) {
            const clusterIdx = particleClusters[i];
            const isFailureNode = clusterIdx === 3;
            const speedMultiplier = speedMultipliers[i];

            // Directional Flow Motion (Contrast)
            velocities[i].x += Math.sin(time + i) * 0.002 * speedMultiplier;
            velocities[i].y += Math.cos(time * 0.8 + i) * 0.002 * speedMultiplier;

            // Dramatic Burst on Failure enter
            const shouldBurst = isFailureNode && ((cycle > 5.0 && cycle < 5.1) || (manualFailureActive && manualBurstArmed));
            if (shouldBurst) {
                velocities[i].x += (Math.random() - 0.5) * 1.5;
                velocities[i].y += (Math.random() - 0.5) * 1.5;
                velocities[i].z += (Math.random() - 0.5) * 1.5;
            }

            // Apply velocities
            posAttr.array[i * 3] += velocities[i].x;
            posAttr.array[i * 3 + 1] += velocities[i].y;
            posAttr.array[i * 3 + 2] += velocities[i].z;

            // Simple Sphere Boundary
            const px = posAttr.array[i * 3];
            const py = posAttr.array[i * 3 + 1];
            const pz = posAttr.array[i * 3 + 2];
            const distCenter = Math.sqrt(px*px + py*py + pz*pz);
            if (distCenter > radius * 1.2) {
                 velocities[i].x -= (px / distCenter) * 0.15;
                 velocities[i].y -= (py / distCenter) * 0.15;
                 velocities[i].z -= (pz / distCenter) * 0.15;
            }

            // Focus Zone Logic (Hierarchy)
            const distToFocus = Math.sqrt((px-focusPoint.x)**2 + (py-focusPoint.y)**2 + (pz-focusPoint.z)**2);
            const focusFactor = Math.max(0, 1 - distToFocus / 150); // 0 to 1
            const isFocused = focusFactor > 0.6; // High presence area

            // Cluster Gravity
            const center = clusterCenters[clusterIdx];
            const baseStrength = 0.004;
            // When failure is spiking, nodes spread chaotically and lose gravity
            const pullStrength = isFailureNode && failureFactor > 0 ? baseStrength * (1 - failureFactor*0.8) : baseStrength;

            velocities[i].x += (center.x - px) * pullStrength;
            velocities[i].y += (center.y - py) * pullStrength;
            velocities[i].z += (center.z - pz) * pullStrength;

            velocities[i].multiplyScalar(isFailureNode && failureFactor > 0 ? 0.999 : 0.985); // less damping = faster scatter

            // Sizes / Visual Hierarchy
            sizeAttr.array[i] = (isFocused ? 3.0 : 1.2) + (isFailureNode && failureFactor > 0 ? failureFactor * 4 : 0);

            // Attention Simulation (Fluctuating Brightness/Opacity)
            const attentionVal = Math.sin(time * 3 + phaseOffsets[i]) * 0.4 + 0.6;
            const focusOpacity = 0.55 + focusFactor * 0.8; // Keep distant nodes visible

            if (isFailureNode) {
                // Fade to bright red as failureFactor increases
                const maxRedScale = Math.max(1, failureFactor * 2);
                const r = 1 * maxRedScale; // Extremely bright on fail
                const g = 1 - failureFactor * 0.85;
                const b = 1 - failureFactor * 0.85;

                colorAttr.array[i * 3] = Math.min(2.4, r * attentionVal * focusOpacity);
                colorAttr.array[i * 3 + 1] = Math.min(1.2, g * attentionVal * focusOpacity);
                colorAttr.array[i * 3 + 2] = Math.min(1.2, b * attentionVal * focusOpacity);
            } else {
                // Normal nodes
                // Add soft glow to active focused items
                const glow = isFocused ? 0.4 : 0;
                colorAttr.array[i * 3] = Math.min(1.6, (0.75 * attentionVal + glow) * focusOpacity);
                colorAttr.array[i * 3 + 1] = Math.min(1.7, (0.9 * attentionVal + glow) * focusOpacity);
                colorAttr.array[i * 3 + 2] = Math.min(1.9, (1.15 * attentionVal + glow) * focusOpacity);
            }

            // Calculate Relationships (Lines)
            for (let j = i + 1; j < numParticles; j++) {
                 if (connections >= maxConnections) break;

                 const dx = px - posAttr.array[j * 3];
                 const dy = py - posAttr.array[j * 3 + 1];
                 const dz = pz - posAttr.array[j * 3 + 2];
                 const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                 const jIsFailure = particleClusters[j] === 3;

                 // If the failure zone is active, sever connections by lowering the distance threshold
                 let currentMaxDist = 62;
                 if ((isFailureNode || jIsFailure) && failureFactor > 0) {
                     currentMaxDist = 62 - (failureFactor * 42);
                 }

                 if (dist < currentMaxDist) {
                     const alpha = (1.0 - dist / currentMaxDist) * 0.45;

                     const r1 = colorAttr.array[i*3], g1 = colorAttr.array[i*3+1], b1 = colorAttr.array[i*3+2];
                     const r2 = colorAttr.array[j*3], g2 = colorAttr.array[j*3+1], b2 = colorAttr.array[j*3+2];

                     linePositions[vertexPos++] = px;
                     linePositions[vertexPos++] = py;
                     linePositions[vertexPos++] = pz;
                     linePositions[vertexPos++] = posAttr.array[j * 3];
                     linePositions[vertexPos++] = posAttr.array[j * 3 + 1];
                     linePositions[vertexPos++] = posAttr.array[j * 3 + 2];

                     // Inherit vertex colors with alpha baked partially (since basic line material depth testing / opacity is complex)
                     lineColors[colorPos++] = r1 * alpha;
                     lineColors[colorPos++] = g1 * alpha;
                     lineColors[colorPos++] = b1 * alpha;
                     lineColors[colorPos++] = r2 * alpha;
                     lineColors[colorPos++] = g2 * alpha;
                     lineColors[colorPos++] = b2 * alpha;

                     connections++;
                 }
            }
        }

        if (manualFailureActive && manualBurstArmed) {
            manualBurstArmed = false;
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

        lineGeometry.setDrawRange(0, connections * 2);
        lineGeometry.attributes.position.needsUpdate = true;
        lineGeometry.attributes.color.needsUpdate = true;

        renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    const handleResize = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        if (width <= 0 || height <= 0) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        renderer.render(scene, camera);
    };

    const handleVisibility = () => {
        isVisible = document.visibilityState !== 'hidden';
        if (isVisible) clock.getDelta();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
        renderer.setAnimationLoop(null);
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibility);
        renderer.domElement.removeEventListener('pointermove', handlePointerMove);
        renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
        renderer.domElement.removeEventListener('pointerdown', triggerFailure);
        if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
        }
        pointsGeometry.dispose();
        pointsMaterial.dispose();
        lineGeometry.dispose();
        lineMaterial.dispose();
        renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', minHeight: '420px' }}>
      <div style={{
        position: 'absolute',
        right: '7%',
        bottom: '8%',
        zIndex: 2,
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        padding: '8px 11px',
        borderRadius: '999px',
        background: 'rgba(10,10,10,0.58)',
        border: '1px solid rgba(255,255,255,0.11)',
        color: 'rgba(255,255,255,0.62)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        backdropFilter: 'blur(12px)',
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: webglError ? '#FF3B3B' : '#FAFAFA', boxShadow: webglError ? '0 0 10px #FF3B3B' : '0 0 10px rgba(255,255,255,0.6)' }} />
        {webglError ? 'WebGL fallback' : 'Move cursor to bend attention'}
      </div>
      {webglError && (
        <div style={{
          position: 'absolute',
          inset: '12%',
          display: 'grid',
          placeItems: 'center',
          color: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)',
        }}>
          WebGL could not initialize in this browser context.
        </div>
      )}
    </div>
  );
}
