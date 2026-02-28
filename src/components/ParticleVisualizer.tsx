'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ParticleSettings, MappingMode, ChannelRouting } from '@/types/music';

const PARTICLE_COUNT = 10000;

function applyTransferFunction(energy: number, mode: MappingMode): number {
  switch (mode) {
    case 'linear':
      return energy;
    case 'exponential':
      return energy * energy * energy;
    case 'threshold':
      return energy > 0.3 ? 1.0 : 0.0;
    case 'harmonic':
      return (Math.sin(energy * Math.PI * 2) + 1) / 2;
    case 'inverse':
      return 1 - energy;
    default:
      return energy;
  }
}

function applyChannelRouting(
  bass: number,
  mid: number,
  treble: number,
  routing: ChannelRouting
): { sizeEnergy: number; colorEnergy: number; brightnessEnergy: number } {
  switch (routing) {
    case 'normal':
      return { sizeEnergy: bass, colorEnergy: mid, brightnessEnergy: treble };
    case 'swapped':
      return { sizeEnergy: treble, colorEnergy: bass, brightnessEnergy: mid };
    case 'mono': {
      const avg = (bass + mid + treble) / 3;
      return { sizeEnergy: avg, colorEnergy: avg, brightnessEnergy: avg };
    }
    default:
      return { sizeEnergy: bass, colorEnergy: mid, brightnessEnergy: treble };
  }
}

interface ParticleSceneProps {
  analyserNode: AnalyserNode | null;
  settings: ParticleSettings;
}

function ParticleScene({ analyserNode, settings }: ParticleSceneProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 50;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return arr;
  }, []);

  const colorArray = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    const color = new THREE.Color();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      color.setHSL(0.7, 0.7, 0.5);
      arr[i * 3] = color.r;
      arr[i * 3 + 1] = color.g;
      arr[i * 3 + 2] = color.b;
    }
    return arr;
  }, []);

  useFrame(() => {
    if (!pointsRef.current || !materialRef.current) return;

    let bass = 0;
    let mid = 0;
    let treble = 0;

    if (analyserNode) {
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      // Bass: bins 0-10
      let bassSum = 0;
      const bassEnd = Math.min(11, bufferLength);
      for (let i = 0; i < bassEnd; i++) bassSum += dataArray[i];
      bass = bassSum / bassEnd / 255;

      // Mid: bins 50-200
      let midSum = 0;
      const midStart = Math.min(50, bufferLength);
      const midEnd = Math.min(201, bufferLength);
      for (let i = midStart; i < midEnd; i++) midSum += dataArray[i];
      mid = midEnd > midStart ? midSum / (midEnd - midStart) / 255 : 0;

      // Treble: bins 250-500
      let trebleSum = 0;
      const trebleStart = Math.min(250, bufferLength);
      const trebleEnd = Math.min(501, bufferLength);
      for (let i = trebleStart; i < trebleEnd; i++) trebleSum += dataArray[i];
      treble = trebleEnd > trebleStart ? trebleSum / (trebleEnd - trebleStart) / 255 : 0;
    }

    // Apply transfer function
    bass = applyTransferFunction(bass, settings.mappingMode);
    mid = applyTransferFunction(mid, settings.mappingMode);
    treble = applyTransferFunction(treble, settings.mappingMode);

    // Apply channel routing
    const { sizeEnergy, colorEnergy, brightnessEnergy } = applyChannelRouting(
      bass, mid, treble, settings.channelRouting
    );

    // Update particle size
    materialRef.current.size = 0.01 + sizeEnergy * 0.12;

    // Update rotation
    pointsRef.current.rotation.y += 0.0005 + sizeEnergy * 0.003;
    pointsRef.current.rotation.x += 0.0005 + colorEnergy * 0.0015;

    // Update colors
    const colors = pointsRef.current.geometry.attributes.color;
    if (colors) {
      const color = new THREE.Color();
      const hue = 0.55 + colorEnergy * 0.45;
      const saturation = 0.6 + brightnessEnergy * 0.3;
      const lightness = 0.4 + brightnessEnergy * 0.35;
      color.setHSL(hue, saturation, lightness);

      const arr = colors.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        arr[i * 3] = color.r;
        arr[i * 3 + 1] = color.g;
        arr[i * 3 + 2] = color.b;
      }
      colors.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colorArray, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.05}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

interface ParticleVisualizerProps {
  analyserNode: AnalyserNode | null;
  settings: ParticleSettings;
}

export default function ParticleVisualizer({ analyserNode, settings }: ParticleVisualizerProps) {
  return (
    <div className="particle-canvas-container">
      <Canvas
        camera={{ position: [0, 0, 30], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <ParticleScene analyserNode={analyserNode} settings={settings} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />
      </Canvas>
    </div>
  );
}
