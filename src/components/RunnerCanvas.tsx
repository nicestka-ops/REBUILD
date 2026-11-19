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

type SpriteSheetKey =
  | 'stage0_crawl_16'
  | 'stage1_walk_16'
  | 'stage4_jog_16'
  | 'stage7_run_16'
  | 'stage9_cr7_16'
  | 'stage10_goku_16';

interface SheetConfig {
  key: SpriteSheetKey;
  url: string;
  cycleSeconds: number; // Full 16-frame cycle duration
  scrollSpeed: number; // Road & speed line velocity (px/s)
  heightPct: number;
}

function getSheetConfigForStage(stage: number): SheetConfig {
  const base = import.meta.env.BASE_URL || './';
  if (stage === 0) {
    return {
      key: 'stage0_crawl_16',
      url: `${base}sprites/stage0_crawl_16.png`,
      cycleSeconds: 1.8,
      scrollSpeed: 55,
      heightPct: 58,
    };
  }
  if (stage <= 3) {
    return {
      key: 'stage1_walk_16',
      url: `${base}sprites/stage1_walk_16.png`,
      cycleSeconds: 1.2,
      scrollSpeed: 120 + (stage - 1) * 35,
      heightPct: 76,
    };
  }
  if (stage <= 6) {
    return {
      key: 'stage4_jog_16',
      url: `${base}sprites/stage4_jog_16.png`,
      cycleSeconds: 0.85,
      scrollSpeed: 240 + (stage - 4) * 55,
      heightPct: 78,
    };
  }
  if (stage <= 8) {
    return {
      key: 'stage7_run_16',
      url: `${base}sprites/stage7_run_16.png`,
      cycleSeconds: 0.65,
      scrollSpeed: 440 + (stage - 7) * 95,
      heightPct: 80,
    };
  }
  if (stage === 9) {
    return {
      key: 'stage9_cr7_16',
      url: `${base}sprites/stage9_cr7_16.png`,
      cycleSeconds: 0.5,
      scrollSpeed: 740,
      heightPct: 82,
    };
  }
  return {
    key: 'stage10_goku_16',
    url: `${base}sprites/stage10_goku_16.png`,
    cycleSeconds: 0.38,
    scrollSpeed: 980,
    heightPct: 84,
  };
}

interface CellBlob {
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
}

/**
 * Loads a 4x4 (16-frame) numbered sprite sheet:
 * 1. Converts white background (RGB > 200) to alpha = 0 while preserving #000000 (right) & #333333 (left) shading.
 * 2. Splits into 4 rows x 4 columns (frames 01..16).
 * 3. Inside each cell, detects connected components and discards the small top-left number label ("01".."16").
 * 4. Computes exact horizontal Center of Mass X and Bottom Y across all 16 frames and normalizes every frame
 *    into a uniform canvas so COM-X and Bottom-Y align with 1px precision (zero jitter).
 */
