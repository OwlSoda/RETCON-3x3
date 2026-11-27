
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Download, LayoutGrid, AlertCircle, ClipboardList, X, Type as TypeIcon, Image as ImageIcon, Sun, Moon, Settings, Check, Trash2, Loader2, Palette } from 'lucide-react';
import { toPng, toJpeg, toCanvas } from 'html-to-image';
import GridTile from './components/GridTile';
import { CropModal } from './components/CropModal';
import { GridTitleControl } from './components/GridTitleControl';
import { TileData, ExportConfig, NamingScheme, ExportFormat } from './types';
import { optimizeImageFile, isValidImageUrl } from './utils/imageUtils';

const DB_NAME = 'Retcon3x3DB';
const STORE_NAME = 'stateStore';
const STATE_KEY = 'appState';

const RetconStorage = {
  open: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  save: async (data: any) => {
    const db = await RetconStorage.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, STATE_KEY);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },
  load: async (): Promise<any> => {
    const db = await RetconStorage.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(STATE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  clear: async () => {
    const db = await RetconStorage.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
};

const safeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val);
};

const getInitialTiles = (): TileData[] => Array.from({ length: 9 }, (_, i) => ({
  id: i,
  imageUrl: null,
  isLoading: false,
  scale: 1,
  positionX: 0,
  positionY: 0,
}));

