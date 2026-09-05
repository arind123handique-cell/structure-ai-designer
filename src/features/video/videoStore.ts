import { create } from 'zustand';
import {
  VideoSourceType,
  DroneTelemetry,
  StructuralDefect,
  ArCalibration,
  VideoRecordingState,
} from './types/videoTypes';
import { cyberAudio } from './audio/cyberAudioSynthesizer';

export interface VideoStoreState {
  // Video Stream Configuration
  isStreamActive: boolean;
  videoSourceType: VideoSourceType;
  streamUrl: string | null;
  videoElement: HTMLVideoElement | null;
  isStreamModalOpen: boolean;

  // Visual Cyberpunk & Hologram Settings
  isBloomEnabled: boolean;
  isScanlinesEnabled: boolean;
  isHologramMode: boolean;
  isSoundMuted: boolean;

  // Live Drone Telemetry
  telemetry: DroneTelemetry;

  // Real-time Computer Vision & Defects
  isCvDetectionActive: boolean;
  detectedDefects: StructuralDefect[];
  selectedDefectId: string | null;

  // AR Projection & Calibration
  arCalibration: ArCalibration;

  // In-Browser Recording
  recordingState: VideoRecordingState;

  // Actions
  setStreamModalOpen: (open: boolean) => void;
  startSimulatedDroneFeed: () => void;
  setVideoSource: (type: VideoSourceType, url?: string) => void;
  stopStream: () => void;
  setVideoElement: (el: HTMLVideoElement | null) => void;

  toggleBloom: () => void;
  toggleScanlines: () => void;
  toggleHologramMode: () => void;
  toggleMute: () => boolean;

  setUnderlayOpacity: (opacity: number) => void;
  toggleArActive: () => void;
  toggleCvDetection: () => void;
  addDefect: (defect: StructuralDefect) => void;
  clearDefects: () => void;
  selectDefect: (id: string | null) => void;

  setRecordingState: (state: Partial<VideoRecordingState>) => void;
  updateTelemetry: (telemetry: Partial<DroneTelemetry>) => void;
}

export const useVideoStore = create<VideoStoreState>((set, get) => ({
  isStreamActive: false,
  videoSourceType: 'SIMULATED_DRONE',
  streamUrl: null,
  videoElement: null,
  isStreamModalOpen: false,

  isBloomEnabled: false,
  isScanlinesEnabled: false,
  isHologramMode: false,
  isSoundMuted: cyberAudio.isMuted(),

  telemetry: {
    altitudeM: 34.8,
    headingDeg: 142,
    batteryPct: 88,
    fps: 60,
    gps: { lat: 26.1442, lon: 91.7362 },
    signalQuality: 96,
    droneId: 'DRONE-ALPHA // V-2099',
  },

  isCvDetectionActive: false,
  detectedDefects: [
    {
      id: 'DEF-01',
      type: 'CRACK',
      severity: 'CRITICAL',
      estimatedWidthMm: 0.38,
      confidence: 0.984,
      boundingBox: { x: 0.28, y: 0.35, width: 0.14, height: 0.12 },
      nearestMemberId: 104,
      timestamp: Date.now() - 12000,
    },
    {
      id: 'DEF-02',
      type: 'HONEYCOMB',
      severity: 'MEDIUM',
      estimatedWidthMm: 1.2,
      confidence: 0.912,
      boundingBox: { x: 0.62, y: 0.58, width: 0.18, height: 0.15 },
      nearestMemberId: 208,
      timestamp: Date.now() - 4000,
    },
  ],
  selectedDefectId: null,

  arCalibration: {
    underlayOpacity: 0.55,
    isArActive: false,
    wireframeBlend: true,
    fovCorrection: 45,
    cameraOffset: [0, 0, 0],
  },

  recordingState: {
    isRecording: false,
    elapsedSeconds: 0,
    fps: 60,
    bitrateMbps: 25,
    lastVideoBlob: null,
    lastVideoUrl: null,
  },

  setStreamModalOpen: (open) => {
    cyberAudio.playSelectChirp();
    set({ isStreamModalOpen: open });
  },

  startSimulatedDroneFeed: () => {
    cyberAudio.playVideoStart();
    set({
      isStreamActive: true,
      videoSourceType: 'SIMULATED_DRONE',
      isStreamModalOpen: false,
      arCalibration: {
        ...get().arCalibration,
        isArActive: true,
      },
    });
  },

  setVideoSource: (type, url) => {
    cyberAudio.playVideoStart();
    set({
      isStreamActive: true,
      videoSourceType: type,
      streamUrl: url || null,
      isStreamModalOpen: false,
      arCalibration: {
        ...get().arCalibration,
        isArActive: true,
      },
    });
  },

  stopStream: () => {
    cyberAudio.playSelectChirp();
    set({
      isStreamActive: false,
      streamUrl: null,
      arCalibration: {
        ...get().arCalibration,
        isArActive: false,
      },
    });
  },

  setVideoElement: (el) => set({ videoElement: el }),

  toggleBloom: () => {
    cyberAudio.playSelectChirp();
    set((s) => ({ isBloomEnabled: !s.isBloomEnabled }));
  },

  toggleScanlines: () => {
    cyberAudio.playSelectChirp();
    set((s) => ({ isScanlinesEnabled: !s.isScanlinesEnabled }));
  },

  toggleHologramMode: () => {
    cyberAudio.playSelectChirp();
    set((s) => ({ isHologramMode: !s.isHologramMode }));
  },

  toggleMute: () => {
    const isMuted = cyberAudio.toggleMute();
    set({ isSoundMuted: isMuted });
    return isMuted;
  },

  setUnderlayOpacity: (opacity) => {
    set((s) => ({
      arCalibration: { ...s.arCalibration, underlayOpacity: Math.max(0, Math.min(1, opacity)) },
    }));
  },

  toggleArActive: () => {
    cyberAudio.playSelectChirp();
    set((s) => ({
      arCalibration: { ...s.arCalibration, isArActive: !s.arCalibration.isArActive },
    }));
  },

  toggleCvDetection: () => {
    cyberAudio.playSelectChirp();
    set((s) => ({ isCvDetectionActive: !s.isCvDetectionActive }));
  },

  addDefect: (defect) => {
    set((s) => {
      if (s.detectedDefects.some((d) => d.id === defect.id)) return s;
      const updated = [defect, ...s.detectedDefects].slice(0, 5);
      return { detectedDefects: updated };
    });
  },

  clearDefects: () => set({ detectedDefects: [] }),

  selectDefect: (id) => {
    cyberAudio.playSelectChirp();
    set({ selectedDefectId: id });
  },

  setRecordingState: (state) => {
    set((s) => ({ recordingState: { ...s.recordingState, ...state } }));
  },

  updateTelemetry: (newTelemetry) => {
    set((s) => ({ telemetry: { ...s.telemetry, ...newTelemetry } }));
  },
}));
