'use client';

import { useState, useRef, useCallback } from 'react';
import type { AudioLoadSource } from '@/types/music';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const isPlayingRef = useRef(false);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const durationRef = useRef(0);

  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    const gain = ctx.createGain();
    gain.gain.value = 1;

    analyser.connect(gain);
    gain.connect(ctx.destination);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    gainNodeRef.current = gain;
  }, []);

  const updateCurrentTime = useCallback(() => {
    if (!isPlayingRef.current || !audioContextRef.current) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    const time = pauseTimeRef.current + elapsed;

    if (time >= durationRef.current) {
      // Track ended
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch { /* already stopped */ }
        sourceRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentTime(0);
      pauseTimeRef.current = 0;
      return;
    }

    setCurrentTime(time);
    animFrameRef.current = requestAnimationFrame(updateCurrentTime);
  }, []);

  const loadTrack = useCallback(async (source: AudioLoadSource): Promise<number> => {
    initAudioContext();

    // Stop any current playback
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    pauseTimeRef.current = 0;
    setCurrentTime(0);

    const ctx = audioContextRef.current!;

    let arrayBuffer: ArrayBuffer;
    if (source instanceof File) {
      arrayBuffer = await source.arrayBuffer();
    } else {
      const response = await fetch(source);
      arrayBuffer = await response.arrayBuffer();
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferRef.current = audioBuffer;
    durationRef.current = audioBuffer.duration;
    setDuration(audioBuffer.duration);

    return audioBuffer.duration;
  }, [initAudioContext]);

  const playTrack = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current || !analyserRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(analyserRef.current);

    source.onended = () => {
      if (isPlayingRef.current && sourceRef.current === source) {
        // Natural end
        isPlayingRef.current = false;
        setIsPlaying(false);
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        cancelAnimationFrame(animFrameRef.current);
      }
    };

    const offset = pauseTimeRef.current;
    startTimeRef.current = ctx.currentTime;
    source.start(0, offset);
    sourceRef.current = source;

    isPlayingRef.current = true;
    setIsPlaying(true);

    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(updateCurrentTime);
  }, [updateCurrentTime]);

  const pauseTrack = useCallback(() => {
    if (!audioContextRef.current || !isPlayingRef.current) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    pauseTimeRef.current = pauseTimeRef.current + elapsed;

    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }

    isPlayingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const stopTrack = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }

    isPlayingRef.current = false;
    setIsPlaying(false);
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const seekTo = useCallback((time: number) => {
    pauseTimeRef.current = time;

    if (isPlayingRef.current && audioContextRef.current && audioBufferRef.current && analyserRef.current) {
      // Stop current source without resetting pauseTime
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch { /* already stopped */ }
      }

      const ctx = audioContextRef.current;
      const source = ctx.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(analyserRef.current);

      source.onended = () => {
        if (isPlayingRef.current && sourceRef.current === source) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          pauseTimeRef.current = 0;
          setCurrentTime(0);
          cancelAnimationFrame(animFrameRef.current);
        }
      };

      startTimeRef.current = ctx.currentTime;
      source.start(0, time);
      sourceRef.current = source;
    } else {
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = v;
    }
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    loadTrack,
    playTrack,
    pauseTrack,
    stopTrack,
    seekTo,
    setVolume,
    analyserRef,
  };
}
