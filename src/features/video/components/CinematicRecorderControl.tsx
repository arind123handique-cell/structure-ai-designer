import React, { useRef, useState, useEffect } from 'react';
import { useVideoStore } from '../videoStore';
import { cyberAudio } from '../audio/cyberAudioSynthesizer';
import { Video, Square, Download, Check, AlertCircle } from 'lucide-react';

interface CinematicRecorderControlProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const CinematicRecorderControl: React.FC<CinematicRecorderControlProps> = ({
  canvasRef,
}) => {
  const { recordingState, setRecordingState } = useVideoStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      chunksRef.current = [];
      const stream = canvas.captureStream(60); // 60 FPS capture

      // Select supported mime type
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 20_000_000, // 20 Mbps high quality
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setRecordingState({
          isRecording: false,
          lastVideoBlob: blob,
          lastVideoUrl: url,
        });
        cyberAudio.playCalculationComplete();
      };

      recorder.start(500); // 500ms time slice
      mediaRecorderRef.current = recorder;

      setRecordingState({ isRecording: true, elapsedSeconds: 0 });
      cyberAudio.playVideoStart();
      setDownloadUrl(null);

      // Start elapsed timer
      let seconds = 0;
      timerIntervalRef.current = window.setInterval(() => {
        seconds += 1;
        setRecordingState({ elapsedSeconds: seconds });
      }, 1000);
    } catch (e) {
      console.error('Failed to initiate canvas video recording', e);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      {!recordingState.isRecording ? (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-cyber-dark/80 hover:bg-cyber-surface border border-cyber-cyan/40 hover:border-cyber-cyan text-cyber-cyan rounded transition-colors shadow-neon-cyan/20"
          title="Record 60FPS Cinematic Video of 3D Viewport"
        >
          <Video className="w-3.5 h-3.5 text-cyber-cyan" />
          <span>REC 60FPS</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-2 px-3 py-1 bg-cyber-crimson/20 border border-cyber-crimson text-cyber-crimson rounded animate-pulse shadow-[0_0_15px_rgba(255,0,85,0.4)]"
          title="Stop Recording"
        >
          <Square className="w-3.5 h-3.5 fill-cyber-crimson" />
          <span>REC {formatTime(recordingState.elapsedSeconds)}</span>
        </button>
      )}

      {downloadUrl && (
        <a
          href={downloadUrl}
          download={`StructureAI_Cinematic_${Date.now()}.webm`}
          className="flex items-center gap-1 px-2.5 py-1 bg-cyber-matrix/20 hover:bg-cyber-matrix/30 border border-cyber-matrix text-cyber-matrix rounded transition-colors shadow-neon-matrix/30 animate-bounce"
          title="Download Exported 4K/60FPS Video"
        >
          <Download className="w-3.5 h-3.5" />
          <span>DOWNLOAD VIDEO</span>
        </a>
      )}
    </div>
  );
};
