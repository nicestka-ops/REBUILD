import React, { useEffect, useRef, useState } from 'react';
import { Flame, Pause, Play, SlidersHorizontal, X } from 'lucide-react';
import { StageInfo } from '../types/rebuild';

interface RunnerCanvasProps {
  score: number;
  stageInfo: StageInfo;
  streakDays: number;
  debugScore: number | null;
  onDebugScoreChange: (val: number | null) => void;
}

const STAGE_SAMPLE_SCORES = [5, 15, 25, 35, 45, 55, 65, 75, 85, 92, 98];

type VideoKey =
  | 'stage0_crawl'
  | 'stage1_walk'
  | 'stage4_jog'
  | 'stage7_run'
  | 'stage9_cr7'
  | 'stage10_goku';

interface VideoStageConfig {
  key: VideoKey;
  url: string;
  playbackRate: number;
  scrollSpeed: number; // Ground & speed line velocity (px/s)
  speedLineCount: number;
  hasSparks: boolean;
  hasAfterimage: boolean;
  roadColor: string;
  dropShadow: string;
  bgGlow: string;
}

const VIDEO_KEYS: { key: VideoKey; file: string }[] = [
  { key: 'stage0_crawl', file: 'videos/stage0_crawl.mp4' },
  { key: 'stage1_walk', file: 'videos/stage1_walk.mp4' },
  { key: 'stage4_jog', file: 'videos/stage4_jog.mp4' },
  { key: 'stage7_run', file: 'videos/stage7_run.mp4' },
  { key: 'stage9_cr7', file: 'videos/stage9_cr7.mp4' },
  { key: 'stage10_goku', file: 'videos/stage10_goku.mp4' },
];

function getVideoConfigForStage(stage: number): VideoStageConfig {
  const base = import.meta.env.BASE_URL || './';
  if (stage === 0) {
    return {
      key: 'stage0_crawl',
      url: `${base}videos/stage0_crawl.mp4`,
      playbackRate: 0.7,
      scrollSpeed: 55,
      speedLineCount: 0,
      hasSparks: false,
      hasAfterimage: false,
      roadColor: '#FF3B30',
      dropShadow: 'drop-shadow(0 0 6px #FF3B30) drop-shadow(0 0 12px #FF3B30)',
      bgGlow: 'radial-gradient(circle at 50% 48%, rgba(255, 59, 48, 0.16) 0%, rgba(17, 18, 20, 0) 58%)',
    };
  }
  if (stage <= 3) {
    return {
      key: 'stage1_walk',
      url: `${base}videos/stage1_walk.mp4`,
      playbackRate: 0.9,
      scrollSpeed: 115 + (stage - 1) * 25,
      speedLineCount: 0,
      hasSparks: false,
      hasAfterimage: false,
      roadColor: '#99CC00',
      dropShadow: 'drop-shadow(0 0 5px #99CC00) drop-shadow(0 0 10px rgba(153, 204, 0, 0.65))',
      bgGlow: 'none',
    };
  }
  if (stage <= 6) {
    // Stage 4-6 (Jogging): playbackRate 0.85, gentle volt green glow, 3 speed lines, standard road speed (220)
    return {
      key: 'stage4_jog',
      url: `${base}videos/stage4_jog.mp4`,
      playbackRate: 0.85,
      scrollSpeed: 220,
      speedLineCount: 3,
      hasSparks: false,
      hasAfterimage: false,
      roadColor: '#CCFF00',
      dropShadow: 'drop-shadow(0 0 6px #CCFF00) drop-shadow(0 0 12px #CCFF00)',
      bgGlow: 'radial-gradient(circle at 50% 48%, rgba(204, 255, 0, 0.08) 0%, rgba(17, 18, 20, 0) 58%)',
    };
  }
  if (stage <= 8) {
    // Stage 7-8 (Full Sprint): playbackRate 1.45, 2.5x road speed (550), 15 speed lines, sparks, 1 afterimage, cyan+volt dual glow
    return {
      key: 'stage7_run',
      url: `${base}videos/stage7_run.mp4`,
      playbackRate: 1.45,
      scrollSpeed: 220 * 2.5,
      speedLineCount: 15,
      hasSparks: true,
      hasAfterimage: true,
      roadColor: '#00F0FF',
      dropShadow: 'drop-shadow(0 0 6px #00F0FF) drop-shadow(0 0 14px #CCFF00)',
      bgGlow:
        'radial-gradient(circle at 50% 48%, rgba(0, 240, 255, 0.16) 0%, rgba(204, 255, 0, 0.10) 35%, rgba(17, 18, 20, 0) 64%)',
    };
  }
  if (stage === 9) {
    return {
      key: 'stage9_cr7',
      url: `${base}videos/stage9_cr7.mp4`,
      playbackRate: 1.65,
      scrollSpeed: 740,
      speedLineCount: 20,
      hasSparks: true,
      hasAfterimage: true,
      roadColor: '#FFD60A',
      dropShadow: 'drop-shadow(0 0 7px #FFD60A) drop-shadow(0 0 15px #CCFF00)',
      bgGlow:
        'radial-gradient(circle at 50% 46%, rgba(255, 214, 10, 0.18) 0%, rgba(204, 255, 0, 0.10) 38%, rgba(17, 18, 20, 0) 66%)',
    };
  }
  return {
    key: 'stage10_goku',
    url: `${base}videos/stage10_goku.mp4`,
    playbackRate: 1.85,
    scrollSpeed: 980,
    speedLineCount: 24,
    hasSparks: true,
    hasAfterimage: true,
    roadColor: '#00D4FF',
    dropShadow: 'drop-shadow(0 0 6px #FFFFFF) drop-shadow(0 0 15px #00D4FF)',
    bgGlow:
      'radial-gradient(circle at 50% 46%, rgba(0, 212, 255, 0.25) 0%, rgba(255, 255, 255, 0.08) 38%, rgba(17, 18, 20, 0) 66%)',
  };
}