function extract16Frames(url: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w;
      srcCanvas.height = h;
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      srcCtx.drawImage(img, 0, 0);

      const fullImg = srcCtx.getImageData(0, 0, w, h);
      const data = fullImg.data;
      const mask = new Uint8Array(w * h);

      // Strip white background (RGB > 200) while preserving #000000 / #333333 shading
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (r > 200 && g > 200 && b > 200) {
          data[idx + 3] = 0;
        } else {
          const avg = (r + g + b) / 3;
          const alpha = avg <= 105 ? 255 : Math.round(((200 - avg) / 95) * 255);
          data[idx + 3] = Math.max(0, Math.min(255, alpha));
          if (alpha > 20) mask[i] = 1;
        }
      }

      const cols = 4;
      const rows = 4;
      const cellW = Math.floor(w / cols);
      const cellH = Math.floor(h / rows);

      const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
      const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

      interface ExtractedCell {
        cropW: number;
        cropH: number;
        comX: number;
        lowestY: number;
        rgba: Uint8ClampedArray;
      }

      const cells: ExtractedCell[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = c * cellW;
          const y0 = r * cellH;
          const x1 = c === cols - 1 ? w : (c + 1) * cellW;
          const y1 = r === rows - 1 ? h : (r + 1) * cellH;
          const cw = x1 - x0;
          const ch = y1 - y0;

          // Local BFS inside cell to separate silhouette from top-left number ("01".."16")
          const compId = new Int32Array(cw * ch);
          const queue = new Int32Array(cw * ch);
          const blobs: CellBlob[] = [];
          let nextId = 1;

          for (let ly = 0; ly < ch; ly++) {
            for (let lx = 0; lx < cw; lx++) {
              const gIdx = (y0 + ly) * w + (x0 + lx);
              const lIdx = ly * cw + lx;
              if (!mask[gIdx] || compId[lIdx] !== 0) continue;

              const id = nextId++;
              let head = 0;
              let tail = 0;
              queue[tail++] = lIdx;
              compId[lIdx] = id;

              let minX = lx;
              let maxX = lx;
              let minY = ly;
              let maxY = ly;
              let area = 0;

              while (head < tail) {
                const curr = queue[head++];
                const cy = Math.floor(curr / cw);
                const cx = curr - cy * cw;
                area++;
                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                for (let k = 0; k < 8; k++) {
                  const nx = cx + dx8[k];
                  const ny = cy + dy8[k];
                  if (nx >= 0 && nx < cw && ny >= 0 && ny < ch) {
                    const nlIdx = ny * cw + nx;
                    const ngIdx = (y0 + ny) * w + (x0 + nx);
                    if (mask[ngIdx] && compId[nlIdx] === 0) {
                      compId[nlIdx] = id;
                      queue[tail++] = nlIdx;
                    }
                  }
                }
              }

              if (area >= 6) {
                blobs.push({ id, minX, minY, maxX, maxY, area });
              }
            }
          }

          blobs.sort((a, b) => b.area - a.area);
          const mainBlob = blobs[0];
          const keepSet = new Set<number>();

          if (mainBlob) {
            keepSet.add(mainBlob.id);
            // Keep any detached limb/aura fragments belonging to the runner,
            // but explicitly exclude small blobs in the top-left corner (frame numbers "01".."16")
            for (let bIdx = 1; bIdx < blobs.length; bIdx++) {
              const b = blobs[bIdx];
              const bcx = (b.minX + b.maxX) / 2;
              const bcy = (b.minY + b.maxY) / 2;
              const isTopLeftLabel =
                bcx < cw * 0.28 && bcy < ch * 0.24 && b.area < mainBlob.area * 0.12;
              if (isTopLeftLabel) continue;

              const clampedX = Math.max(mainBlob.minX, Math.min(mainBlob.maxX, bcx));
              const clampedY = Math.max(mainBlob.minY, Math.min(mainBlob.maxY, bcy));
              if (Math.hypot(bcx - clampedX, bcy - clampedY) <= 32) {
                keepSet.add(b.id);
              }
            }
          }

          let minX = cw;
          let minY = ch;
          let maxX = -1;
          let maxY = -1;
          for (let ly = 0; ly < ch; ly++) {
            for (let lx = 0; lx < cw; lx++) {
              const id = compId[ly * cw + lx];
              if (id !== 0 && keepSet.has(id)) {
                if (lx < minX) minX = lx;
                if (lx > maxX) maxX = lx;
                if (ly < minY) minY = ly;
                if (ly > maxY) maxY = ly;
              }
            }
          }

          if (maxX < minX || maxY < minY) {
            minX = 0;
            minY = 0;
            maxX = cw - 1;
            maxY = ch - 1;
          }

          const cropW = maxX - minX + 1;
          const cropH = maxY - minY + 1;
          const rgba = new Uint8ClampedArray(cropW * cropH * 4);
          let sumX = 0;
          let count = 0;
          let lowestY = 0;

          for (let ly = minY; ly <= maxY; ly++) {
            for (let lx = minX; lx <= maxX; lx++) {
              const id = compId[ly * cw + lx];
              if (id === 0 || !keepSet.has(id)) continue;

              const g4 = ((y0 + ly) * w + (x0 + lx)) * 4;
              const rx = lx - minX;
              const ry = ly - minY;
              const d4 = (ry * cropW + rx) * 4;

              rgba[d4] = data[g4];
              rgba[d4 + 1] = data[g4 + 1];
              rgba[d4 + 2] = data[g4 + 2];
              rgba[d4 + 3] = data[g4 + 3];

              sumX += rx;
              count++;
              if (ry > lowestY) lowestY = ry;
            }
          }

          cells.push({
            cropW,
            cropH,
            comX: count > 0 ? sumX / count : cropW / 2,
            lowestY,
            rgba,
          });
        }
      }

      // Normalize all 16 frames to identical dimensions with exact COM-X center & Bottom-Y baseline
      const pad = 8;
      const maxLeft = cells.reduce((acc, c) => Math.max(acc, Math.ceil(c.comX)), 1);
      const maxRight = cells.reduce((acc, c) => Math.max(acc, Math.ceil(c.cropW - c.comX)), 1);
      const maxH = cells.reduce((acc, c) => Math.max(acc, c.lowestY + 1), 1);

      const normW = maxLeft + maxRight + pad * 2;
      const normH = maxH + pad * 2;
      const centerX = maxLeft + pad;
      const baseBottomY = normH - pad;

      const outFrames = cells.map((cell) => {
        const outCanvas = document.createElement('canvas');
        outCanvas.width = normW;
        outCanvas.height = normH;
        const outCtx = outCanvas.getContext('2d')!;
        const outImg = outCtx.createImageData(normW, normH);
        const outData = outImg.data;

        const offsetX = Math.round(centerX - cell.comX);
        const offsetY = Math.round(baseBottomY - (cell.lowestY + 1));

        for (let y = 0; y < cell.cropH; y++) {
          for (let x = 0; x < cell.cropW; x++) {
            const s4 = (y * cell.cropW + x) * 4;
            if (cell.rgba[s4 + 3] === 0) continue;
            const dx = x + offsetX;
            const dy = y + offsetY;
            if (dx < 0 || dx >= normW || dy < 0 || dy >= normH) continue;
            const d4 = (dy * normW + dx) * 4;
            outData[d4] = cell.rgba[s4];
            outData[d4 + 1] = cell.rgba[s4 + 1];
            outData[d4 + 2] = cell.rgba[s4 + 2];
            outData[d4 + 3] = cell.rgba[s4 + 3];
          }
        }

        outCtx.putImageData(outImg, 0, 0);
        return outCanvas.toDataURL('image/png');
      });

      resolve(outFrames);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
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
  const [sheetCache, setSheetCache] = useState<Partial<Record<SpriteSheetKey, string[]>>>({});
  const [frameIdx, setFrameIdx] = useState(0);
  const [showDebug, setShowDebug] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingKeysRef = useRef<Set<SpriteSheetKey>>(new Set());

  const stage = stageInfo.stage;
  const sheetCfg = getSheetConfigForStage(stage);
  const glowColor = stageInfo.accentColor;

  // Preload & extract all 6 16-frame sprite sheets
  useEffect(() => {
    const representativeStages = [0, 1, 4, 7, 9, 10];
    for (const s of representativeStages) {
      const cfg = getSheetConfigForStage(s);
      if (sheetCache[cfg.key] || loadingKeysRef.current.has(cfg.key)) continue;
      loadingKeysRef.current.add(cfg.key);
      extract16Frames(cfg.url)
        .then((frames) => {
          setSheetCache((prev) => ({ ...prev, [cfg.key]: frames }));
        })
        .catch(() => {
          loadingKeysRef.current.delete(cfg.key);
        });
    }
  }, [sheetCache]);

  useEffect(() => {
    if (!autoPlay) return;
    let idx = stageInfo.stage;
    const id = window.setInterval(() => {
      idx = (idx + 1) % 11;
      onDebugScoreChange(STAGE_SAMPLE_SCORES[idx]);
    }, 2400);
    return () => window.clearInterval(id);
  }, [autoPlay, onDebugScoreChange]);

  const stageRef = useRef(stage);
  const glowRef = useRef(glowColor);
  const showDebugRef = useRef(showDebug);
  stageRef.current = stage;
  glowRef.current = glowColor;
  showDebugRef.current = showDebug;

  // Unified 60fps requestAnimationFrame loop:
  // - Drives 16-frame index (0..15) smoothly via deltaTime
  // - Drives scrolling neon dashed road, perspective grid, speed lines & kick-off spark particles
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let cyclePos = 0; // 0..16
    let lastShownFrame = -1;
    let lastKickFrame = -1;
    let roadOffset = 0;

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
      const color = glowRef.current;
      const cfg = getSheetConfigForStage(st);

      cyclePos = (cyclePos + (dt / cfg.cycleSeconds) * 16) % 16;
      const nextFrame = Math.floor(cyclePos) % 16;
      if (nextFrame !== lastShownFrame) {
        lastShownFrame = nextFrame;
        setFrameIdx(nextFrame);
      }

      roadOffset = (roadOffset + cfg.scrollSpeed * dt) % 80;

      const canvas = bgCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        if (ctx && rect.width > 0 && rect.height > 0) {
          const dpr = window.devicePixelRatio || 1;
          const tw = Math.round(rect.width * dpr);
          const th = Math.round(rect.height * dpr);
          if (canvas.width !== tw || canvas.height !== th) {
            canvas.width = tw;
            canvas.height = th;
          }

          const w = rect.width;
          const h = rect.height;
          const bottomPad = showDebugRef.current ? 82 : 36;
          const groundY = h - bottomPad;

          // Spawn kick-off sparks at frames 02 (idx 2: right push-off) & 10 (idx 10: left push-off)
          if ((nextFrame === 2 || nextFrame === 10) && lastKickFrame !== nextFrame) {
            lastKickFrame = nextFrame;
            const count = st === 0 ? 2 : st < 4 ? 3 : st < 8 ? 5 : 8;
            for (let i = 0; i < count; i++) {
              sparks.push({
                x: w * 0.49 - Math.random() * 14,
                y: groundY - 2 - Math.random() * 4,
                vx: -(cfg.scrollSpeed * 0.42 + 65 + Math.random() * 130),
                vy: -(22 + Math.random() * 72),
                life: 0,
                maxLife: 0.22 + Math.random() * 0.26,
                size: 1.5 + Math.random() * 2.1,
              });
            }
          } else if (nextFrame !== 2 && nextFrame !== 10) {
            lastKickFrame = -1;
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, w, h);

          // Speed lines
          const activeLines = st < 2 ? 0 : st < 4 ? 5 : st < 7 ? 12 : 24;
          for (let i = 0; i < activeLines; i++) {
            const line = speedLines[i];
            line.x -= cfg.scrollSpeed * 1.45 * dt;
            if (line.x + line.len < 0) {
              line.x = w + Math.random() * 60;
              line.yFrac = 0.08 + Math.random() * 0.78;
              line.len = (st >= 9 ? 75 : 40) + Math.random() * 110;
            }
            const ly = line.yFrac * groundY;
            const grad = ctx.createLinearGradient(line.x + line.len, ly, line.x, ly);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'rgba(17, 18, 20, 0)');

            ctx.save();
            ctx.globalAlpha = st >= 9 ? line.alpha * 0.9 : line.alpha * 0.5;
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
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.82;
          ctx.lineWidth = 2;
          ctx.setLineDash([28, 16]);
          ctx.lineDashOffset = roadOffset;
          ctx.beginPath();
          ctx.moveTo(0, groundY);
          ctx.lineTo(w, groundY);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = color;
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
          ctx.strokeStyle = st === 0 ? 'rgba(255, 59, 48, 0.24)' : 'rgba(204, 255, 0, 0.22)';
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
            ctx.fillStyle = color;
            ctx.shadowColor = color;
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

  const currentFrames = sheetCache[sheetCfg.key];
  const currentFrameSrc =
    currentFrames && currentFrames.length > 0
      ? currentFrames[frameIdx % currentFrames.length]
      : null;

  const dropShadowStyle =
    stage === 0
      ? 'drop-shadow(0 0 6px #FF3B30) drop-shadow(0 0 12px #FF3B30)'
      : 'drop-shadow(0 0 6px #CCFF00) drop-shadow(0 0 12px #CCFF00)';

  return (
    <section className="relative w-full h-[38vh] min-h-[275px] max-h-[345px] bg-[#111214] border-b border-[#2C2F36] overflow-hidden select-none">
      {/* Atmospheric Radial Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            stage === 0
              ? 'radial-gradient(circle at 50% 48%, rgba(255, 59, 48, 0.16) 0%, rgba(17, 18, 20, 0) 58%)'
              : stage === 10
              ? 'radial-gradient(circle at 50% 46%, rgba(204, 255, 0, 0.24) 0%, rgba(17, 18, 20, 0) 62%)'
              : 'radial-gradient(circle at 50% 48%, rgba(204, 255, 0, 0.12) 0%, rgba(17, 18, 20, 0) 58%)',
        }}
      />

      {/* Scrolling Dash Road, Speed Lines & Spark Particles Canvas */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none block" />

      {/* 16-Frame Normalized Silhouette (zero bounce, zero jitter, #000000 right / #333333 left) */}
      <div
        className="absolute inset-x-0 top-3 flex items-end justify-center pointer-events-none overflow-visible"
        style={{ bottom: showDebug ? '76px' : '30px' }}
      >
        {currentFrameSrc && (
          <img
            src={currentFrameSrc}
            alt={`Stage ${stage} Frame ${String(frameIdx + 1).padStart(2, '0')}`}
            className="object-contain"
            style={{
              height: `${sheetCfg.heightPct}%`,
              filter: dropShadowStyle,
            }}
          />
        )}
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
