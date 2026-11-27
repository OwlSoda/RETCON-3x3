import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Upload, Maximize2, X, Link as LinkIcon, Check, Move, Trash2 } from 'lucide-react';
import { TileData } from '../types';
import { optimizeImageFile, isValidImageUrl } from '../utils/imageUtils';

interface GridTileProps {
  tile: TileData;
  isDarkMode: boolean;
  isLinking: boolean;
  onLocalUpload: (id: number, dataUrl: string) => void;
  onAssignUrl: (id: number, url: string) => void;
  onSwapTiles: (sourceId: number, targetId: number) => void;
  onRemoveImage: (id: number) => void;
  onOpenCropModal: (id: number) => void;
  onToggleLink: (id: number) => void;
  onClose: () => void;
}

const safeString = (val: any): string => (val === null || val === undefined ? '' : String(val));

const getProxiedUrl = (url: string | null) => {
  const safeUrl = safeString(url).trim();
  if (!safeUrl || safeUrl === 'undefined' || safeUrl === 'null') return null;
  if (safeUrl.startsWith('data:') || safeUrl.startsWith('blob:')) return safeUrl;
  return `https://images.weserv.nl/?url=${encodeURIComponent(safeUrl)}&default=${encodeURIComponent(safeUrl)}`;
};

const GridTile: React.FC<GridTileProps> = ({ 
  tile, isDarkMode, isLinking, onLocalUpload, 
  onAssignUrl, onSwapTiles, onRemoveImage, onOpenCropModal, onToggleLink, 
  onClose
}) => {
  const [isBroken, setIsBroken] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDragTarget, setIsDragTarget] = useState(false);
  const [isFileDropTarget, setIsFileDropTarget] = useState(false);
  const [isTouchSwapping, setIsTouchSwapping] = useState(false);
  
  const longPressTimer = useRef<number | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (longPressTimer.current) window.clearTimeout(longPressTimer.current); };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-export-hide="true"]')) return;

    if (!isLinking && tile.imageUrl) {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      longPressTimer.current = window.setTimeout(() => {
        setIsTouchSwapping(true);
        if (navigator.vibrate) navigator.vibrate(50);
      }, 600);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isTouchSwapping) {
      const touch = e.changedTouches[0];
      const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
      const targetTile = elements.find(el => el.hasAttribute('data-tile-id') && el !== tileRef.current);
      
      if (targetTile) {
        const targetId = parseInt(targetTile.getAttribute('data-tile-id') || '', 10);
        if (!isNaN(targetId)) onSwapTiles(tile.id, targetId);
      }
      setIsTouchSwapping(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isTouchSwapping && longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isTouchSwapping && e.cancelable) e.preventDefault();
  };

  const safeImageUrl = getProxiedUrl(tile.imageUrl);

  return (
    <div 
      ref={tileRef}
      data-tile-id={tile.id}
      className={`relative group aspect-square overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-black' : 'bg-white'} ${isFileDropTarget ? 'ring-4 ring-emerald-500 z-50 scale-[0.98]' : isDragTarget || isTouchSwapping ? `ring-4 ring-inset z-50 scale-[0.96] ${isDarkMode ? 'ring-white' : 'ring-black'}` : ''} ${isTouchSwapping ? 'opacity-70 rotate-1' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      draggable={!!tile.imageUrl && !isLinking}
      onDragStart={(e) => {
        if (isLinking || !tile.imageUrl) return e.preventDefault();
        e.dataTransfer.setData('text/plain', tile.id.toString());
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
          setIsFileDropTarget(true);
        } else {
          setIsDragTarget(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragTarget(false);
        setIsFileDropTarget(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragTarget(false);
        setIsFileDropTarget(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            try {
              const optimized = await optimizeImageFile(file);
              onLocalUpload(tile.id, optimized);
              setIsBroken(false);
            } catch {
              const reader = new FileReader();
              reader.onload = (ev) => typeof ev.target?.result === 'string' && onLocalUpload(tile.id, ev.target.result);
              reader.readAsDataURL(file);
              setIsBroken(false);
            }
          }
          return;
        }

        const sourceId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(sourceId)) onSwapTiles(sourceId, tile.id);
      }}
    >
      <input type="file" ref={fileInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          try {
            const optimized = await optimizeImageFile(file);
            onLocalUpload(tile.id, optimized);
            setIsBroken(false);
          } catch {
            const reader = new FileReader();
            reader.onload = (ev) => typeof ev.target?.result === 'string' && onLocalUpload(tile.id, ev.target.result);
            reader.readAsDataURL(file as Blob);
            setIsBroken(false);
          }
        }
        if (e.target) e.target.value = '';
      }} className="hidden" accept="image/*" />

      {isFileDropTarget && (
        <div data-export-hide="true" className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none bg-emerald-950/20 backdrop-blur-[1px]">
          <div className="px-4 py-2 sm:px-5 sm:py-3 rounded-full flex items-center gap-2 shadow-2xl bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest">
            <Upload className="w-4 h-4" />
            <span>Drop Image</span>
          </div>
        </div>
      )}

      {(isDragTarget || isTouchSwapping) && !isFileDropTarget && (
        <div data-export-hide="true" className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none bg-black/5">
          <div className={`px-4 py-2 sm:px-5 sm:py-3 rounded-full flex items-center gap-2 sm:gap-3 shadow-2xl ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>
            <Move className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em]">Swap</span>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${isDarkMode ? 'bg-[#050505]' : 'bg-[#FAFAFA]'}`}>
        {safeImageUrl && !isBroken ? (
          <img
            src={safeImageUrl}
            onError={() => setIsBroken(true)}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            className="w-full h-full object-contain select-none"
            style={{ 
              transform: `translate(${tile.positionX || 0}px, ${tile.positionY || 0}px) scale(${tile.scale || 1})`, 
              transformOrigin: 'center',
              display: 'block'
            }}
          />
        ) : (
          <div className={`flex flex-col items-center opacity-20 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            <ImageIcon className="w-8 h-8 sm:w-14 sm:h-14 stroke-[0.5px]" />
            {isBroken && <p className="text-[6px] sm:text-[7px] font-black uppercase mt-2 text-red-500">Error</p>}
          </div>
        )}
      </div>

      {!isLinking && (
        <div data-export-hide="true" className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 sm:gap-6 z-20 ${isDarkMode ? 'bg-black/90' : 'bg-white/90'}`}>
          <div className="flex flex-row justify-center gap-2 sm:gap-4 px-2 sm:px-6">
            {tile.imageUrl ? (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); onOpenCropModal(tile.id); }} 
                  className={`p-2.5 sm:p-4 rounded-full shadow-2xl transition-all active:scale-90 ${isDarkMode ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'}`} 
                  title="Crop / Adjust Image"
                >
                  <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveImage(tile.id); }} 
                  className={`p-2.5 sm:p-4 border border-red-500/50 rounded-full shadow-2xl transition-all active:scale-90 ${isDarkMode ? 'bg-red-950/40 text-red-400' : 'bg-red-50 text-red-600'}`} 
                  title="Remove Image"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleLink(tile.id); }} 
                  className={`p-2.5 sm:p-4 border rounded-full transition-all active:scale-90 ${isDarkMode ? 'bg-zinc-900 text-white border-zinc-800 hover:bg-zinc-800' : 'bg-zinc-100 text-black border-zinc-200 hover:bg-zinc-200'}`} 
                  title="Paste Link"
                >
                  <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} 
                  className={`p-2.5 sm:p-4 border rounded-full transition-all active:scale-90 ${isDarkMode ? 'bg-zinc-900 text-white border-zinc-800 hover:bg-zinc-800' : 'bg-zinc-100 text-black border-zinc-200 hover:bg-zinc-200'}`} 
                  title="Upload Local"
                >
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </>
            )}
          </div>
          <p className={`hidden sm:block text-[9px] font-black uppercase tracking-[0.5em] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {tile.imageUrl ? 'DRAG TO SWAP' : 'GRID SLOT'}
          </p>
        </div>
      )}

      {isLinking && (
        <div data-export-hide="true" className="absolute inset-0 z-[60] flex items-end" onClick={(e) => { e.stopPropagation(); onClose(); }}>
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" />
          <div className={`relative z-10 w-full p-3 sm:p-6 border-t shadow-2xl pointer-events-auto ${isDarkMode ? 'bg-black border-zinc-800' : 'bg-white border-zinc-200'}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 sm:gap-5">
                <input
                  autoFocus type="text" value={pastedUrl} 
                  onChange={(e) => {
                    setPastedUrl(safeString(e.target.value));
                    if (urlError) setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const url = safeString(pastedUrl).trim();
                      if (!url) return;
                      if (!isValidImageUrl(url)) {
                        setUrlError('Please enter a valid HTTP, HTTPS, or Base64 image URL.');
                        return;
                      }
                      onAssignUrl(tile.id, url);
                      setPastedUrl('');
                      setUrlError(null);
                      setIsBroken(false);
                    }
                  }}
                  placeholder="Paste Image URL..."
                  className={`flex-grow bg-transparent text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] focus:outline-none placeholder-zinc-500 ${isDarkMode ? 'text-white' : 'text-black'}`}
                />
                <button 
                  onClick={() => {
                    const url = safeString(pastedUrl).trim();
                    if (!url) return;
                    if (!isValidImageUrl(url)) {
                      setUrlError('Please enter a valid HTTP, HTTPS, or Base64 image URL.');
                      return;
                    }
                    onAssignUrl(tile.id, url);
                    setPastedUrl('');
                    setUrlError(null);
                    setIsBroken(false);
                  }} 
                  className="text-zinc-500 hover:text-green-500 p-2 active:scale-90"
                  title="Confirm"
                >
                  <Check className="w-6 h-6" />
                </button>
                <button onClick={onClose} className="text-zinc-500 hover:text-red-500 p-2 active:scale-90" title="Cancel"><X className="w-6 h-6" /></button>
              </div>
              {urlError && (
                <p className="text-[8px] sm:text-[9px] font-bold text-red-500 tracking-wider">
                  {urlError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridTile;
