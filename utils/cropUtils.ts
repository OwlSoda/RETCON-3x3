import type { PositionUnit, TileData } from '../types';

export const MIN_ZOOM = 0.4;
export const DEFAULT_MAX_ZOOM = 6;
export const DRAG_OVERSHOOT_PERCENT = 10;
export const LEGACY_MODAL_REFERENCE_PX = 336;

export type SnapDirection = 'top' | 'bottom' | 'left' | 'right' | 'center';

/**
 * Calculates the exact scale required so an image with `naturalWidth x naturalHeight`
 * completely fills a 1:1 square viewport without leaving letterbox bars.
 * Rounds up to 3 decimal places so subpixel rounding never leaves a 1px gap.
 */
export function calculateFillScale(naturalWidth: number, naturalHeight: number): number {
  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
    return 1.5;
  }
  const aspect = naturalWidth / naturalHeight;
  const raw = Math.max(aspect, 1 / aspect);
  return Math.ceil(raw * 1000) / 1000;
}

/**
 * Returns a consistent maximum zoom bound across slider, wheel, pinch, and +/- buttons.
 */
export function getMaxZoom(fillScale: number): number {
  const safeFill = Number.isFinite(fillScale) && fillScale > 0 ? fillScale : 1.5;
  return Math.max(DEFAULT_MAX_ZOOM, Math.ceil(safeFill * 1.6 * 10) / 10);
}

/**
 * Clamps a zoom scale value within [MIN_ZOOM, maxZoom].
 */
export function clampZoom(scale: number, maxZoom = DEFAULT_MAX_ZOOM): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(maxZoom, Math.max(MIN_ZOOM, Number(scale.toFixed(3))));
}

/**
 * Computes the maximum horizontal and vertical pan offsets as a percentage of the
 * square viewport size (0..N%), independent of rendered pixel dimensions.
 *
 * Because the <img> fills 100% x 100% of its square container with `object-contain`,
 * `translate(x%, y%) scale(s)` produces identical framing across CropModal, GridTile,
 * mobile/desktop viewports, and high-DPI exports.
 */
export function calculateMaxPanPercent(aspect: number, scale: number): { maxPanX: number; maxPanY: number } {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  const baseWRatio = safeAspect >= 1 ? 1 : safeAspect;
  const baseHRatio = safeAspect >= 1 ? 1 / safeAspect : 1;

  const visualWRatio = baseWRatio * safeScale;
  const visualHRatio = baseHRatio * safeScale;

  return {
    maxPanX: Math.max(0, ((visualWRatio - 1) / 2) * 100),
    maxPanY: Math.max(0, ((visualHRatio - 1) / 2) * 100),
  };
}

/**
 * Clamps percentage pan coordinates to exact image edges (or with elastic overshoot while dragging).
 */
export function clampPanPercent(
  xPercent: number,
  yPercent: number,
  aspect: number,
  scale: number,
  overshootPercent = 0
): { x: number; y: number } {
  const { maxPanX, maxPanY } = calculateMaxPanPercent(aspect, scale);
  const limitX = maxPanX + Math.max(0, overshootPercent);
  const limitY = maxPanY + Math.max(0, overshootPercent);

  const safeX = Number.isFinite(xPercent) ? xPercent : 0;
  const safeY = Number.isFinite(yPercent) ? yPercent : 0;

  return {
    x: Number(Math.max(-limitX, Math.min(limitX, safeX)).toFixed(4)),
    y: Number(Math.max(-limitY, Math.min(limitY, safeY)).toFixed(4)),
  };
}

/**
 * Converts a pointer drag delta in CSS pixels into a percentage of the square viewport's inner width.
 */
export function pxDeltaToPercent(deltaPx: number, viewportInnerWidthPx: number): number {
  if (!Number.isFinite(deltaPx) || !Number.isFinite(viewportInnerWidthPx) || viewportInnerWidthPx <= 0) {
    return 0;
  }
  return (deltaPx / viewportInnerWidthPx) * 100;
}

/**
 * Computes the scale and percentage pan position for directional quick-snaps.
 */
export function getDirectionSnap(
  dir: SnapDirection,
  aspect: number,
  currentScale: number,
  fillScale: number
): { scale: number; x: number; y: number } {
  const targetScale = Math.max(currentScale, fillScale);
  const { maxPanX, maxPanY } = calculateMaxPanPercent(aspect, targetScale);

  switch (dir) {
    case 'top':
      return { scale: targetScale, x: 0, y: Number(maxPanY.toFixed(4)) };
    case 'bottom':
      return { scale: targetScale, x: 0, y: Number((-maxPanY).toFixed(4)) };
    case 'left':
      return { scale: targetScale, x: Number(maxPanX.toFixed(4)), y: 0 };
    case 'right':
      return { scale: targetScale, x: Number((-maxPanX).toFixed(4)), y: 0 };
    case 'center':
    default:
      return { scale: targetScale, x: 0, y: 0 };
  }
}

/**
 * Resolves the effective CSS unit for a tile's stored position, maintaining backward
 * compatibility with legacy IndexedDB tiles saved in raw pixels before `positionUnit` existed.
 */
export function resolvePositionUnit(
  tile: Pick<TileData, 'positionX' | 'positionY' | 'positionUnit'>
): PositionUnit {
  if (tile.positionUnit === 'percent' || tile.positionUnit === 'px') {
    return tile.positionUnit;
  }
  const x = tile.positionX || 0;
  const y = tile.positionY || 0;
  return x === 0 && y === 0 ? 'percent' : 'px';
}

/**
 * Builds the CSS transform string shared between CropModal and GridTile.
 */
export function getImageTransformCss(
  tile: Pick<TileData, 'scale' | 'positionX' | 'positionY' | 'positionUnit'>
): string {
  const x = Number.isFinite(tile.positionX) ? tile.positionX : 0;
  const y = Number.isFinite(tile.positionY) ? tile.positionY : 0;
  const scale = Number.isFinite(tile.scale) && tile.scale > 0 ? tile.scale : 1;
  const unit = resolvePositionUnit(tile) === 'percent' ? '%' : 'px';
  return `translate(${x}${unit}, ${y}${unit}) scale(${scale})`;
}

/**
 * Normalizes a tile's position into viewport-relative percentages when opening CropModal.
 * Legacy `px`-based tiles are converted relative to the modal's inner width so re-saving upgrades them cleanly.
 */
export function normalizeTilePositionToPercent(
  tile: Pick<TileData, 'positionX' | 'positionY' | 'positionUnit'>,
  referenceViewportPx = LEGACY_MODAL_REFERENCE_PX
): { x: number; y: number } {
  const x = Number.isFinite(tile.positionX) ? tile.positionX : 0;
  const y = Number.isFinite(tile.positionY) ? tile.positionY : 0;
  if (resolvePositionUnit(tile) === 'percent') {
    return { x, y };
  }
  const refSize = Number.isFinite(referenceViewportPx) && referenceViewportPx > 0
    ? referenceViewportPx
    : LEGACY_MODAL_REFERENCE_PX;
  return {
    x: Number(((x / refSize) * 100).toFixed(4)),
    y: Number(((y / refSize) * 100).toFixed(4)),
  };
}
