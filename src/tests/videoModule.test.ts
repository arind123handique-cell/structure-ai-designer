import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoStore } from '@/features/video/videoStore';
import { cyberAudio } from '@/features/video/audio/cyberAudioSynthesizer';
import { cvDefectDetector } from '@/features/video/engines/cvDefectDetector';

describe('Cyberpunk Video & Telemetry Subsystem', () => {
  beforeEach(() => {
    useVideoStore.setState({
      isStreamActive: false,
      isStreamModalOpen: false,
      detectedDefects: [],
      selectedDefectId: null,
      isBloomEnabled: true,
      isScanlinesEnabled: true,
      isSoundMuted: false,
    });
  });

  it('toggles stream modal and activates simulated drone feed', () => {
    const store = useVideoStore.getState();
    expect(store.isStreamActive).toBe(false);

    store.setStreamModalOpen(true);
    expect(useVideoStore.getState().isStreamModalOpen).toBe(true);

    store.startSimulatedDroneFeed();
    expect(useVideoStore.getState().isStreamActive).toBe(true);
    expect(useVideoStore.getState().videoSourceType).toBe('SIMULATED_DRONE');
    expect(useVideoStore.getState().arCalibration.isArActive).toBe(true);
  });

  it('manages video viewport visual toggles (bloom, scanlines, mute)', () => {
    const store = useVideoStore.getState();
    expect(store.isBloomEnabled).toBe(true);
    store.toggleBloom();
    expect(useVideoStore.getState().isBloomEnabled).toBe(false);

    expect(store.isScanlinesEnabled).toBe(true);
    store.toggleScanlines();
    expect(useVideoStore.getState().isScanlinesEnabled).toBe(false);

    const initialMute = store.isSoundMuted;
    store.toggleMute();
    expect(useVideoStore.getState().isSoundMuted).toBe(!initialMute);
  });

  it('records defects and manages defect selection', () => {
    const store = useVideoStore.getState();
    expect(store.detectedDefects.length).toBe(0);

    store.addDefect({
      id: 'DEF-TEST-01',
      type: 'CRACK',
      severity: 'CRITICAL',
      estimatedWidthMm: 0.45,
      confidence: 0.95,
      boundingBox: { x: 0.2, y: 0.3, width: 0.1, height: 0.1 },
      nearestMemberId: 101,
      timestamp: Date.now(),
    });

    expect(useVideoStore.getState().detectedDefects.length).toBe(1);
    expect(useVideoStore.getState().detectedDefects[0].id).toBe('DEF-TEST-01');

    store.selectDefect('DEF-TEST-01');
    expect(useVideoStore.getState().selectedDefectId).toBe('DEF-TEST-01');
  });

  it('updates drone telemetry smoothly', () => {
    const store = useVideoStore.getState();
    store.updateTelemetry({ altitudeM: 42.5, batteryPct: 92 });

    expect(useVideoStore.getState().telemetry.altitudeM).toBe(42.5);
    expect(useVideoStore.getState().telemetry.batteryPct).toBe(92);
  });

  it('handles procedural audio triggers gracefully without throwing in Node/JSDOM', () => {
    expect(() => {
      cyberAudio.playSelectChirp();
      cyberAudio.playCalculationComplete();
      cyberAudio.playFailureAlert();
      cyberAudio.playVideoStart();
    }).not.toThrow();
  });
});
