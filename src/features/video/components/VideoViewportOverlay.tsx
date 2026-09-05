import React from 'react';
import { useVideoStore } from '../videoStore';
import {
  Crosshair,
  Radio,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Tv,
  AlertTriangle,
  Layers,
  CircleDot,
  VideoOff,
} from 'lucide-react';

export const VideoViewportOverlay: React.FC = () => {
  const {
    isStreamActive,
    telemetry,
    detectedDefects,
    selectedDefectId,
    selectDefect,
    arCalibration,
    setUnderlayOpacity,
    isBloomEnabled,
    toggleBloom,
    isScanlinesEnabled,
    toggleScanlines,
    isHologramMode,
    toggleHologramMode,
    isSoundMuted,
    toggleMute,
    stopStream,
  } = useVideoStore();

  if (!isStreamActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 select-none">
      {/* Top HUD: Tactical Drone Telemetry Bar */}
      <div className="pointer-events-auto flex items-center justify-between gap-3 bg-cyber-dark/85 backdrop-blur-md border border-cyber-cyan/30 px-3 py-1.5 rounded-sm cyber-chamfer text-xs font-mono shadow-neon-cyan/20">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-crimson opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyber-crimson" />
          </span>
          <span className="text-cyber-crimson font-bold tracking-wider">[LIVE STREAM]</span>
          <span className="text-slate-500">|</span>
          <span className="text-cyber-cyan font-semibold">{telemetry.droneId}</span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-[11px] text-slate-300">
          <span>
            ALT: <strong className="text-cyber-cyan">{telemetry.altitudeM.toFixed(1)}m</strong>
          </span>
          <span>
            HDG: <strong className="text-cyber-cyan">{telemetry.headingDeg}°</strong>
          </span>
          <span>
            BAT: <strong className="text-cyber-matrix">{telemetry.batteryPct}%</strong>
          </span>
          <span>
            SIG: <strong className="text-cyber-cyan">{telemetry.signalQuality}%</strong>
          </span>
          <span>
            FPS: <strong className="text-cyber-matrix">{telemetry.fps}</strong>
          </span>
          <span>
            GPS:{' '}
            <strong className="text-slate-300">
              {telemetry.gps.lat.toFixed(4)}N, {telemetry.gps.lon.toFixed(4)}E
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={stopStream}
            className="flex items-center gap-1 px-2 py-0.5 bg-cyber-crimson/20 hover:bg-cyber-crimson/40 border border-cyber-crimson/50 text-cyber-crimson text-[10px] font-mono rounded transition-colors"
            title="Disconnect Drone Stream"
          >
            <VideoOff className="w-3 h-3" />
            DISCONNECT
          </button>
        </div>
      </div>

      {/* Target Reticles for Detected Defects */}
      <div className="relative flex-1 w-full h-full pointer-events-none">
        {detectedDefects.map((defect) => {
          const isSelected = selectedDefectId === defect.id;
          const leftPct = `${defect.boundingBox.x * 100}%`;
          const topPct = `${defect.boundingBox.y * 100}%`;
          const widthPct = `${defect.boundingBox.width * 100}%`;
          const heightPct = `${defect.boundingBox.height * 100}%`;

          return (
            <div
              key={defect.id}
              style={{ left: leftPct, top: topPct, width: widthPct, height: heightPct }}
              className={`absolute pointer-events-auto cursor-pointer transition-transform ${
                isSelected ? 'scale-105 z-30' : 'z-20'
              }`}
              onClick={() => selectDefect(isSelected ? null : defect.id)}
            >
              {/* Reticle bounding box */}
              <div
                className={`w-full h-full border-2 ${
                  defect.severity === 'CRITICAL'
                    ? 'border-cyber-crimson shadow-[0_0_12px_rgba(255,0,85,0.6)]'
                    : 'border-cyber-amber shadow-[0_0_12px_rgba(255,183,3,0.6)]'
                } cyber-reticle flex flex-col justify-between p-1 bg-cyber-dark/30 backdrop-blur-[2px]`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-mono font-bold px-1 rounded ${
                      defect.severity === 'CRITICAL'
                        ? 'bg-cyber-crimson text-white'
                        : 'bg-cyber-amber text-cyber-dark font-bold'
                    }`}
                  >
                    {defect.type}
                  </span>
                  <span className="text-[9px] font-mono text-white/90 font-bold">
                    {(defect.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="text-[10px] font-mono font-bold text-white bg-cyber-dark/80 px-1 py-0.5 rounded flex items-center justify-between border border-white/10">
                  <span>W: {defect.estimatedWidthMm}mm</span>
                  {defect.nearestMemberId && (
                    <span className="text-cyber-cyan">M#{defect.nearestMemberId}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom HUD: AR Transparency Controls & Cyber Visual Toggles */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 bg-cyber-dark/90 backdrop-blur-md border border-cyber-cyan/30 px-3 py-2 rounded-sm cyber-chamfer text-xs font-mono shadow-neon-cyan/20">
        {/* AR Video Blend Slider */}
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-cyber-cyan" />
          <span className="text-slate-300 text-[11px]">AR BLEND:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={arCalibration.underlayOpacity}
            onChange={(e) => setUnderlayOpacity(parseFloat(e.target.value))}
            className="w-24 accent-cyber-cyan h-1.5 cursor-pointer bg-slate-800 rounded"
            title="Adjust Drone Video vs 3D Model Opacity"
          />
          <span className="text-cyber-cyan text-[11px] font-bold min-w-[32px]">
            {Math.round(arCalibration.underlayOpacity * 100)}%
          </span>
        </div>

        {/* Viewport Toggles (Bloom, Hologram, Scanlines, Sound) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleBloom}
            className={`flex items-center gap-1 px-2 py-1 border rounded text-[10px] font-mono transition-colors ${
              isBloomEnabled
                ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan shadow-neon-cyan/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
            title="Toggle Three.js Unreal Bloom Glow"
          >
            <Sparkles className="w-3 h-3" />
            BLOOM {isBloomEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={toggleHologramMode}
            className={`flex items-center gap-1 px-2 py-1 border rounded text-[10px] font-mono transition-colors ${
              isHologramMode
                ? 'bg-cyber-matrix/20 border-cyber-matrix text-cyber-matrix shadow-neon-matrix/30'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
            title="Toggle Holographic Wireframe Shader"
          >
            <CircleDot className="w-3 h-3" />
            HOLO {isHologramMode ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={toggleScanlines}
            className={`flex items-center gap-1 px-2 py-1 border rounded text-[10px] font-mono transition-colors ${
              isScanlinesEnabled
                ? 'bg-cyber-amber/20 border-cyber-amber text-cyber-amber'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
            title="Toggle CRT Interlaced Scanlines"
          >
            <Tv className="w-3 h-3" />
            CRT
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className={`flex items-center gap-1 px-2 py-1 border rounded text-[10px] font-mono transition-colors ${
              !isSoundMuted
                ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
            title="Toggle Web Audio Procedural Telemetry Sounds"
          >
            {!isSoundMuted ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            AUDIO
          </button>
        </div>
      </div>
    </div>
  );
};
