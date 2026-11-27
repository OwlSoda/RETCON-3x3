import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Check, ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize, Move, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Sparkles 
} from 'lucide-react';
import { TileData } from '../types';

interface CropModalProps {
  tile: TileData;
  isDarkMode: boolean;
  onApply: (transform: { scale: number; x: number; y: number }) => void;
  onClose: () => void;
}

const getProxiedUrl = (url: string | null) => {
  if (!url) return null;
  const safeUrl = String(url).trim();
  if (!safeUrl || safeUrl === 'undefined' || safeUrl === 'null') return null;
  if (safeUrl.startsWith('data:') || safeUrl.startsWith('blob:')) return safeUrl;
  return `https://images.weserv.nl/?url=${encodeURIComponent(safeUrl)}&default=${encodeURIComponent(safeUrl)}`;
};

export const CropModal: React.FC<CropModalProps> = ({
  tile,
  isDarkMode,
  onApply,
  onClose
}) => {
  const [scale, setScale] = useState(tile.scale || 1);
  const [position, setPosition] = useState({ x: tile.positionX || 0, y: tile.positionY || 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [feedbackBadge, setFeedbackBadge] = useState<string | null>(null);
  
  const safeImageUrl = getProxiedUrl(tile.imageUrl);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchScale = useRef<number>(1);
  const lastTapTimeRef = useRef<number>(0);
  const feedbackTimerRef = useRef<number | null>(null);

  const showFeedback = (text: string) => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    setFeedbackBadge(text);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackBadge(null);
    }, 1200);
  };

  // Pre-load natural image dimensions to calculate exact aspect ratios
  useEffect(() => {
    if (!safeImageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 800;
      setNaturalSize({ width: w, height: h });
    };
    img.src = safeImageUrl;
  }, [safeImageUrl]);

  const imgAspect = naturalSize ? naturalSize.width / naturalSize.height : 1;
  const isLandscape = imgAspect > 1.05;
  const isPortrait = imgAspect < 0.95;
  
  // Exact scale needed to fill 100% of the square without letterbox bars
  const fillScale = naturalSize
    ? Number(Math.max(imgAspect, 1 / imgAspect).toFixed(2))
    : 1.5;

  // Sync initial transform from tile prop
  useEffect(() => {
    setScale(tile.scale || 1);
    setPosition({ x: tile.positionX || 0, y: tile.positionY || 0 });
  }, [tile]);

  // Clamp pan position so image stays within comfortable boundaries and never gets lost
  const getClampedPosition = useCallback((newX: number, newY: number, curScale: number) => {
    const container = containerRef.current;
    if (!container || !naturalSize) return { x: newX, y: newY };

    const W = container.offsetWidth || 300;
    let baseW = W;
    let baseH = W;

    if (imgAspect >= 1) {
      baseW = W;
      baseH = W / imgAspect;
    } else {
      baseH = W;
      baseW = W * imgAspect;
    }

    const visualW = baseW * curScale;
    const visualH = baseH * curScale;

    const maxPanX = Math.max(0, (visualW - W) / 2);
    const maxPanY = Math.max(0, (visualH - W) / 2);

    // Allow slight 30px elastic overshoot while dragging for tactile feedback
    const buffer = 30;
    return {
      x: Math.max(-maxPanX - buffer, Math.min(maxPanX + buffer, newX)),
      y: Math.max(-maxPanY - buffer, Math.min(maxPanY + buffer, newY)),
    };
  }, [naturalSize, imgAspect]);

  // Snap back to exact edge boundaries on release
  const snapToExactBounds = useCallback((x: number, y: number, curScale: number) => {
    const container = containerRef.current;
    if (!container || !naturalSize) return { x, y };

    const W = container.offsetWidth || 300;
    let baseW = W;
    let baseH = W;

    if (imgAspect >= 1) {
      baseW = W;
      baseH = W / imgAspect;
    } else {
      baseH = W;
      baseW = W * imgAspect;
    }

    const visualW = baseW * curScale;
    const visualH = baseH * curScale;

    const maxPanX = Math.max(0, (visualW - W) / 2);
    const maxPanY = Math.max(0, (visualH - W) / 2);

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, y)),
    };
  }, [naturalSize, imgAspect]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rawX = e.clientX - dragStart.x;
      const rawY = e.clientY - dragStart.y;
      setPosition(getClampedPosition(rawX, rawY, scale));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setPosition((prev) => snapToExactBounds(prev.x, prev.y, scale));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, scale, getClampedPosition, snapToExactBounds]);

  // Desktop Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = -e.deltaY * 0.0015;
    const nextScale = Math.min(6, Math.max(0.4, Number((scale + zoomDelta).toFixed(2))));
    setScale(nextScale);
    setPosition((prev) => snapToExactBounds(prev.x, prev.y, nextScale));
  };

  // Touch Drag & Pinch-to-Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const now = Date.now();
      // Double tap detected
      if (now - lastTapTimeRef.current < 280) {
        handleToggleFitFill();
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
      initialPinchDist.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDist.current = dist;
      initialPinchScale.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const rawX = touch.clientX - dragStart.x;
      const rawY = touch.clientY - dragStart.y;
      setPosition(getClampedPosition(rawX, rawY, scale));
    } else if (e.touches.length === 2 && initialPinchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDist.current;
      const nextScale = Math.min(6, Math.max(0.4, Number((initialPinchScale.current * ratio).toFixed(2))));
      setScale(nextScale);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    initialPinchDist.current = null;
    setPosition((prev) => snapToExactBounds(prev.x, prev.y, scale));
  };

  // 1-Tap Toggle between Fit and Fill
  const handleToggleFitFill = () => {
    const isCurrentlyFilled = Math.abs(scale - fillScale) < 0.12;
    if (isCurrentlyFilled) {
      setScale(1.0);
      setPosition({ x: 0, y: 0 });
      showFeedback('Fit 1.0x');
    } else {
      setScale(fillScale);
      setPosition({ x: 0, y: 0 });
      showFeedback(`Fill ${fillScale}x`);
    }
  };

  // Presets
  const handleFit = () => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
    showFeedback('Fit (1.0x)');
  };

  const handleFill = () => {
    setScale(fillScale);
    setPosition({ x: 0, y: 0 });
    showFeedback(`Fill (${fillScale}x)`);
  };

  const handleReset = () => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
    showFeedback('Reset');
  };

  // Quick Directional Snaps
  const handleDirectionSnap = (dir: 'top' | 'bottom' | 'left' | 'right' | 'center') => {
    const container = containerRef.current;
    const W = container?.offsetWidth || 300;
    let baseW = W;
    let baseH = W;
    if (imgAspect >= 1) {
      baseW = W;
      baseH = W / imgAspect;
    } else {
      baseH = W;
      baseW = W * imgAspect;
    }

    const targetScale = Math.max(scale, fillScale);
    setScale(targetScale);

    const visualW = baseW * targetScale;
    const visualH = baseH * targetScale;
    const maxPanX = Math.max(0, (visualW - W) / 2);
    const maxPanY = Math.max(0, (visualH - W) / 2);

    switch (dir) {
      case 'top':
        setPosition({ x: 0, y: maxPanY });
        showFeedback('Framed Top');
        break;
      case 'bottom':
        setPosition({ x: 0, y: -maxPanY });
        showFeedback('Framed Bottom');
        break;
      case 'left':
        setPosition({ x: maxPanX, y: 0 });
        showFeedback('Framed Left');
        break;
      case 'right':
        setPosition({ x: -maxPanX, y: 0 });
        showFeedback('Framed Right');
        break;
      case 'center':
      default:
        setPosition({ x: 0, y: 0 });
        showFeedback('Centered');
        break;
    }
  };

  const handleSave = () => {
    const finalPos = snapToExactBounds(position.x, position.y, scale);
    onApply({
      scale,
      x: finalPos.x,
      y: finalPos.y
    });
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Dialog / Mobile Bottom Sheet */}
      <div 
        className={`relative z-10 w-full h-[96dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border shadow-2xl flex flex-col overflow-hidden ${
          isDarkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
          isDarkMode ? 'border-zinc-800/80 bg-zinc-900/60' : 'border-zinc-100 bg-zinc-50'
        }`}>
          <button 
            onClick={onClose}
            className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all active:scale-90 ${
              isDarkMode ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60' : 'text-zinc-500 hover:text-black hover:bg-zinc-200'
            }`}
          >
            Cancel
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.25em]">Crop & Frame</span>
            {isLandscape && (
              <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                Wide
              </span>
            )}
            {isPortrait && (
              <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                Tall
              </span>
            )}
          </div>

          <button 
            onClick={handleSave}
            className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
              isDarkMode ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply</span>
          </button>
        </div>

        {/* Viewport Workspace */}
        <div className="flex-grow flex flex-col items-center justify-center p-3 sm:p-5 bg-zinc-950/40 min-h-0 relative">
          {/* Subtle gesture hint */}
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
            <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Double-tap photo to toggle Fit/Fill • Drag to reposition</span>
          </div>

          {/* Square Viewport */}
          <div 
            ref={containerRef}
            className={`relative aspect-square w-full max-w-[min(calc(100vw-36px),calc(100dvh-320px),340px)] rounded-xl overflow-hidden border-2 shadow-2xl cursor-grab active:cursor-grabbing touch-none select-none ${
              isDarkMode ? 'border-white/30 bg-black' : 'border-zinc-900/30 bg-zinc-100'
            }`}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleToggleFitFill}
          >
            {/* The Image */}
            {safeImageUrl && (
              <img
                src={safeImageUrl}
                alt="Crop preview"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                draggable={false}
                className="w-full h-full object-contain pointer-events-none transition-transform duration-75 ease-out select-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  willChange: 'transform',
                  display: 'block'
                }}
              />
            )}

            {/* Rule-of-thirds Grid Overlay */}
            <div className={`absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none transition-opacity duration-200 ${
              isDragging ? 'opacity-40' : 'opacity-20'
            }`}>
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-white" />
            </div>

            {/* Transient Gesture Feedback Badge */}
            {feedbackBadge && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  {feedbackBadge}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Section (Thumb-Friendly Bottom Panel) */}
        <div className={`p-4 sm:p-5 border-t flex flex-col gap-3.5 shrink-0 ${
          isDarkMode ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          {/* Quick Preset Buttons */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleFit}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 flex items-center gap-1 ${
                  Math.abs(scale - 1) < 0.05
                    ? (isDarkMode ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                    : (isDarkMode ? 'border-zinc-800 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200')
                }`}
              >
                <Minimize className="w-3 h-3" />
                <span>Fit</span>
              </button>

              <button
                onClick={handleFill}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 flex items-center gap-1 ${
                  Math.abs(scale - fillScale) < 0.05
                    ? (isDarkMode ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                    : (isDarkMode ? 'border-zinc-800 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200')
                }`}
              >
                <Maximize className="w-3 h-3" />
                <span>Fill</span>
              </button>

              <button
                onClick={handleReset}
                className={`p-1.5 rounded-lg border text-zinc-400 hover:text-white transition-all active:scale-90 ${
                  isDarkMode ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-200 text-zinc-600'
                }`}
                title="Reset Position & Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Contextual Directional Framing Snaps */}
            <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-lg border border-zinc-800/60">
              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 text-zinc-500">
                Snap
              </span>

              {isPortrait ? (
                <>
                  <button
                    onClick={() => handleDirectionSnap('top')}
                    className="p-1 rounded hover:bg-zinc-800 active:scale-90 text-zinc-400 hover:text-white"
                    title="Snap to Top (Face / Head framing)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDirectionSnap('center')}
                    className="p-1 rounded hover:bg-zinc-800 active:scale-90 text-zinc-400 hover:text-white"
                    title="Center vertically"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDirectionSnap('bottom')}
                    className="p-1 rounded hover:bg-zinc-800 active:scale-90 text-zinc-400 hover:text-white"
                    title="Snap to Bottom"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleDirectionSnap('left')}
                    className="p-1 rounded hover:bg-zinc-800 active:scale-90 text-zinc-400 hover:text-white"
                    title="Snap to Left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDirectionSnap('center')}
                    className="p-1 rounded hover:bg-zinc-800 active:scale-90 text-zinc-400 hover:text-white"
                    title="Center horizontally"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDirectionSnap('right')}
                    className="p-1 rounded hover:bg-zinc-800 active:scale-90 text-zinc-400 hover:text-white"
                    title="Snap to Right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Smooth Zoom Bar */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                const s = Math.max(0.4, Number((scale - 0.1).toFixed(2)));
                setScale(s);
                setPosition((prev) => snapToExactBounds(prev.x, prev.y, s));
              }}
              className="p-2 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 active:scale-90 transition-all text-zinc-400 hover:text-white shrink-0"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min="0.5"
              max={Math.max(4, Math.round(fillScale * 1.6 * 10) / 10)}
              step="0.02"
              value={scale}
              onChange={(e) => {
                const s = parseFloat(e.target.value);
                setScale(s);
                setPosition((prev) => snapToExactBounds(prev.x, prev.y, s));
              }}
              className={`flex-grow h-2 rounded-lg appearance-none cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 accent-white' : 'bg-zinc-200 accent-black'
              }`}
            />

            <button
              onClick={() => {
                const s = Math.min(6, Number((scale + 0.1).toFixed(2)));
                setScale(s);
                setPosition((prev) => snapToExactBounds(prev.x, prev.y, s));
              }}
              className="p-2 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 active:scale-90 transition-all text-zinc-400 hover:text-white shrink-0"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <span className="text-[10px] font-mono font-bold w-10 text-right opacity-80 shrink-0">
              {scale.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CropModal;
