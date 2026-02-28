'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { WaveformSettings } from '@/types/music';

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  settings: WaveformSettings;
}

export default function Visualizer({ analyserNode, settings }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match container
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Trail effect: semi-transparent overlay instead of full clear
    ctx.fillStyle = `rgba(10, 10, 15, ${settings.trailPersistence})`;
    ctx.fillRect(0, 0, width, height);

    if (settings.drawMode === 'bars') {
      drawBars(ctx, analyserNode, width, height);
    } else if (settings.drawMode === 'mirror') {
      drawMirror(ctx, analyserNode, width, height, settings.lineThickness);
    } else {
      drawLine(ctx, analyserNode, width, height, settings.lineThickness);
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, settings]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="visualizer-canvas"
    />
  );
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  analyser: AnalyserNode,
  width: number,
  height: number,
  lineWidth: number
) {
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = '#8b5cf6';
  ctx.shadowColor = '#8b5cf6';
  ctx.shadowBlur = 8;
  ctx.beginPath();

  const sliceWidth = width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * height) / 2;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }

  ctx.lineTo(width, height / 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawMirror(
  ctx: CanvasRenderingContext2D,
  analyser: AnalyserNode,
  width: number,
  height: number,
  lineWidth: number
) {
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  const centerY = height / 2;
  const sliceWidth = width / bufferLength;

  // Top half gradient
  const gradientUp = ctx.createLinearGradient(0, centerY, 0, 0);
  gradientUp.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
  gradientUp.addColorStop(1, 'rgba(236, 72, 153, 0.4)');

  // Bottom half gradient
  const gradientDown = ctx.createLinearGradient(0, centerY, 0, height);
  gradientDown.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
  gradientDown.addColorStop(1, 'rgba(59, 130, 246, 0.4)');

  // Draw upper mirror
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(0, centerY);

  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = (dataArray[i] - 128) / 128.0;
    const y = centerY - Math.abs(v) * centerY * 0.9;
    ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(width, centerY);
  ctx.closePath();
  ctx.fillStyle = gradientUp;
  ctx.fill();

  // Draw lower mirror
  ctx.beginPath();
  ctx.moveTo(0, centerY);

  x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = (dataArray[i] - 128) / 128.0;
    const y = centerY + Math.abs(v) * centerY * 0.9;
    ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(width, centerY);
  ctx.closePath();
  ctx.fillStyle = gradientDown;
  ctx.fill();

  // Center line
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  analyser: AnalyserNode,
  width: number,
  height: number
) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  const barCount = 64;
  const binsPerBar = Math.floor(bufferLength / barCount);
  const barWidth = (width / barCount) * 0.8;
  const barGap = (width / barCount) * 0.2;

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    for (let j = 0; j < binsPerBar; j++) {
      sum += dataArray[i * binsPerBar + j];
    }
    const avg = sum / binsPerBar / 255;
    const barHeight = avg * height * 0.85;
    const x = i * (barWidth + barGap);
    const y = height - barHeight;

    const hue = 260 + avg * 60;
    ctx.fillStyle = `hsl(${hue}, 80%, ${50 + avg * 20}%)`;
    ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    const radius = Math.min(barWidth / 2, 4);
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    ctx.lineTo(x + barWidth, height);
    ctx.lineTo(x, height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}
