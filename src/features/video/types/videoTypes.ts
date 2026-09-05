export type VideoSourceType =
  | 'SIMULATED_DRONE'
  | 'WEBCAM'
  | 'LOCAL_FILE'
  | 'NETWORK_STREAM';

export interface DroneTelemetry {
  altitudeM: number;
  headingDeg: number;
  batteryPct: number;
  fps: number;
  gps: {
    lat: number;
    lon: number;
  };
  signalQuality: number; // 0 - 100
  droneId: string;
}

export interface StructuralDefect {
  id: string;
  type: 'CRACK' | 'SPALLING' | 'HONEYCOMB' | 'CORROSION';
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  estimatedWidthMm: number;
  confidence: number; // 0 - 1
  boundingBox: {
    x: number;      // 0 - 1 normalized
    y: number;      // 0 - 1 normalized
    width: number;  // 0 - 1 normalized
    height: number; // 0 - 1 normalized
  };
  nearestMemberId?: number;
  timestamp: number;
}

export interface ArCalibration {
  underlayOpacity: number; // 0 - 1
  isArActive: boolean;
  wireframeBlend: boolean;
  fovCorrection: number;
  cameraOffset: [number, number, number];
}

export interface VideoRecordingState {
  isRecording: boolean;
  elapsedSeconds: number;
  fps: number;
  bitrateMbps: number;
  lastVideoBlob: Blob | null;
  lastVideoUrl: string | null;
}
