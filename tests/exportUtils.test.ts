import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_EXPORT_AREA,
  MAX_EXPORT_DIMENSION,
  calculateSafePixelRatio,
  generateExportFilename,
  resolveExportedFileFormat,
} from '../utils/exportUtils.ts';

describe('generateExportFilename', () => {
  const fixedDate = new Date(2026, 10, 27, 12, 0, 0); // 2026-11-27

  it('formats all four naming schemes cleanly', () => {
    assert.equal(
      generateExportFilename('MY MOVIES', 'DEFAULT', 'png', fixedDate),
      'RETCON_202611_MY_MOVIES.png'
    );
    assert.equal(
      generateExportFilename('MY MOVIES', 'MINIMAL', 'jpeg', fixedDate),
      'MY_MOVIES_3X3.jpeg'
    );
    assert.equal(
      generateExportFilename('MY MOVIES', 'CHRONO', 'webp', fixedDate),
      '20261127_MY_MOVIES.webp'
    );
    assert.equal(
      generateExportFilename('MY MOVIES', 'TIMESTAMP', 'png', fixedDate),
      `GRID_${fixedDate.getTime()}.png`
    );
  });

  it('sanitizes special characters and falls back to UNTITLED when blank', () => {
    assert.equal(
      generateExportFilename('  ../Top 9: Sci-Fi & Noir!! ', 'MINIMAL', 'png', fixedDate),
      'Top_9_Sci-Fi_Noir_3X3.png'
    );
    assert.equal(
      generateExportFilename('   ', 'DEFAULT', 'png', fixedDate),
      'RETCON_202611_UNTITLED.png'
    );
  });
});

describe('calculateSafePixelRatio', () => {
  it('uses 2x on desktop and 1.5x on mobile for typical grid sizes', () => {
    assert.equal(calculateSafePixelRatio(800, 800, false), 2);
    assert.equal(calculateSafePixelRatio(360, 360, true), 1.5);
  });

  it('clamps huge canvases within WebKit 4096px dimension and 16.7M area limits', () => {
    const ratio = calculateSafePixelRatio(3000, 3000, false);
    assert.ok(3000 * ratio <= MAX_EXPORT_DIMENSION + 1e-6);
    assert.ok((3000 * ratio) * (3000 * ratio) <= MAX_EXPORT_AREA + 1);
    assert.ok(ratio >= 1);
  });
});

describe('resolveExportedFileFormat', () => {
  it('keeps requested format when encoded MIME matches', () => {
    assert.equal(resolveExportedFileFormat('webp', 'data:image/webp;base64,AAA'), 'webp');
    assert.equal(resolveExportedFileFormat('jpeg', 'data:image/jpeg;base64,AAA'), 'jpeg');
    assert.equal(resolveExportedFileFormat('png', 'data:image/png;base64,AAA'), 'png');
  });

  it('switches extension to png when browser silently falls back from webp to png', () => {
    assert.equal(resolveExportedFileFormat('webp', 'data:image/png;base64,AAA'), 'png');
  });
});
