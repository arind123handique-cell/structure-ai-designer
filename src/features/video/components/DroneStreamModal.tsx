import React, { useState, useRef } from 'react';
import { useVideoStore } from '../videoStore';
import { videoStreamEngine } from '../engines/videoStreamEngine';
import {
  Video,
  Camera,
  Upload,
  Globe,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Radio,
  Cpu,
} from 'lucide-react';

export const DroneStreamModal: React.FC = () => {
  const {
    isStreamModalOpen,
    setStreamModalOpen,
    startSimulatedDroneFeed,
    setVideoSource,
    videoSourceType,
  } = useVideoStore();

  const [networkUrl, setNetworkUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isStreamModalOpen) return null;

  const handleSimulatedLaunch = () => {
    setErrorMsg(null);
    startSimulatedDroneFeed();
  };

  const handleWebcamLaunch = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this browser/environment');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      await videoStreamEngine.loadVideoSource(stream);
      setVideoSource('WEBCAM');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to initialize camera stream');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    videoStreamEngine.loadVideoSource(fileUrl).then(() => {
      setVideoSource('LOCAL_FILE', fileUrl);
    }).catch((err) => {
      setErrorMsg('Failed to decode local video file');
    });
  };

  const handleNetworkConnect = async () => {
    if (!networkUrl.trim()) return;
    setErrorMsg(null);
    try {
      await videoStreamEngine.loadVideoSource(networkUrl);
      setVideoSource('NETWORK_STREAM', networkUrl);
    } catch {
      setErrorMsg('Failed to connect to network video stream');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-void/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-cyber-dark border border-cyber-cyan/40 rounded-sm cyber-chamfer-lg shadow-2xl p-6 relative font-mono text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyber-cyan/20 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyber-cyan animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-wide">
              SITE VIDEO & DRONE STREAM FEED
            </h2>
            <span className="cyber-badge-cyan">V-2099</span>
          </div>
          <button
            type="button"
            onClick={() => setStreamModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-cyber-crimson/15 border border-cyber-crimson/50 text-cyber-crimson text-xs rounded">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {/* 1. Simulated Drone Feed */}
          <div
            onClick={handleSimulatedLaunch}
            className="group cursor-pointer p-4 bg-cyber-surface/90 hover:bg-cyber-surface border border-cyber-cyan/30 hover:border-cyber-cyan rounded transition-all hover:shadow-neon-cyan/30 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Cpu className="w-6 h-6 text-cyber-cyan group-hover:scale-110 transition-transform" />
                <span className="cyber-badge-matrix">READY</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Simulated Drone Flight</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Autonomous drone inspection loop over structural columns, rebar cages, and laser scanning sweeps.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center gap-1 text-[11px] text-cyber-cyan font-bold">
              <Play className="w-3.5 h-3.5" /> LAUNCH SIMULATION
            </div>
          </div>

          {/* 2. Device Camera / Webcam */}
          <div
            onClick={handleWebcamLaunch}
            className="group cursor-pointer p-4 bg-cyber-surface/90 hover:bg-cyber-surface border border-cyber-cyan/30 hover:border-cyber-cyan rounded transition-all hover:shadow-neon-cyan/30 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Camera className="w-6 h-6 text-cyber-matrix group-hover:scale-110 transition-transform" />
                <span className="cyber-badge-cyan">HARDWARE</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Live Device Camera</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Capture live video from local webcam, connected mobile camera, or USB inspection borescope.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center gap-1 text-[11px] text-cyber-matrix font-bold">
              <Play className="w-3.5 h-3.5" /> CONNECT CAMERA
            </div>
          </div>

          {/* 3. Upload Local Drone Video */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer p-4 bg-cyber-surface/90 hover:bg-cyber-surface border border-cyber-cyan/30 hover:border-cyber-cyan rounded transition-all hover:shadow-neon-cyan/30 flex flex-col justify-between"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Upload className="w-6 h-6 text-cyber-amber group-hover:scale-110 transition-transform" />
                <span className="cyber-badge-amber">MP4 / WEBM</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Load Inspection Video</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Upload 4K drone footage or construction time-lapse file from your device.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center gap-1 text-[11px] text-cyber-amber font-bold">
              <Upload className="w-3.5 h-3.5" /> SELECT FILE
            </div>
          </div>

          {/* 4. RTSP / WebRTC Network Stream */}
          <div className="p-4 bg-cyber-surface/90 border border-cyber-cyan/30 rounded flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Globe className="w-6 h-6 text-cyber-magenta" />
                <span className="cyber-badge-cyan">RTSP / HLS</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Network Stream URL</h3>
              <input
                type="text"
                value={networkUrl}
                onChange={(e) => setNetworkUrl(e.target.value)}
                placeholder="https://... / stream.m3u8"
                className="w-full text-xs font-mono bg-cyber-dark border border-slate-700 px-2.5 py-1.5 rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyber-cyan mt-1"
              />
            </div>
            <button
              type="button"
              onClick={handleNetworkConnect}
              disabled={!networkUrl.trim()}
              className="mt-3 pt-2 border-t border-slate-800 flex items-center gap-1 text-[11px] text-cyber-magenta font-bold disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" /> CONNECT STREAM
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-3 flex items-center justify-between">
          <span>STREAM ENCRYPTION: TLS 1.3 // LOW-LATENCY WEBRTC</span>
          <span className="text-cyber-cyan">AR AUGMENTED TWIN READY</span>
        </div>
      </div>
    </div>
  );
};
