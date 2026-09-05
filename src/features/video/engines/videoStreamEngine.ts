import * as THREE from 'three';

/**
 * VideoStreamEngine
 *
 * Manages video playback, WebRTC/camera streams, local files, and procedural
 * simulated drone inspection feeds. Generates Three.js VideoTextures for WebGL integration.
 */
export class VideoStreamEngine {
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private animFrameId: number = 0;
  private videoTexture: THREE.VideoTexture | THREE.CanvasTexture | null = null;

  constructor() {
    this.initVideoElement();
  }

  private initVideoElement() {
    if (typeof document === 'undefined') return;
    this.videoEl = document.createElement('video');
    this.videoEl.autoplay = true;
    this.videoEl.muted = true;
    this.videoEl.loop = true;
    this.videoEl.playsInline = true;
    this.videoEl.crossOrigin = 'anonymous';
  }

  /**
   * Generates a procedural high-tech simulated drone inspection feed
   * with moving construction grid, scanning laser lines, and telemetry.
   */
  public startSimulatedDroneFeed(): HTMLCanvasElement {
    if (!this.canvasEl && typeof document !== 'undefined') {
      this.canvasEl = document.createElement('canvas');
      this.canvasEl.width = 1280;
      this.canvasEl.height = 720;
      this.canvasCtx = this.canvasEl.getContext('2d');
    }

    const canvas = this.canvasEl!;
    const ctx = this.canvasCtx!;
    let time = 0;

    const renderDroneFrame = () => {
      time += 0.02;
      const w = canvas.width;
      const h = canvas.height;

      // Dark site background with subtle dusk gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#040814');
      bgGrad.addColorStop(0.5, '#071026');
      bgGrad.addColorStop(1, '#02050E');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Perspective ground grid (concrete slab under construction)
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 1;

      const horizon = h * 0.45;
      for (let i = 0; i <= 20; i++) {
        const x = (w / 20) * i;
        ctx.beginPath();
        ctx.moveTo(w / 2, horizon);
        ctx.lineTo((x - w / 2) * 3 + w / 2, h);
        ctx.stroke();
      }

      for (let y = horizon; y < h; y += Math.max(8, (y - horizon) * 0.35)) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Simulated concrete column pylons & rebar cages
      const columns = [
        { x: w * 0.25, base: h * 0.85, height: h * 0.45 },
        { x: w * 0.50, base: h * 0.90, height: h * 0.55 },
        { x: w * 0.75, base: h * 0.85, height: h * 0.45 },
      ];

      columns.forEach((col, idx) => {
        // Concrete column outline
        ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1.5;
        const colW = 55 + (col.base - horizon) * 0.08;
        ctx.fillRect(col.x - colW / 2, col.base - col.height, colW, col.height);
        ctx.strokeRect(col.x - colW / 2, col.base - col.height, colW, col.height);

        // Vertical glowing rebar cages protruding from top
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        for (let r = -colW / 2 + 6; r <= colW / 2 - 6; r += 10) {
          ctx.beginPath();
          ctx.moveTo(col.x + r, col.base - col.height);
          ctx.lineTo(col.x + r, col.base - col.height - 35);
          ctx.stroke();
        }

        // Horizontal confining stirrups
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.7)';
        ctx.lineWidth = 1;
        for (let s = col.base - col.height - 30; s <= col.base - col.height; s += 8) {
          ctx.beginPath();
          ctx.moveTo(col.x - colW / 2 + 4, s);
          ctx.lineTo(col.x + colW / 2 - 4, s);
          ctx.stroke();
        }

        // Column Tag Readout
        ctx.fillStyle = '#00f0ff';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`COL C-0${idx + 1} // ELEV: +12.5m`, col.x - colW / 2, col.base - col.height - 45);
      });

      // Animated Horizontal Scanning Laser (Defect Inspection Sweep)
      const laserY = horizon + Math.sin(time * 1.5) * (h - horizon) * 0.45 + (h - horizon) * 0.45;
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.75)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, laserY);
      ctx.lineTo(w, laserY);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Drone Camera Crosshair & HUD Ring
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 45, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w / 2 - 60, h / 2);
      ctx.lineTo(w / 2 - 25, h / 2);
      ctx.moveTo(w / 2 + 25, h / 2);
      ctx.lineTo(w / 2 + 60, h / 2);
      ctx.moveTo(w / 2, h / 2 - 60);
      ctx.lineTo(w / 2, h / 2 - 25);
      ctx.moveTo(w / 2, h / 2 + 25);
      ctx.lineTo(w / 2, h / 2 + 60);
      ctx.stroke();

      this.animFrameId = requestAnimationFrame(renderDroneFrame);
    };

    renderDroneFrame();
    return canvas;
  }

  /**
   * Ingests local video file or network stream
   */
  public async loadVideoSource(source: string | MediaStream): Promise<HTMLVideoElement> {
    this.stopSimulatedFeed();
    if (!this.videoEl) this.initVideoElement();
    const v = this.videoEl!;

    if (typeof source === 'string') {
      v.src = source;
    } else {
      v.srcObject = source;
    }

    await v.play().catch(() => {});
    return v;
  }

  public stopSimulatedFeed() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  public dispose() {
    this.stopSimulatedFeed();
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
      this.videoEl.srcObject = null;
    }
    this.videoTexture?.dispose();
    this.videoTexture = null;
  }
}

export const videoStreamEngine = new VideoStreamEngine();