export default function App() {
  const [tiles, setTiles] = useState<TileData[]>(getInitialTiles());
  const [gridTitle, setGridTitle] = useState<string>('');
  const [showTitleOverlay, setShowTitleOverlay] = useState<boolean>(true);
  const [gridColor, setGridColor] = useState<string>('#000000');
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('Preparing composition...');
  const [bulkText, setBulkText] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [error]);
  
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'png',
    quality: 0.95,
    namingScheme: 'DEFAULT'
  });

  const [activeTileId, setActiveTileId] = useState<number | null>(null);
  const [activeMode, setActiveMode] = useState<'link' | 'adjust' | 'crop' | null>(null);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const isDemoModeRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      isDemoModeRef.current = true;
      const demoImages = [
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop'
      ];
      setTiles(demoImages.map((url, i) => ({
        id: i,
        imageUrl: url,
        isLoading: false,
        scale: 1,
        positionX: 0,
        positionY: 0
      })));
      setGridTitle('ARCHITECTURAL MINIMALISM');
      setShowTitleOverlay(true);
      if (params.get('theme') === 'light') setIsDarkMode(false);
      if (params.get('crop') === '1') {
        setActiveTileId(0);
        setActiveMode('crop');
      }
      setIsRestored(true);
      return;
    }

    RetconStorage.load().then((parsed) => {
      if (parsed) {
        if (Array.isArray(parsed.tiles)) setTiles(parsed.tiles);
        if (typeof parsed.gridTitle === 'string') setGridTitle(parsed.gridTitle);
        if (typeof parsed.showTitleOverlay === 'boolean') setShowTitleOverlay(parsed.showTitleOverlay);
        if (typeof parsed.gridColor === 'string') setGridColor(parsed.gridColor);
        if (typeof parsed.isDarkMode === 'boolean') setIsDarkMode(parsed.isDarkMode);
        if (parsed.exportConfig) setExportConfig(parsed.exportConfig);
      }
      setIsRestored(true);
    }).catch(e => {
      console.error('Failed to restore session:', e);
      setIsRestored(true);
    });
  }, []);

  useEffect(() => {
    if (!isRestored || isDemoModeRef.current) return;
    const state = { tiles, gridTitle, showTitleOverlay, gridColor, isDarkMode, exportConfig };
    RetconStorage.save(state).catch((e) => {
      console.error('Failed to save to IndexedDB:', e);
    });
  }, [tiles, gridTitle, showTitleOverlay, gridColor, isDarkMode, exportConfig, isRestored]);

  const updateTile = useCallback((id: number, updates: Partial<TileData>) => {
    setTiles(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ));
  }, []);

  const handleClearGrid = () => {
    if (window.confirm("Are you sure you want to clear the entire grid? All images and titles will be reset.")) {
      setTiles(getInitialTiles());
      setGridTitle('');
    }
  };

  const handleUpdateTransform = (id: number, transform: { scale?: number, x?: number, y?: number }) => {
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;
    updateTile(id, {
      scale: transform.scale ?? tile.scale,
      positionX: transform.x ?? tile.positionX,
      positionY: transform.y ?? tile.positionY
    });
  };

  const handleAssignUrl = (id: number, url: string) => {
    const safeUrl = safeString(url).trim();
    if (!safeUrl || !isValidImageUrl(safeUrl)) return;
    updateTile(id, { 
      imageUrl: safeUrl, 
      isLoading: false,
      scale: 1,
      positionX: 0,
      positionY: 0
    });
    setActiveTileId(null);
    setActiveMode(null);
  };

  const handleSwapTiles = useCallback((sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    setTiles(prev => {
      const sourceIdx = prev.findIndex(t => t.id === sourceId);
      const targetIdx = prev.findIndex(t => t.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;

      const newTiles = [...prev];
      const sourceTile = { ...newTiles[sourceIdx] };
      const targetTile = { ...newTiles[targetIdx] };

      newTiles[sourceIdx] = { 
        ...sourceTile, 
        imageUrl: targetTile.imageUrl, 
        scale: targetTile.scale, 
        positionX: targetTile.positionX, 
        positionY: targetTile.positionY, 
        isLoading: targetTile.isLoading 
      };
      newTiles[targetIdx] = { 
        ...targetTile, 
        imageUrl: sourceTile.imageUrl, 
        scale: sourceTile.scale, 
        positionX: sourceTile.positionX, 
        positionY: sourceTile.positionY, 
        isLoading: sourceTile.isLoading 
      };
      return newTiles;
    });
  }, []);

  const handleRemoveImage = (id: number) => {
    updateTile(id, { imageUrl: null, scale: 1, positionX: 0, positionY: 0, isLoading: false });
  };

  const generateFilename = () => {
    try {
      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      
      const safeTitle = safeString(gridTitle).trim();
      const titleSlug = safeTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'UNTITLED';
      const ts = now.getTime();

      let base = '';
      const scheme = exportConfig.namingScheme;
      const format = exportConfig.format;

      switch (scheme) {
        case 'TIMESTAMP': base = `GRID_${ts}`; break;
        case 'MINIMAL': base = `${titleSlug}_3X3`; break;
        case 'CHRONO': base = `${YYYY}${MM}${DD}_${titleSlug}`; break;
        default: base = `RETCON_${YYYY}${MM}_${titleSlug}`; break;
      }
      return `${base}.${format}`;
    } catch (e) {
      return `RETCON_GRID_${Date.now()}.${exportConfig.format}`;
    }
  };

  const downloadGrid = async () => {
    const gridNode = gridRef.current;
    if (!gridNode || isExporting) return;
    
    setIsExporting(true);
    setActiveTileId(null);
    setActiveMode(null);

    try {
      setExportMessage('Optimizing assets...');
      await new Promise(r => setTimeout(r, 600));
      
      const filename = generateFilename();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      setExportMessage('Generating high-res grid...');
      
      // Calculate safe pixel ratio to ensure rendered canvas never exceeds WebKit / iOS Safari limits:
      // 1. Max single dimension: 4096px
      // 2. Max total canvas area: 16,777,216 px (4096 x 4096)
      const elementWidth = gridNode.offsetWidth || 800;
      const elementHeight = gridNode.offsetHeight || elementWidth;
      let targetPixelRatio = isMobile ? 1.5 : 2;

      // Single dimension clamp
      const maxDimension = Math.max(elementWidth, elementHeight);
      if (maxDimension * targetPixelRatio > 4096) {
        targetPixelRatio = Math.min(targetPixelRatio, 4096 / maxDimension);
      }

      // Total area clamp (16,777,216 px max on WebKit / iOS)
      const currentArea = (elementWidth * targetPixelRatio) * (elementHeight * targetPixelRatio);
      if (currentArea > 16777216) {
        targetPixelRatio = Math.min(targetPixelRatio, Math.sqrt(16777216 / (elementWidth * elementHeight)));
      }

      targetPixelRatio = Math.max(1, targetPixelRatio);

      const options = {
        quality: exportConfig.quality,
        pixelRatio: targetPixelRatio,
        backgroundColor: gridColor,
        includeQueryParams: true,
        skipFonts: true, 
        fontEmbedCSS: '', 
        style: {
          transform: 'none',
          borderRadius: '0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        },
        filter: (node: any) => {
          if (!node || !node.tagName) return true;
          const tag = node.tagName.toLowerCase();
          const isHidden = node.getAttribute && node.getAttribute('data-export-hide') === 'true';
          const isButton = tag === 'button';
          const isSvg = tag === 'svg' || (node.classList && node.classList.contains('lucide'));
          const isInput = tag === 'input' || tag === 'textarea';
          
          return !isHidden && !isButton && !isSvg && !isInput;
        }
      };

      let dataUrl = '';
      if (exportConfig.format === 'jpeg') {
        dataUrl = await toJpeg(gridNode, options);
      } else if (exportConfig.format === 'webp') {
        const canvas = await toCanvas(gridNode, options);
        dataUrl = canvas.toDataURL('image/webp', exportConfig.quality);
      } else {
        dataUrl = await toPng(gridNode, options);
      }
      
      setExportMessage('Finalizing file...');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        setIsExporting(false);
      }, 500);
      
    } catch (err: any) {
      console.error('Export Failure:', err);
      const isMemoryOrCORS = /canvas|memory|quota|tainted|security|cross-origin/i.test(err?.message || '');
      const advice = isMemoryOrCORS
        ? 'Rendering was restricted by device memory or an external image CORS limitation. Try using JPEG format or uploading images locally.'
        : (err?.message || 'The canvas could not be rendered.');
      setError(`Export Error: ${advice}`);
      setIsExporting(false);
    }
  };

  const handleBulkPopulate = () => {
    const text = safeString(bulkText);
    const urls = text.split('\n')
      .map(l => safeString(l).trim())
      .filter(l => isValidImageUrl(l));
    
    if (!urls.length) {
      setError('No valid HTTP, HTTPS, or Base64 image URLs found in the pasted list.');
      return;
    }

    urls.slice(0, 9).forEach((url, i) => handleAssignUrl(i, url));
    setIsImportModalOpen(false);
    setBulkText('');
  };

  const handleBulkFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const limitedFiles = files.filter(f => f.type.startsWith('image/')).slice(0, 9);
    if (!limitedFiles.length) return;
    try {
      const dataUrls = await Promise.all(limitedFiles.map(file => optimizeImageFile(file)));
      dataUrls.forEach((url, i) => handleAssignUrl(i, url));
      setIsImportModalOpen(false);
    } catch (err: any) { 
      setError(err?.message || "Failed to process local images."); 
    }
    if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTileId(null);
        setActiveMode(null);
        setIsSettingsOpen(false);
        setIsImportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const navTheme = isDarkMode ? 'bg-black/95 border-zinc-800' : 'bg-white/95 border-zinc-200';
  const mainTheme = isDarkMode ? 'bg-[radial-gradient(circle_at_center,_#0a0a0a_0%,_#000000_100%)]' : 'bg-[#fafafa]';
  const isBulkEmpty = !safeString(bulkText).trim();

  return (
    <div className={`min-h-dvh h-dvh flex flex-col transition-colors duration-500 select-none overflow-hidden font-sans ${isDarkMode ? 'bg-black text-zinc-100' : 'bg-white text-zinc-900'}`}>
      <nav className={`flex items-center justify-between px-4 sm:px-8 py-3 sm:py-6 border-b z-50 shrink-0 backdrop-blur-3xl transition-all duration-500 ${navTheme}`}>
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className={`relative w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-[2px] shadow-2xl transition-all duration-700 group-hover:rotate-90 group-hover:scale-110 ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>
            <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl sm:text-3xl font-[900] tracking-[-0.05em] uppercase transition-all duration-1000 ${isDarkMode ? 'text-shimmer' : 'text-shimmer-light'}`}>RETCON</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={handleClearGrid} 
            className={`p-2 rounded-sm border transition-all hover:text-red-500 active:bg-red-500/10 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-zinc-100 border-zinc-200 text-zinc-400'}`} 
            aria-label="Clear Grid"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-sm border transition-all hover:scale-110 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600'}`} aria-label="Toggle Theme">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className={`p-2 rounded-sm border transition-all hover:rotate-90 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600'}`} aria-label="Settings">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => setIsImportModalOpen(true)} className={`flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase border rounded-sm tracking-widest transition-all ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200'}`}>
            <ClipboardList className="w-4 h-4" /> <span className="hidden md:inline">Bulk Import</span>
          </button>
          <button onClick={downloadGrid} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase rounded-sm tracking-widest shadow-2xl transition-all hover:scale-105 ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>
            <Download className="w-4 h-4" /> <span>Export</span>
          </button>
        </div>
      </nav>

      <main className={`relative flex-grow flex items-center justify-center p-3 sm:p-6 overflow-hidden transition-all duration-1000 ${mainTheme}`}>
        {error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[60] p-4 bg-red-950/80 border border-red-900/50 backdrop-blur-2xl rounded-sm flex items-center gap-4 text-red-50 text-[10px] uppercase font-bold tracking-widest shadow-2xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="flex-grow truncate">{error}</p>
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Redesigned Side Grid Title Control */}
        <GridTitleControl
          gridTitle={gridTitle}
          setGridTitle={setGridTitle}
          showTitleOverlay={showTitleOverlay}
          setShowTitleOverlay={setShowTitleOverlay}
          isDarkMode={isDarkMode}
        />

        <div className="flex items-center justify-center w-full h-full max-h-full" onClick={() => { setActiveTileId(null); setActiveMode(null); }}>
          <div 
            ref={gridRef} 
            className="relative aspect-square w-full max-w-[min(90vw,calc(100dvh-120px))] max-h-[calc(100dvh-120px)] shadow-2xl border overflow-hidden transition-all" 
            style={{ backgroundColor: gridColor, borderColor: isDarkMode ? '#18181b' : '#e4e4e7' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-[1px] h-full" style={{ backgroundColor: gridColor }}>
              {tiles.map(tile => (
                <GridTile
                  key={tile.id} 
                  tile={tile} 
                  isDarkMode={isDarkMode}
                  isLinking={activeTileId === tile.id && activeMode === 'link'}
                  onLocalUpload={handleAssignUrl} 
                  onAssignUrl={handleAssignUrl} 
                  onSwapTiles={handleSwapTiles} 
                  onRemoveImage={handleRemoveImage}
                  onOpenCropModal={(id) => { setActiveTileId(id); setActiveMode('crop'); }}
                  onToggleLink={(id) => { setActiveTileId(id); setActiveMode('link'); }}
                  onClose={() => { setActiveTileId(null); setActiveMode(null); }}
                />
              ))}
            </div>
            {showTitleOverlay && safeString(gridTitle).trim() && (
              <div className={`absolute bottom-0 left-0 right-0 p-3 sm:p-5 pointer-events-none transition-all duration-500 ${isDarkMode ? 'bg-gradient-to-t from-black/80 via-black/40 to-transparent' : 'bg-gradient-to-t from-white/80 via-white/40 to-transparent'}`}>
                <p className={`text-[10px] sm:text-[14px] font-[900] tracking-[0.4em] sm:tracking-[0.8em] text-center uppercase leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {gridTitle}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Export Loading Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-500">
           <div className="flex flex-col items-center gap-8 max-w-xs text-center">
             <div className="relative">
                <div className="absolute inset-0 blur-xl bg-white/20 rounded-full animate-pulse" />
                <Loader2 className="w-16 h-16 text-white animate-spin relative z-10" />
             </div>
             <div className="space-y-3">
               <h3 className="text-xl font-black uppercase tracking-[0.3em] text-white">Exporting</h3>
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 animate-pulse">{exportMessage}</p>
             </div>
             <div className="w-48 h-[1px] bg-zinc-800 overflow-hidden">
                <div className="h-full bg-white w-1/3 animate-[shimmer_2s_infinite]" />
             </div>
           </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
          <div className={`relative w-full max-sm:max-w-none max-w-sm h-full shadow-2xl p-8 border-l flex flex-col gap-8 overflow-y-auto ${isDarkMode ? 'bg-black border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center">
              <h2 className={`text-[12px] font-black uppercase tracking-[0.4em] ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>Export Options</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:rotate-90 transition-all text-zinc-500"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex flex-col gap-8">
              <section className="space-y-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Grid Lines</label>
                <div className="flex flex-wrap gap-2">
                   {['#000000', '#ffffff', '#27272a', '#f5f5f4', '#e11d48'].map((c) => (
                     <button 
                       key={c} onClick={() => setGridColor(c)}
                       className={`w-8 h-8 rounded-full border-2 transition-all ${gridColor === c ? 'border-zinc-400 scale-110' : 'border-transparent scale-90'}`}
                       style={{ backgroundColor: c }}
                     />
                   ))}
                   <div className="relative w-8 h-8 group overflow-hidden rounded-full border-2 border-zinc-800/50">
                     <Palette className="absolute inset-0 m-auto w-4 h-4 pointer-events-none opacity-50" />
                     <input 
                       type="color" value={gridColor} onChange={(e) => setGridColor(e.target.value)}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer scale-150"
                     />
                   </div>
                </div>
              </section>

              <section className="space-y-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>File Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['png', 'jpeg', 'webp'] as ExportFormat[]).map(fmt => (
                    <button 
                      key={fmt} onClick={() => setExportConfig(prev => ({ ...prev, format: fmt }))}
                      className={`py-3 text-[10px] font-black uppercase tracking-widest border rounded-sm transition-all ${exportConfig.format === fmt ? (isDarkMode ? 'bg-white text-black border-white' : 'bg-black text-white border-black') : (isDarkMode ? 'border-zinc-800 text-zinc-500 hover:border-zinc-700' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')}`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Naming Scheme</label>
                <div className="flex flex-col gap-2">
                  {(['DEFAULT', 'TIMESTAMP', 'MINIMAL', 'CHRONO'] as NamingScheme[]).map(scheme => (
                    <button 
                      key={scheme} onClick={() => setExportConfig(prev => ({ ...prev, namingScheme: scheme }))}
                      className={`flex items-center justify-between px-4 py-4 text-[10px] font-black uppercase tracking-widest border rounded-sm transition-all ${exportConfig.namingScheme === scheme ? (isDarkMode ? 'border-white text-white' : 'border-black text-black') : (isDarkMode ? 'border-zinc-800 text-zinc-600' : 'border-zinc-200 text-zinc-400')}`}
                    >
                      {scheme}
                      {exportConfig.namingScheme === scheme && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4 pt-4 border-t border-zinc-800/30">
                 <button 
                   onClick={async () => { if(window.confirm("Delete all saved data and refresh?")) { await RetconStorage.clear(); window.location.reload(); } }}
                   className={`w-full py-3 text-[10px] font-black uppercase tracking-widest border border-dashed rounded-sm transition-all ${isDarkMode ? 'border-zinc-800 text-zinc-600 hover:text-red-500 hover:border-red-900' : 'border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-300'}`}
                 >
                   Reset All App Data
                 </button>
              </section>
            </div>
            
            <div className="mt-auto pt-8 border-t border-zinc-800/50">
              <button onClick={downloadGrid} className={`w-full py-5 text-[11px] font-black uppercase tracking-[0.4em] rounded-sm transition-all shadow-2xl ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>Process Export</button>
            </div>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-hidden">
          <div className={`w-full max-w-2xl max-h-[90vh] border shadow-2xl p-8 rounded-sm overflow-y-auto ${isDarkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-8 sticky top-0 z-10 py-2 bg-inherit">
              <div className="flex items-center gap-4">
                <h2 className={`text-[12px] font-black uppercase tracking-[0.4em] ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>Bulk Import</h2>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:rotate-90 transition-all text-zinc-500"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex flex-col gap-8 pb-4">
              <div className="flex flex-col gap-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Method 1: Local Files</label>
                <button 
                  onClick={() => bulkFileRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed rounded-sm transition-all hover:bg-zinc-900/40 group ${isDarkMode ? 'border-zinc-800 bg-black' : 'border-zinc-200 bg-zinc-50'}`}
                >
                  <ImageIcon className={`w-8 h-8 transition-transform group-hover:scale-110 ${isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Select up to 9 images</span>
                  <input type="file" multiple ref={bulkFileRef} onChange={handleBulkFiles} className="hidden" accept="image/*,.avif,.webp,.heic" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <label className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Method 2: URL List</label>
                <textarea 
                  value={bulkText} onChange={(e) => setBulkText(safeString(e.target.value))}
                  placeholder="Paste one image URL per line..."
                  className={`w-full h-40 p-6 text-[11px] font-mono border rounded-sm focus:outline-none transition-all ${isDarkMode ? 'bg-black border-zinc-800 text-white focus:border-zinc-600' : 'bg-zinc-50 border-zinc-200 text-black focus:border-zinc-400'}`}
                />
                <button 
                  onClick={handleBulkPopulate}
                  disabled={isBulkEmpty}
                  className={`w-full py-5 text-[11px] font-black uppercase tracking-[0.4em] rounded-sm transition-all ${!isBulkEmpty ? (isDarkMode ? 'bg-white text-black' : 'bg-black text-white') : (isDarkMode ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-zinc-100 text-zinc-300 cursor-not-allowed')}`}
                >
                  Populate Grid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Focused Crop Modal (Option A) */}
      {activeMode === 'crop' && activeTileId !== null && (() => {
        const currentTile = tiles.find(t => t.id === activeTileId);
        if (!currentTile || !currentTile.imageUrl) return null;
        return (
          <CropModal
            tile={currentTile}
            isDarkMode={isDarkMode}
            onApply={(transform) => {
              handleUpdateTransform(activeTileId, transform);
              setActiveTileId(null);
              setActiveMode(null);
            }}
            onClose={() => {
              setActiveTileId(null);
              setActiveMode(null);
            }}
          />
        );
      })()}
    </div>
  );
}
