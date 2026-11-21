import React, { useEffect, useRef, useState } from 'react';
import { Flame, Pause, Play, SlidersHorizontal, X } from 'lucide-react';
import { StageInfo } from '../types/rebuild';

interface RunnerCanvasProps {
  score: number;
  stageInfo: StageInfo;
  streakDays: number;
  debugScore: number | null;
  isLoggedIn: boolean;
  showTestControls: boolean;
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

const VIDEO_LIST: { key: VideoKey; file: string }[] = [
  { key: 'stage0_crawl', file: 'videos/stage0_crawl.mp4' },
  { key: 'stage1_walk', file: 'videos/stage1_walk.mp4' },
  { key: 'stage4_jog', file: 'videos/stage4_jog.mp4' },
  { key: 'stage7_run', file: 'videos/stage7_run.mp4' },
  { key: 'stage9_cr7', file: 'videos/stage9_cr7.mp4' },
  { key: 'stage10_goku', file: 'videos/stage10_goku.mp4' },
];

interface StageVisualConfig {
  key: VideoKey;
  playbackRate: number;
  roadDurationSec: number; // CSS translateX loop duration (smaller = faster)
  accentColor: string;
  bgGlow: string;
  showSpeedLines: boolean;
}

function getStageVisualConfig(stage: number): StageVisualConfig {
  if (stage === 0) {
    return {
      key: 'stage0_crawl',
      playbackRate: 0.75,
      roadDurationSec: 1.4,
      accentColor: '#FF3B30',
      bgGlow: 'radial-gradient(circle at 50% 52%, rgba(255, 59, 48, 0.52) 0%, rgba(255, 59, 48, 0.16) 36%, #111214 70%)',
      showSpeedLines: false,
    };
  }
  if (stage <= 3) {
    return {
      key: 'stage1_walk',
      playbackRate: 0.9,
      roadDurationSec: 0.9,
      accentColor: '#99CC00',
      bgGlow: 'radial-gradient(circle at 50% 52%, rgba(153, 204, 0, 0.34) 0%, rgba(153, 204, 0, 0.10) 36%, #111214 70%)',
      showSpeedLines: false,
    };
  }
  if (stage <= 6) {
    // Stage 4-6 (Jogging): standard road speed (0.45s) & #CCFF00 glow
    return {
      key: 'stage4_jog',
      playbackRate: 0.85,
      roadDurationSec: 0.45,
      accentColor: '#CCFF00',
      bgGlow: 'radial-gradient(circle at 50% 52%, rgba(204, 255, 0, 0.52) 0%, rgba(204, 255, 0, 0.14) 38%, #111214 72%)',
      showSpeedLines: false,
    };
  }
  if (stage <= 8) {
    // Stage 7-8 (Full Sprint): 2.5x faster road scroll (0.45 / 2.5 = 0.18s), #00F0FF x #CCFF00 gradient, CSS speed lines
    return {
      key: 'stage7_run',
      playbackRate: 1.45,
      roadDurationSec: 0.18,
      accentColor: '#00F0FF',
      bgGlow: 'radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.62) 0%, rgba(204, 255, 0, 0.28) 38%, #111214 74%)',
      showSpeedLines: true,
    };
  }
  if (stage === 9) {
    // Stage 9 (CR7): Gold x Volt spotlight
    return {
      key: 'stage9_cr7',
      playbackRate: 1.65,
      roadDurationSec: 0.14,
      accentColor: '#FFD60A',
      bgGlow: 'radial-gradient(circle at 50% 48%, rgba(255, 214, 10, 0.68) 0%, rgba(204, 255, 0, 0.30) 40%, #111214 75%)',
      showSpeedLines: true,
    };
  }
  // Stage 10 (GOKU): Aura Blue x White
  return {
    key: 'stage10_goku',
    playbackRate: 1.85,
    roadDurationSec: 0.11,
    accentColor: '#00D4FF',
    bgGlow: 'radial-gradient(circle at 50% 48%, rgba(255, 255, 255, 0.72) 0%, rgba(0, 212, 255, 0.48) 34%, rgba(0, 212, 255, 0.14) 56%, #111214 78%)',
    showSpeedLines: true,
  };
}

const CSS_SPEED_LINES = [
  { top: '16%', width: '92px', delay: '0s', dur: '0.42s' },
  { top: '24%', width: '130px', delay: '0.12s', dur: '0.36s' },
  { top: '33%', width: '78px', delay: '0.24s', dur: '0.44s' },
  { top: '42%', width: '145px', delay: '0.06s', dur: '0.34s' },
  { top: '51%', width: '105px', delay: '0.18s', dur: '0.40s' },
  { top: '60%', width: '120px', delay: '0.30s', dur: '0.38s' },
  { top: '68%', width: '88px', delay: '0.10s', dur: '0.45s' },
  { top: '76%', width: '112px', delay: '0.22s', dur: '0.35s' },
];

export const RunnerCanvas: React.FC<RunnerCanvasProps> = ({
  score,
  stageInfo,
  streakDays,
  debugScore,
  isLoggedIn,
  showTestControls,
  onDebugScoreChange,
}) => {
  const [showDebug, setShowDebug] = useState(showTestControls);
  const [autoPlay, setAutoPlay] = useState(false);
  const videoRefs = useRef<Partial<Record<VideoKey, HTMLVideoElement | null>>>({});

  const stage = stageInfo.stage;
  const activeCfg = getStageVisualConfig(stage);
  const base = import.meta.env.BASE_URL || './';

  useEffect(() => {
    if (!showTestControls) {
      setAutoPlay(false);
      setShowDebug(false);
    } else {
      setShowDebug(true);
    }
  }, [showTestControls]);

  useEffect(() => {
    if (!autoPlay) return;
    let idx = stageInfo.stage;
    const id = window.setInterval(() => {
      idx = (idx + 1) % 11;
      onDebugScoreChange(STAGE_SAMPLE_SCORES[idx]);
    }, 2400);
    return () => window.clearInterval(id);
  }, [autoPlay, onDebugScoreChange]);

  useEffect(() => {
    const ensurePlay = () => {
      const vid = videoRefs.current[activeCfg.key];
      if (!vid) return;
      vid.muted = true;
      vid.playbackRate = activeCfg.playbackRate;
      if (vid.paused) {
        vid.play().catch(() => {});
      }
    };

    ensurePlay();
    const rafId = window.requestAnimationFrame(ensurePlay);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        ensurePlay();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ensurePlay);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ensurePlay);
    };
  }, [activeCfg.key, activeCfg.playbackRate]);

  return (
    <section className="relative w-full h-[38vh] min-h-[275px] max-h-[345px] bg-[#111214] border-b border-[#2C2F36] overflow-hidden select-none">
      {/* Stage-Specific Radial Neon Backdrop (shines through white areas via mix-blend-mode: multiply) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300"
        style={{ background: activeCfg.bgGlow }}
      />

      {/* GPU-Accelerated CSS Speed Lines (Stage 7-10) */}
      {activeCfg.showSpeedLines && (
        <div
          className="absolute inset-x-0 top-3 pointer-events-none overflow-hidden"
          style={{ bottom: showDebug ? '76px' : '24px' }}
        >
          {CSS_SPEED_LINES.map((line, i) => (
            <span
              key={i}
              className="absolute right-0 h-[1.5px] rounded-full"
              style={{
                top: line.top,
                width: line.width,
                background: `linear-gradient(to left, ${activeCfg.accentColor}, transparent)`,
                animation: `rebuild-speed-line ${line.dur} linear ${line.delay} infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Stacked <video> elements: pure black silhouette + transparent white via mix-blend-mode: multiply */}
      <div
        className="absolute inset-x-0 top-3 flex items-center justify-center pointer-events-none"
        style={{ bottom: showDebug ? '76px' : '24px' }}
      >
        <div className="relative w-full h-full max-w-md flex items-center justify-center">
          {VIDEO_LIST.map((v) => {
            const isActive = v.key === activeCfg.key;
            return (
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
                onLoadedData={(e) => {
                  const vid = e.currentTarget;
                  vid.muted = true;
                  vid.playbackRate = activeCfg.playbackRate;
                  if (isActive && vid.paused) {
                    vid.play().catch(() => {});
                  }
                }}
                onCanPlay={(e) => {
                  const vid = e.currentTarget;
                  if (isActive && vid.paused) {
                    vid.muted = true;
                    vid.playbackRate = activeCfg.playbackRate;
                    vid.play().catch(() => {});
                  }
                }}
                onTimeUpdate={(e) => {
                  const vid = e.currentTarget;
                  if (vid.duration && vid.duration - vid.currentTime < 0.08) {
                    vid.currentTime = 0.01;
                    vid.play().catch(() => {});
                  }
                }}
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-150 ${
                  isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                style={{
                  mixBlendMode: 'multiply',
                }}
              />
            );
          })}
        </div>

        {/* GPU-Accelerated CSS Scrolling Ground Dash Line */}
        <div className="absolute bottom-0 inset-x-0 h-[3px] overflow-hidden">
          <div
            className="h-full"
            style={{
              width: 'calc(100% + 96px)',
              backgroundImage: `repeating-linear-gradient(to right, ${activeCfg.accentColor} 0 28px, transparent 28px 48px)`,
              opacity: stage <= 3 ? 0.55 : 0.88,
              animation: `rebuild-road-scroll ${activeCfg.roadDurationSec}s linear infinite`,
            }}
          />
        </div>
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

      {/* Bottom Bar: Stage 0-10 Showcase & Debug Slider (Visible when not logged in or Dev Test Mode is ON) */}
      {showTestControls && (
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
                    {!isLoggedIn ? 'DEMO' : 'TEST'}: {debugScore ?? score}pt (ST.{stageInfo.stage})
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
      )}
    </section>
  );
};