interface BgSpeedLine {
  x: number;
  yFrac: number;
  len: number;
  alpha: number;
  thick: number;
}

interface KickSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export const RunnerCanvas: React.FC<RunnerCanvasProps> = ({
  score,
  stageInfo,
  streakDays,
  debugScore,
  onDebugScoreChange,
}) => {
  const [showDebug, setShowDebug] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const runnerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRefs = useRef<Partial<Record<VideoKey, HTMLVideoElement | null>>>({});

  const stage = stageInfo.stage;
  const videoCfg = getVideoConfigForStage(stage);

  useEffect(() => {
    if (!autoPlay) return;
    let idx = stageInfo.stage;
    const id = window.setInterval(() => {
      idx = (idx + 1) % 11;
      onDebugScoreChange(STAGE_SAMPLE_SCORES[idx]);
    }, 2400);
    return () => window.clearInterval(id);
  }, [autoPlay, onDebugScoreChange]);

  // Keep active video playing at the stage's exact playbackRate
  useEffect(() => {
    const activeVid = videoRefs.current[videoCfg.key];
    if (activeVid) {
      activeVid.playbackRate = videoCfg.playbackRate;
      if (activeVid.paused) {
        activeVid.play().catch(() => {
          // Autoplay handled by muted + playsInline
        });
      }
    }
  }, [videoCfg.key, videoCfg.playbackRate]);

  const stageRef = useRef(stage);
  const showDebugRef = useRef(showDebug);
  stageRef.current = stage;
  showDebugRef.current = showDebug;

  // Unified 60fps requestAnimationFrame loop:
  // 1. Chroma-keys white background (RGB >= 200 -> alpha 0) from active <video> onto runnerCanvas
  // 2. Draws semi-transparent afterimage for Stage 7-10
  // 3. Renders scrolling dashed road, perspective grid, speed lines, kick sparks, and Stage 10 pulse ripples
  useEffect(() => {
    const procCanvas = document.createElement('canvas');
    procCanvas.width = 320;
    procCanvas.height = 180;
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

    const prevCanvas = document.createElement('canvas');
    prevCanvas.width = 320;
    prevCanvas.height = 180;
    const prevCtx = prevCanvas.getContext('2d');

    let animId = 0;
    let lastTime = performance.now();
    let roadOffset = 0;
    let sparkTimer = 0;
    let hasPrevFrame = false;

    const speedLines: BgSpeedLine[] = Array.from({ length: 24 }, (_, i) => ({
      x: Math.random() * 640,
      yFrac: 0.1 + ((i * 19) % 78) / 100,
      len: 55 + Math.random() * 115,
      alpha: 0.25 + Math.random() * 0.55,
      thick: i % 3 === 0 ? 1.8 : 1.0,
    }));

    const sparks: KickSpark[] = [];

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const st = stageRef.current;
      const cfg = getVideoConfigForStage(st);

      roadOffset = (roadOffset + cfg.scrollSpeed * dt) % 80;
      sparkTimer += dt;

      // 1. Video -> Chroma-key white removal -> runnerCanvas
      const vid = videoRefs.current[cfg.key];
      const runnerCanvas = runnerCanvasRef.current;
      if (vid && vid.readyState >= 2 && runnerCanvas && procCtx) {
        if (vid.playbackRate !== cfg.playbackRate) {
          vid.playbackRate = cfg.playbackRate;
        }
        if (vid.paused) {
          vid.play().catch(() => {});
        }

        const vw = vid.videoWidth || 320;
        const vh = vid.videoHeight || 180;
        const targetW = 320;
        const targetH = Math.max(120, Math.round((vh / vw) * targetW));

        if (procCanvas.width !== targetW || procCanvas.height !== targetH) {
          procCanvas.width = targetW;
          procCanvas.height = targetH;
          prevCanvas.width = targetW;
          prevCanvas.height = targetH;
          hasPrevFrame = false;
        }

        if (runnerCanvas.width !== targetW || runnerCanvas.height !== targetH) {
          runnerCanvas.width = targetW;
          runnerCanvas.height = targetH;
        }

        // Snapshot previous processed frame for Stage 7-10 afterimage
        if (cfg.hasAfterimage && prevCtx && hasPrevFrame) {
          prevCtx.clearRect(0, 0, targetW, targetH);
          prevCtx.drawImage(procCanvas, 0, 0);
        }

        procCtx.clearRect(0, 0, targetW, targetH);
        procCtx.drawImage(vid, 0, 0, targetW, targetH);

        const imgData = procCtx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r >= 200 && g >= 200 && b >= 200) {
            data[i + 3] = 0;
          } else {
            const avg = (r + g + b) / 3;
            const alpha = avg <= 100 ? 255 : Math.round(((200 - avg) / 100) * 255);
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = Math.max(0, Math.min(255, alpha));
          }
        }
        procCtx.putImageData(imgData, 0, 0);
        hasPrevFrame = true;

        const rCtx = runnerCanvas.getContext('2d');
        if (rCtx) {
          rCtx.clearRect(0, 0, targetW, targetH);
          if (cfg.hasAfterimage && prevCtx) {
            rCtx.save();
            rCtx.globalAlpha = 0.28;
            rCtx.drawImage(prevCanvas, -16, 0);
            rCtx.restore();
          }
          rCtx.drawImage(procCanvas, 0, 0);
        }
      }

      // 2. Background road, speed lines, sparks & Stage 10 pulse ripples
      const bgCanvas = bgCanvasRef.current;
      if (bgCanvas) {
        const ctx = bgCanvas.getContext('2d');
        const rect = bgCanvas.getBoundingClientRect();
        if (ctx && rect.width > 0 && rect.height > 0) {
          const dpr = window.devicePixelRatio || 1;
          const tw = Math.round(rect.width * dpr);
          const th = Math.round(rect.height * dpr);
          if (bgCanvas.width !== tw || bgCanvas.height !== th) {
            bgCanvas.width = tw;
            bgCanvas.height = th;
          }

          const w = rect.width;
          const h = rect.height;
          const bottomPad = showDebugRef.current ? 82 : 36;
          const groundY = h - bottomPad;

          // Spawn kick-off sparks for Stage 7-10
          if (cfg.hasSparks && sparkTimer >= 0.14) {
            sparkTimer = 0;
            const count = st < 9 ? 5 : 8;
            for (let i = 0; i < count; i++) {
              sparks.push({
                x: w * 0.49 - Math.random() * 16,
                y: groundY - 2 - Math.random() * 4,
                vx: -(cfg.scrollSpeed * 0.45 + 75 + Math.random() * 140),
                vy: -(24 + Math.random() * 75),
                life: 0,
                maxLife: 0.24 + Math.random() * 0.26,
                size: 1.6 + Math.random() * 2.2,
              });
            }
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, w, h);

          // Stage 10 (GOKU Mode): Aura Blue pulsing ripple rings
          if (st === 10) {
            for (let rIdx = 0; rIdx < 2; rIdx++) {
              const pulse = (now * 0.0018 + rIdx * 0.5) % 1;
              const radius = 38 + pulse * 85;
              ctx.save();
              ctx.globalAlpha = (1 - pulse) * 0.55;
              ctx.strokeStyle = rIdx === 0 ? '#00D4FF' : '#FFFFFF';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(w * 0.5, groundY - 62, radius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }

          // Speed lines
          for (let i = 0; i < cfg.speedLineCount; i++) {
            const line = speedLines[i];
            line.x -= cfg.scrollSpeed * 1.45 * dt;
            if (line.x + line.len < 0) {
              line.x = w + Math.random() * 60;
              line.yFrac = 0.08 + Math.random() * 0.78;
              line.len = (st >= 7 ? 75 : 38) + Math.random() * 110;
            }
            const ly = line.yFrac * groundY;
            const grad = ctx.createLinearGradient(line.x + line.len, ly, line.x, ly);
            grad.addColorStop(0, cfg.roadColor);
            grad.addColorStop(1, 'rgba(17, 18, 20, 0)');

            ctx.save();
            ctx.globalAlpha = st >= 7 ? line.alpha * 0.9 : line.alpha * 0.45;
            ctx.strokeStyle = grad;
            ctx.lineWidth = line.thick;
            ctx.beginPath();
            ctx.moveTo(line.x + line.len, ly);
            ctx.lineTo(line.x, ly);
            ctx.stroke();
            ctx.restore();
          }

          // Neon dashed road & perspective grid
          ctx.save();
          ctx.strokeStyle = cfg.roadColor;
          ctx.globalAlpha = st <= 3 ? 0.55 : 0.85;
          ctx.lineWidth = st >= 7 ? 2.4 : 2;
          ctx.setLineDash([28, 16]);
          ctx.lineDashOffset = roadOffset;
          ctx.beginPath();
          ctx.moveTo(0, groundY);
          ctx.lineTo(w, groundY);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = cfg.roadColor;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([14, 26]);
          ctx.lineDashOffset = roadOffset * 1.35;
          ctx.beginPath();
          ctx.moveTo(0, groundY + 11);
          ctx.lineTo(w, groundY + 11);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = cfg.roadColor;
          ctx.globalAlpha = st <= 3 ? 0.14 : 0.24;
          ctx.lineWidth = 1;
          const vanishX = w * 0.5;
          const tickShift = roadOffset % 80;
          for (let x = -tickShift; x < w + 80; x += 80) {
            const botX = vanishX + (x - vanishX) * 1.65;
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(botX, groundY + 26);
            ctx.stroke();
          }
          ctx.restore();

          // Kick-off spark particles
          for (let i = sparks.length - 1; i >= 0; i--) {
            const sp = sparks[i];
            sp.life += dt;
            if (sp.life >= sp.maxLife) {
              sparks.splice(i, 1);
              continue;
            }
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.vy += 180 * dt;

            ctx.save();
            ctx.globalAlpha = 1 - sp.life / sp.maxLife;
            ctx.fillStyle = cfg.roadColor;
            ctx.shadowColor = cfg.roadColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const base = import.meta.env.BASE_URL || './';

  return (
    <section className="relative w-full h-[38vh] min-h-[275px] max-h-[345px] bg-[#111214] border-b border-[#2C2F36] overflow-hidden select-none">
      {/* Hidden preloaded looping MP4 videos (switched seamlessly without flicker) */}
      <div className="hidden" aria-hidden="true">
        {VIDEO_KEYS.map((v) => (
          <video
            key={v.key}
            ref={(el) => {
              videoRefs.current[v.key] = el;
            }}
            src={`${base}${v.file}`}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
          />
        ))}
      </div>

      {/* Stage-Specific Background Lighting */}
      {videoCfg.bgGlow !== 'none' && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ background: videoCfg.bgGlow }}
        />
      )}

      {/* Scrolling Dash Road, Speed Lines & Spark Particles Canvas */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none block" />

      {/* Chroma-Keyed Transparent Video Silhouette Canvas with Stage Neon Drop-Shadow */}
      <div
        className="absolute inset-x-0 top-3 flex items-end justify-center pointer-events-none overflow-visible"
        style={{ bottom: showDebug ? '76px' : '30px' }}
      >
        <canvas
          ref={runnerCanvasRef}
          className="h-full max-w-full object-contain"
          style={{
            filter: videoCfg.dropShadow,
          }}
        />
      </div>

      {/* Top-Left: Stage & Score HUD */}
      <div className="absolute top-3.5 left-4 pointer-events-none flex flex-col gap-1 z-10">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-[11px] font-extrabold tracking-widest uppercase rounded ${
              stageInfo.isDanger
                ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/50'
                : 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/40'
            }`}
          >
            {stageInfo.code}
          </span>
          {debugScore !== null && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/10 text-white rounded">
              PREVIEW
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-mono-athletic text-4xl font-black tracking-tight ${
              stageInfo.isDanger ? 'text-[#FF3B30] red-glow-text' : 'text-white'
            }`}
          >
            {score}
          </span>
          <span className="text-xs font-semibold text-[#8E929B]">/ 100 PT</span>
        </div>
        <p className="text-xs font-semibold tracking-wide text-[#8E929B]">
          {stageInfo.label}
        </p>
      </div>

      {/* Top-Right: Streak Days */}
      <div className="absolute top-3.5 right-4 pointer-events-none z-10">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C1E22]/90 border border-[#2C2F36] backdrop-blur-sm">
          <Flame className="w-4 h-4 text-[#CCFF00] fill-[#CCFF00]/20" />
          <span className="font-mono-athletic text-sm font-bold text-white">{streakDays}</span>
          <span className="text-[11px] font-semibold text-[#8E929B]">DAYS</span>
        </div>
      </div>

      {/* Bottom Bar: Stage 0-10 Showcase & Debug Slider */}
      <div className="absolute bottom-2.5 right-3 left-3 z-20 flex justify-end">
        {!showDebug ? (
          <button
            type="button"
            onClick={() => setShowDebug(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1C1E22]/90 border border-[#2C2F36] text-[11px] font-semibold text-[#8E929B] hover:text-[#CCFF00] hover:border-[#CCFF00]/50 transition-colors cursor-pointer"
            title="ステージ動作確認スライダー"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>STAGE TEST</span>
          </button>
        ) : (
          <div className="w-full max-w-xl flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-[#1C1E22]/95 border border-[#CCFF00]/40 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#CCFF00] whitespace-nowrap">
                  TEST: {debugScore ?? score}pt (ST.{stageInfo.stage})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!autoPlay && debugScore === null) {
                      onDebugScoreChange(STAGE_SAMPLE_SCORES[0]);
                    }
                    setAutoPlay((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer ${
                    autoPlay
                      ? 'bg-[#CCFF00] text-black'
                      : 'bg-[#2C2F36] text-white hover:bg-[#3A3E47]'
                  }`}
                >
                  {autoPlay ? <Pause className="w-2.5 h-2.5 fill-black" /> : <Play className="w-2.5 h-2.5 fill-white" />}
                  <span>{autoPlay ? 'STOP' : 'AUTO 0→10'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={debugScore ?? score}
                  onChange={(e) => {
                    setAutoPlay(false);
                    onDebugScoreChange(Number(e.target.value));
                  }}
                  className="volt-slider w-24 sm:w-32"
                />
                {debugScore !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoPlay(false);
                      onDebugScoreChange(null);
                    }}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#2C2F36] text-white hover:bg-[#3A3E47] cursor-pointer"
                  >
                    実値
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAutoPlay(false);
                    onDebugScoreChange(null);
                    setShowDebug(false);
                  }}
                  className="text-[#8E929B] hover:text-white cursor-pointer"
                  aria-label="Close debug slider"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-11 gap-1">
              {STAGE_SAMPLE_SCORES.map((sampleScore, idx) => {
                const active = stageInfo.stage === idx && debugScore !== null;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAutoPlay(false);
                      onDebugScoreChange(sampleScore);
                    }}
                    className={`py-1 rounded text-[10px] font-mono-athletic font-extrabold transition-colors cursor-pointer ${
                      active
                        ? idx === 0
                          ? 'bg-[#FF3B30] text-white'
                          : 'bg-[#CCFF00] text-black'
                        : 'bg-[#111214] text-[#8E929B] hover:text-white border border-[#2C2F36]'
                    }`}
                  >
                    {idx}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
