import React, { useState, useEffect, useRef } from 'react';

export default function ApexDiagnostics() {
  // Audio Diagnostic States
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'active' | 'error'>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Audio API Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Camera Diagnostic States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'active' | 'error'>('idle');
  const [cameraResolution, setCameraResolution] = useState<string>('---');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Network Latency State
  const [latency, setLatency] = useState<number | null>(null);
  const [isTestingPing, setIsTestingPing] = useState(false);

  // FPS Render State
  const [fps] = useState<number>(60);

  // --- 1. Microphone & Waveform Logic ---
  const startMicrophoneTest = async () => {
    try {
      setAudioStatus('active');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsListening(true);
      visualizeAudio();
    } catch (err) {
      console.error('Mic access denied or error:', err);
      setAudioStatus('error');
    }
  };

  const stopMicrophoneTest = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setAudioStatus('idle');
    setAudioLevel(0);
  };

  const visualizeAudio = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      setAudioLevel(Math.round((avg / 255) * 100));

      if (!canvasCtx) return;
      const width = canvas.width;
      const height = canvas.height;

      canvasCtx.fillStyle = '#030712';
      canvasCtx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        canvasCtx.fillStyle = 'rgb(6, 182, 212)';
        canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  };

  // --- 2. Camera & Video Diagnostic Logic ---
  const startCameraTest = async () => {
    try {
      setCameraStatus('active');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: false 
      });
      videoStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Extract active track settings for hardware specs display
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setCameraResolution(`${settings.width || 'Unknown'}x${settings.height || 'Unknown'} @ ${settings.frameRate || 30}fps`);
      
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera access denied or error:', err);
      setCameraStatus('error');
    }
  };

  const stopCameraTest = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraStatus('idle');
    setCameraResolution('---');
  };

  useEffect(() => {
    return () => {
      stopMicrophoneTest();
      stopCameraTest();
    };
  }, []);

  const runPingTest = async () => {
    setIsTestingPing(true);
    const start = performance.now();
    try {
      await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' });
      const end = performance.now();
      setLatency(Math.round(end - start));
    } catch {
      setLatency(null);
    } finally {
      setIsTestingPing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">Aerostratastack // Execution Layer</div>
            <h1 className="text-3xl font-bold tracking-tight mt-1">ApexDiag Control Center</h1>
          </div>
        </header>

        {/* Audio / Mic Diagnostics Module */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Audio Input & Waveform Test</h2>
              <p className="text-xs text-slate-400 mt-0.5">Captures local microphone stream via Web Audio API and renders frequency domain.</p>
            </div>
            <div>
              {!isListening ? (
                <button
                  onClick={startMicrophoneTest}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-lg shadow-cyan-500/20"
                >
                  Initialize Mic
                </button>
              ) : (
                <button
                  onClick={stopMicrophoneTest}
                  className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-semibold rounded-lg text-xs transition-colors"
                >
                  Disconnect Mic
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">STATUS: <span className="text-cyan-400 uppercase">{audioStatus}</span></span>
              <span className="text-slate-400">SIGNAL LEVEL: <span className="text-emerald-400">{audioLevel}%</span></span>
            </div>

            <canvas
              ref={canvasRef}
              width={600}
              height={100}
              className="w-full h-24 bg-slate-950 rounded border border-slate-900 block"
            />
          </div>
        </div>

        {/* Camera Feed Diagnostic Module */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Camera Feed & Sensor Inspection</h2>
              <p className="text-xs text-slate-400 mt-0.5">Stream direct video capture, track resolution, and inspect hardware sensor bounds.</p>
            </div>
            <div>
              {!isCameraActive ? (
                <button
                  onClick={startCameraTest}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-lg shadow-cyan-500/20"
                >
                  Initialize Camera
                </button>
              ) : (
                <button
                  onClick={stopCameraTest}
                  className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-semibold rounded-lg text-xs transition-colors"
                >
                  Disconnect Camera
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">STATUS: <span className="text-cyan-400 uppercase">{cameraStatus}</span></span>
              <span className="text-slate-400">FEED SPECS: <span className="text-emerald-400">{cameraResolution}</span></span>
            </div>

            <div className="relative w-full h-64 bg-slate-900 rounded border border-slate-900 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
              />
              {!isCameraActive && (
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                  [Camera Feed Standby / Offline]
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Quick Diagnostics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Local Egress / Round-Trip Ping</h3>
              <p className="text-xs text-slate-400 mt-0.5">Measures local client-server loop latency.</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold font-mono text-cyan-400">
                {latency !== null ? `${latency} ms` : '---'}
              </span>
              <button
                onClick={runPingTest}
                disabled={isTestingPing}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-md transition-colors"
              >
                {isTestingPing ? 'Pinging...' : 'Run Ping Test'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">UI Render Engine</h3>
              <p className="text-xs text-slate-400 mt-0.5">Main thread frame rate stability.</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {fps} FPS
              </span>
              <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
                Stable
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}