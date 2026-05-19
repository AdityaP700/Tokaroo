import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function SemanticNetworkEngine({ onStateChange }: { onStateChange?: (state: 'normal' | 'failure' | 'recovery') => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const container = containerRef.current;
    let winWidth = container.clientWidth;
    let winHeight = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, winWidth / winHeight, 1, 1000);
    // Move the camera a bit to the right and back
    camera.position.z = 400;
    camera.position.x = -80; // Pan so the cluster is centered a bit to the right

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(winWidth, winHeight);
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
        // Initial spherical distribution
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;

        const x = radius * Math.sin(theta) * Math.cos(phi);
        const y = radius * Math.sin(theta) * Math.sin(phi);
        const z = radius * Math.cos(theta);

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
        particleClusters.push(Math.floor(Math.random() * clusterCenters.length));
        phaseOffsets.push(Math.random() * Math.PI * 2);

        colors[3 * i] = 1;
        colors[3 * i + 1] = 1;
        colors[3 * i + 2] = 1;

        sizes[i] = Math.random() * 2 + 1.0;
    }

    // Speed multiplier per particle to create motion contrast
    const speedMultipliers = new Float32Array(numParticles);
    for (let i = 0; i < numParticles; i++) {
        speedMultipliers[i] = (i % 3 === 0) ? 2.5 : 0.6; // High contrast
    }

    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pointsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    pointsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage)); // Re-uploading for dynamic

    // Particles material
    const pointsMaterial = new THREE.PointsMaterial({
      size: 3.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
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
        opacity: 0.25,
        depthWrite: false
    });
    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineMesh);

    let animationFrameId: number;
    let time = 0;
    let lastState = 'normal';

    const animate = () => {
        time += 0.012;
        const cycle = time % 8; // 8 seconds storytelling loop

        // --- Storytelling Loop ---
        // 0.0s - 3.5s: System normal & processing well
        // 3.5s - 5.5s: The failure zone begins malfunctioning (nodes turn red, connections drop)
        // 5.5s - 8.0s: Recovery
        let currentState: 'normal' | 'failure' | 'recovery' = 'normal';
        if (cycle >= 3.5 && cycle < 5.5) currentState = 'failure';
        else if (cycle >= 5.5) currentState = 'recovery';

        if (currentState !== lastState) {
            lastState = currentState;
            if (onStateChange) onStateChange(currentState);
        }

        const failureFactor = cycle > 3.5 && cycle < 5.5
            ? Math.min((cycle - 3.5) * 1.5, 1)
            : (cycle >= 5.5 ? Math.max(1 - (cycle - 5.5) * 1.2, 0) : 0);

        // Camera shake during failure
        if (failureFactor > 0.1 && failureFactor < 0.9) {
            const shake = failureFactor * 2.5;
            camera.position.x = -80 + (Math.random() - 0.5) * shake;
            camera.position.y = (Math.random() - 0.5) * shake;
        } else {
            camera.position.x += (-80 - camera.position.x) * 0.1;
            camera.position.y += (0 - camera.position.y) * 0.1;
        }

        scene.rotation.y += 0.0015;
        scene.rotation.x += 0.0005;

        const posAttr = pointsGeometry.attributes.position;
        const colorAttr = pointsGeometry.attributes.color;
        const sizeAttr = pointsGeometry.attributes.size;

        let vertexPos = 0;
        let colorPos = 0;
        let connections = 0;

        const focusPoint = new THREE.Vector3(120, 30, 0); // Focus cluster zone

        for (let i = 0; i < numParticles; i++) {
            const clusterIdx = particleClusters[i];
            const isFailureNode = clusterIdx === 3;
            const speedMultiplier = speedMultipliers[i];

            // Directional Flow Motion (Contrast)
            velocities[i].x += Math.sin(time + i) * 0.002 * speedMultiplier;
            velocities[i].y += Math.cos(time * 0.8 + i) * 0.002 * speedMultiplier;

            // Dramatic Burst on Failure enter
            if (isFailureNode && cycle > 3.5 && cycle < 3.6) {
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
            const focusOpacity = 0.3 + focusFactor * 0.7; // Fades out nodes far from focus

            if (isFailureNode) {
                // Fade to bright red as failureFactor increases
                const maxRedScale = Math.max(1, failureFactor * 2);
                const r = 1 * maxRedScale; // Extremely bright on fail
                const g = 1 - failureFactor * 0.85;
                const b = 1 - failureFactor * 0.85;

                colorAttr.array[i * 3] = r * attentionVal * focusOpacity;
                colorAttr.array[i * 3 + 1] = g * attentionVal * focusOpacity;
                colorAttr.array[i * 3 + 2] = b * attentionVal * focusOpacity;
            } else {
                // Normal nodes
                // Add soft glow to active focused items
                const glow = isFocused ? 0.4 : 0;
                colorAttr.array[i * 3] = (0.8 * attentionVal + glow) * focusOpacity;
                colorAttr.array[i * 3 + 1] = (0.9 * attentionVal + glow) * focusOpacity;
                colorAttr.array[i * 3 + 2] = (1.0 * attentionVal + glow) * focusOpacity;
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
                 let currentMaxDist = 45;
                 if ((isFailureNode || jIsFailure) && failureFactor > 0) {
                     currentMaxDist = 45 - (failureFactor * 32);
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

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;

        lineGeometry.setDrawRange(0, connections * 2);
        lineGeometry.attributes.position.needsUpdate = true;
        lineGeometry.attributes.color.needsUpdate = true;

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
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

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
