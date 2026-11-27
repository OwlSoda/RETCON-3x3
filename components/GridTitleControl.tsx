import React, { useState, useRef, useEffect } from 'react';
import { Type as TypeIcon, X, ChevronRight, Check } from 'lucide-react';

interface GridTitleControlProps {
  gridTitle: string;
  setGridTitle: (title: string) => void;
  showTitleOverlay: boolean;
  setShowTitleOverlay: (show: boolean) => void;
  isDarkMode: boolean;
}

const safeString = (val: unknown): string => (val === null || val === undefined ? '' : String(val));

export const GridTitleControl: React.FC<GridTitleControlProps> = ({
  gridTitle,
  setGridTitle,
  showTitleOverlay,
  setShowTitleOverlay,
  isDarkMode
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasTitle = safeString(gridTitle).trim().length > 0;

  // Auto-focus input when opening
  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div 
      ref={containerRef}
      className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-1/2 lg:-translate-y-1/2 lg:right-6 z-40 transition-all duration-300"
      onClick={(e) => e.stopPropagation()}
    >
      {!isOpen ? (
        /* Compact Collapsed Pill / Badge */
        <button
          onClick={() => setIsOpen(true)}
          className={`group flex items-center gap-2 px-3 py-2 rounded-full border shadow-xl backdrop-blur-xl transition-all duration-200 active:scale-95 ${
            isDarkMode 
              ? 'bg-zinc-900/80 hover:bg-zinc-800/90 border-zinc-800 text-zinc-300 hover:border-zinc-700' 
              : 'bg-white/90 hover:bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-300'
          } ${hasTitle ? (isDarkMode ? 'ring-1 ring-white/20' : 'ring-1 ring-black/10') : ''}`}
          title={hasTitle ? `Grid Title: ${gridTitle}` : 'Add Grid Title'}
        >
          <div className={`p-1 rounded-full ${isDarkMode ? 'bg-zinc-800 text-zinc-400 group-hover:text-white' : 'bg-zinc-100 text-zinc-500 group-hover:text-black'}`}>
            <TypeIcon className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] max-w-[120px] sm:max-w-[150px] truncate">
            {hasTitle ? gridTitle : 'Title'}
          </span>
          <ChevronRight className={`w-3 h-3 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`} />
        </button>
      ) : (
        /* Redesigned Sleek Side Panel */
        <div 
          className={`w-[250px] sm:w-[280px] p-4 rounded-xl border shadow-2xl backdrop-blur-2xl transition-all duration-300 animate-in fade-in zoom-in-95 ${
            isDarkMode 
              ? 'bg-zinc-950/95 border-zinc-800 text-zinc-100' 
              : 'bg-white/98 border-zinc-200 text-zinc-900'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/40">
            <div className="flex items-center gap-2">
              <TypeIcon className={`w-3.5 h-3.5 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.25em]">Grid Title</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className={`p-1 rounded-md transition-all hover:scale-110 active:scale-90 ${
                isDarkMode ? 'text-zinc-500 hover:text-white hover:bg-zinc-800/50' : 'text-zinc-400 hover:text-black hover:bg-zinc-100'
              }`}
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Input Box */}
          <div className="space-y-3">
            <div className={`relative flex items-center border rounded-lg overflow-hidden transition-all ${
              isDarkMode 
                ? 'bg-zinc-900/60 border-zinc-800 focus-within:border-zinc-600' 
                : 'bg-zinc-50 border-zinc-200 focus-within:border-zinc-400'
            }`}>
              <input
                ref={inputRef}
                type="text"
                value={gridTitle}
                onChange={(e) => setGridTitle(safeString(e.target.value).toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder="ENTER TITLE..."
                className={`w-full px-3 py-2.5 text-[11px] font-black tracking-[0.2em] uppercase bg-transparent focus:outline-none placeholder-zinc-500 ${
                  isDarkMode ? 'text-white' : 'text-zinc-900'
                }`}
              />
              {hasTitle && (
                <button
                  onClick={() => setGridTitle('')}
                  className={`p-1.5 mr-1 rounded-full transition-all ${
                    isDarkMode ? 'text-zinc-500 hover:text-white hover:bg-zinc-800' : 'text-zinc-400 hover:text-black hover:bg-zinc-200'
                  }`}
                  title="Clear title"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Toggle: Overlay on grid */}
            <label className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors ${
              isDarkMode ? 'hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-300' : 'hover:bg-zinc-50 text-zinc-600 hover:text-zinc-800'
            }`}>
              <span className="text-[9px] font-bold uppercase tracking-wider">Overlay On Grid</span>
              <button
                type="button"
                role="switch"
                aria-checked={showTitleOverlay}
                onClick={() => setShowTitleOverlay(!showTitleOverlay)}
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${
                  showTitleOverlay 
                    ? (isDarkMode ? 'bg-white' : 'bg-black') 
                    : (isDarkMode ? 'bg-zinc-800' : 'bg-zinc-300')
                }`}
              >
                <div className={`w-3 h-3 rounded-full transition-transform ${
                  showTitleOverlay 
                    ? `translate-x-4 ${isDarkMode ? 'bg-black' : 'bg-white'}` 
                    : `translate-x-0 ${isDarkMode ? 'bg-zinc-500' : 'bg-zinc-100'}`
                }`} />
              </button>
            </label>

            {/* Hint & Done */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[8px] font-medium tracking-wide text-zinc-500">
                {hasTitle ? 'Included in export naming' : 'Optional'}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                  isDarkMode 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                    : 'bg-zinc-200 hover:bg-zinc-300 text-black'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
