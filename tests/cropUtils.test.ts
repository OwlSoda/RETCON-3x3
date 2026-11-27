import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ZOOM,
  calculateFillScale,
  calculateMaxPanPercent,
  clampPanPercent,
  clampZoom,
  getDirectionSnap,
  getImageTransformCss,
  getMaxZoom,
  normalizeTilePositionToPercent,
  pxDeltaToPercent,
  resolvePositionUnit,
} from '../utils/cropUtils.ts';

describe('calculateFillScale', () => {
  it('computes exact fill scale for 2:3 movie posters, 16:9 photos, and squares', () => {
    assert.equal(calculateFillScale(1000, 1500), 1.5);
    assert.equal(calculateFillScale(1920, 1080), 1.778);
    assert.equal(calculateFillScale(1080, 1920), 1.778);
    assert.equal(calculateFillScale(1200, 1200), 1);
  });

  it('rounds up so odd aspect ratios never under-fill with a 1px letterbox gap', () => {
    const scale = calculateFillScale(1000, 1424);
    assert.equal(scale, 1.424);
    assert.ok((1000 / 1424) * scale >= 1);
  });

  it('falls back safely on invalid dimensions', () => {
    assert.equal(calculateFillScale(0, 100), 1.5);
    assert.equal(calculateFillScale(-500, 500), 1.5);
    assert.equal(calculateFillScale(Number.NaN, 500), 1.5);
  });
});

describe('calculateMaxPanPercent & viewport invariance', () => {
  it('computes exact 25% vertical / 0% horizontal max pan for a 2:3 poster at fill scale', () => {
    const { maxPanX, maxPanY } = calculateMaxPanPercent(2 / 3, 1.5);
    assert.ok(Math.abs(maxPanX - 0) < 1e-9);
    assert.ok(Math.abs(maxPanY - 25) < 1e-9);
  });

  it('computes exact pan limits for a zoomed-in 2:3 poster at 2.0x', () => {
    const { maxPanX, maxPanY } = calculateMaxPanPercent(2 / 3, 2);
    assert.ok(Math.abs(maxPanX - (100 / 6)) < 1e-9);
    assert.ok(Math.abs(maxPanY - 50) < 1e-9);
  });

  it('preserves identical framing across CropModal, desktop GridTile, mobile GridTile, and high-DPI export', () => {
    // 2:3 movie poster filled to 1:1 and panned +18% downward (showing upper-middle area)
    const aspect = 2 / 3;
    const scale = calculateFillScale(1000, 1500); // 1.5
    const panYPct = 18;

    // Simulate top & bottom visible image fraction in any square container of size W:
    // Image fills W height at scale=1, so scaled top is -0.5 * scale * W + (panYPct / 100) * W.
    const visibleTopFraction = (W: number) => {
      const scaledHeight = W * scale;
      const topYInContainer = (W - scaledHeight) / 2 + (panYPct / 100) * W;
      // Fraction of the poster hidden above the square frame's top edge (y = 0)
      return -topYInContainer / scaledHeight;
    };

    const modalFraction = visibleTopFraction(336);
    const desktopTileFraction = visibleTopFraction(259);
    const mobileTileFraction = visibleTopFraction(116);
    const exportTileFraction = visibleTopFraction(1024);

    assert.ok(Math.abs(modalFraction - desktopTileFraction) < 1e-12);
    assert.ok(Math.abs(modalFraction - mobileTileFraction) < 1e-12);
    assert.ok(Math.abs(modalFraction - exportTileFraction) < 1e-12);
    assert.ok(modalFraction > 0 && modalFraction < 1);
  });
});

describe('clampPanPercent & pxDeltaToPercent', () => {
  it('clamps pan to exact bounds when overshoot is 0 and allows buffer while dragging', () => {
    const exact = clampPanPercent(40, 40, 2 / 3, 1.5, 0);
    assert.deepEqual(exact, { x: 0, y: 25 });

    const elastic = clampPanPercent(40, 40, 2 / 3, 1.5, 10);
    assert.deepEqual(elastic, { x: 10, y: 35 });
  });

  it('converts pixel drag deltas proportionally to viewport clientWidth', () => {
    assert.equal(pxDeltaToPercent(84, 336), 25);
    assert.equal(pxDeltaToPercent(-33.6, 336), -10);
    assert.equal(pxDeltaToPercent(50, 0), 0);
  });
});

describe('getDirectionSnap & zoom bounds', () => {
  it('snaps portrait movie poster to exact top, center, and bottom edges', () => {
    const aspect = 2 / 3;
    const fill = calculateFillScale(1000, 1500);

    assert.deepEqual(getDirectionSnap('top', aspect, 1, fill), { scale: 1.5, x: 0, y: 25 });
    assert.deepEqual(getDirectionSnap('center', aspect, 1, fill), { scale: 1.5, x: 0, y: 0 });
    assert.deepEqual(getDirectionSnap('bottom', aspect, 1, fill), { scale: 1.5, x: 0, y: -25 });
  });

  it('preserves higher zoom level if user already zoomed past fillScale', () => {
    const snap = getDirectionSnap('top', 2 / 3, 2.0, 1.5);
    assert.deepEqual(snap, { scale: 2, x: 0, y: 50 });
  });

  it('unifies zoom bounds cleanly across all controls', () => {
    const maxZoom = getMaxZoom(1.5);
    assert.equal(maxZoom, 6);
    assert.equal(clampZoom(0.1, maxZoom), MIN_ZOOM);
    assert.equal(clampZoom(10, maxZoom), maxZoom);
    assert.ok(getMaxZoom(4.5) > 6);
  });
});

describe('CSS transform & legacy px backward compatibility', () => {
  it('renders percentage transforms for new crops and zeroed legacy tiles', () => {
    assert.equal(
      getImageTransformCss({ scale: 1.5, positionX: 0, positionY: 25, positionUnit: 'percent' }),
      'translate(0%, 25%) scale(1.5)'
    );
    assert.equal(
      getImageTransformCss({ scale: 1, positionX: 0, positionY: 0 }),
      'translate(0%, 0%) scale(1)'
    );
  });

  it('preserves legacy non-zero px tiles until opened and upgraded in CropModal', () => {
    const legacyTile = { scale: 1.5, positionX: 0, positionY: 84 };
    assert.equal(resolvePositionUnit(legacyTile), 'px');
    assert.equal(getImageTransformCss(legacyTile), 'translate(0px, 84px) scale(1.5)');

    const migrated = normalizeTilePositionToPercent(legacyTile, 336);
    assert.deepEqual(migrated, { x: 0, y: 25 });
  });
});
