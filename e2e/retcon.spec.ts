import { test, expect, Locator, Page } from '@playwright/test';

function createPosterDataUri(width: number, height: number): string {
  const bandHeight = Math.floor(height / 3);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="0" y="0" width="${width}" height="${bandHeight}" fill="#ef4444"/>`,
    `<rect x="0" y="${bandHeight}" width="${width}" height="${bandHeight}" fill="#22c55e"/>`,
    `<rect x="0" y="${bandHeight * 2}" width="${width}" height="${height - bandHeight * 2}" fill="#3b82f6"/>`,
    `</svg>`,
  ].join('');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function getNormalizedImageRect(container: Locator, img: Locator) {
  return await container.evaluate((containerEl, imgEl) => {
    const cRect = containerEl.getBoundingClientRect();
    const style = window.getComputedStyle(containerEl);
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const innerLeft = cRect.left + borderLeft;
    const innerTop = cRect.top + borderTop;
    const innerW = containerEl.clientWidth;
    const innerH = containerEl.clientHeight;

    const iRect = (imgEl as HTMLElement).getBoundingClientRect();
    return {
      relLeft: (iRect.left - innerLeft) / innerW,
      relTop: (iRect.top - innerTop) / innerH,
      relWidth: iRect.width / innerW,
      relHeight: iRect.height / innerH,
    };
  }, await img.elementHandle());
}

async function pasteImageIntoTile(page: Page, tileId: number, imageUrl: string) {
  const tile = page.getByTestId(`grid-tile-${tileId}`);
  await tile.hover();
  await page.getByTestId(`tile-link-btn-${tileId}`).click();
  const input = tile.locator('input[type="text"]');
  await input.fill(imageUrl);
  await input.press('Enter');
}

test.describe('RETCON 3x3 E2E', () => {
  test('2:3 movie poster crop alignment matches identically across CropModal, GridTile, mobile resize, and reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const posterUri = createPosterDataUri(600, 900);
    await pasteImageIntoTile(page, 0, posterUri);

    const tile0 = page.getByTestId('grid-tile-0');
    const tileImg = page.getByTestId('grid-tile-img-0');
    await expect(tileImg).toBeVisible();

    // Open CropModal
    await tile0.hover();
    await page.getByTestId('tile-crop-btn-0').click();
    await expect(page.getByTestId('crop-modal')).toBeVisible();

    // Wait for natural image dimensions (Tall badge appears for 2:3 portrait poster)
    await expect(page.getByTestId('crop-snap-top')).toBeVisible();

    // 1. Snap Top (exact top framing of a 2:3 movie poster)
    await page.getByTestId('crop-snap-top').click();
    await page.waitForTimeout(220); // allow 150ms CSS transition to settle

    const modalViewport = page.getByTestId('crop-viewport');
    const modalImg = page.getByTestId('crop-preview-img');
    const modalTopBox = await getNormalizedImageRect(modalViewport, modalImg);

    await page.getByTestId('crop-apply-btn').click();
    await expect(page.getByTestId('crop-modal')).toBeHidden();

    const gridTopBox = await getNormalizedImageRect(tile0, tileImg);
    expect(Math.abs(gridTopBox.relTop - modalTopBox.relTop)).toBeLessThan(0.01);
    expect(Math.abs(gridTopBox.relLeft - modalTopBox.relLeft)).toBeLessThan(0.01);
    expect(Math.abs(gridTopBox.relWidth - modalTopBox.relWidth)).toBeLessThan(0.01);
    expect(Math.abs(gridTopBox.relHeight - modalTopBox.relHeight)).toBeLessThan(0.01);

    // 2. Re-open and drag vertically to a custom mid-upper framing
    await tile0.hover();
    await page.getByTestId('tile-crop-btn-0').click();
    await expect(page.getByTestId('crop-snap-top')).toBeVisible();

    const vpBox = await modalViewport.boundingBox();
    expect(vpBox).not.toBeNull();
    const startX = vpBox!.x + vpBox!.width / 2;
    const startY = vpBox!.y + vpBox!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 45, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(220);

    const modalCustomBox = await getNormalizedImageRect(modalViewport, modalImg);
    await page.getByTestId('crop-apply-btn').click();
    await expect(page.getByTestId('crop-modal')).toBeHidden();

    const gridDesktopCustomBox = await getNormalizedImageRect(tile0, tileImg);
    expect(Math.abs(gridDesktopCustomBox.relTop - modalCustomBox.relTop)).toBeLessThan(0.01);
    expect(Math.abs(gridDesktopCustomBox.relHeight - modalCustomBox.relHeight)).toBeLessThan(0.01);

    // 3. Resize to mobile viewport (much smaller tile width) and verify zero drift
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const gridMobileCustomBox = await getNormalizedImageRect(tile0, tileImg);
    expect(Math.abs(gridMobileCustomBox.relTop - modalCustomBox.relTop)).toBeLessThan(0.01);
    expect(Math.abs(gridMobileCustomBox.relHeight - modalCustomBox.relHeight)).toBeLessThan(0.01);

    // 4. Reload page (IndexedDB persistence) and verify alignment still matches
    await page.reload();
    await expect(tileImg).toBeVisible();
    const gridReloadedBox = await getNormalizedImageRect(tile0, tileImg);
    expect(Math.abs(gridReloadedBox.relTop - modalCustomBox.relTop)).toBeLessThan(0.01);
    expect(Math.abs(gridReloadedBox.relHeight - modalCustomBox.relHeight)).toBeLessThan(0.01);
  });

  test('broken image error state clears when tile is replaced via Bulk Import or removed', async ({ page }) => {
    await page.route('https://images.weserv.nl/**', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/');

    await pasteImageIntoTile(page, 0, 'https://example.invalid/missing-poster.jpg');
    const tile0 = page.getByTestId('grid-tile-0');
    await expect(tile0.getByText('Error')).toBeVisible();

    // Replace via Bulk Import URL list with a valid data URI
    await page.getByRole('button', { name: /Bulk Import/i }).click();
    await page.locator('textarea').fill(createPosterDataUri(400, 600));
    await page.getByRole('button', { name: /Populate Grid/i }).click();

    await expect(tile0.getByText('Error')).toBeHidden();
    await expect(page.getByTestId('grid-tile-img-0')).toBeVisible();
  });

  test('touch viewport hides tile overlay pointer-events until tapped and reveals actions cleanly', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto('/');

    // Load poster via Bulk Import so tile 0 has an image
    await page.getByRole('button', { name: /Bulk Import/i }).click();
    await page.locator('textarea').fill(createPosterDataUri(400, 600));
    await page.getByRole('button', { name: /Populate Grid/i }).click();

    const tile0 = page.getByTestId('grid-tile-0');
    const overlay0 = page.getByTestId('grid-tile-overlay-0');
    await expect(page.getByTestId('grid-tile-img-0')).toBeVisible();

    // Hidden overlay must not capture taps
    await expect(overlay0).toHaveCSS('pointer-events', 'none');

    // First tap reveals actions without accidentally removing or opening crop
    await tile0.tap();
    await expect(overlay0).toHaveCSS('pointer-events', 'auto');
    await expect(page.getByTestId('crop-modal')).toBeHidden();
    await expect(page.getByTestId('grid-tile-img-0')).toBeVisible();

    // Tapping Crop button now opens CropModal cleanly
    await page.getByTestId('tile-crop-btn-0').tap();
    await expect(page.getByTestId('crop-modal')).toBeVisible();

    await context.close();
  });

  test('wheel zoom in CropModal works without passive-listener console errors and respects unified slider bounds', async ({ page }) => {
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto('/');
    await pasteImageIntoTile(page, 0, createPosterDataUri(600, 900));

    await page.getByTestId('grid-tile-0').hover();
    await page.getByTestId('tile-crop-btn-0').click();
    await expect(page.getByTestId('crop-modal')).toBeVisible();

    const slider = page.getByTestId('crop-zoom-slider');
    expect(await slider.getAttribute('min')).toBe('0.4');
    expect(Number(await slider.getAttribute('max'))).toBeGreaterThanOrEqual(6);

    const viewport = page.getByTestId('crop-viewport');
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, -300);

    const zoomedVal = Number(await slider.inputValue());
    expect(zoomedVal).toBeGreaterThan(1);

    const passiveWarnings = consoleWarnings.filter((w) => /passive/i.test(w));
    expect(passiveWarnings).toEqual([]);
  });

  test('export from Settings drawer closes drawer and downloads sanitized filename', async ({ page }) => {
    await page.goto('/');
    await pasteImageIntoTile(page, 0, createPosterDataUri(500, 500));

    // Set grid title
    await page.getByRole('button', { name: /Title/i }).click();
    const titleInput = page.getByPlaceholder('ENTER TITLE...');
    await titleInput.fill('Sci-Fi: Top 9!');
    await titleInput.press('Enter');

    // Open Settings drawer and export
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Export Options')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Process Export/i }).click();

    await expect(page.getByText('Export Options')).toBeHidden();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^RETCON_\d{6}_SCI-FI_TOP_9\.png$/);
  });

  test('16:9 landscape photo zoomed and panned on both axes matches identically between CropModal and GridTile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await pasteImageIntoTile(page, 1, createPosterDataUri(960, 540));
    const tile1 = page.getByTestId('grid-tile-1');
    const tileImg = page.getByTestId('grid-tile-img-1');
    await expect(tileImg).toBeVisible();

    await tile1.hover();
    await page.getByTestId('tile-crop-btn-1').click();
    await expect(page.getByTestId('crop-snap-left')).toBeVisible();

    // Fill, zoom in further so both X and Y panning are active, then drag diagonally
    await page.getByTestId('crop-fill-btn').click();
    await page.getByTestId('crop-zoom-in-btn').click();
    await page.getByTestId('crop-zoom-in-btn').click();
    await page.getByTestId('crop-zoom-in-btn').click();

    const modalViewport = page.getByTestId('crop-viewport');
    const modalImg = page.getByTestId('crop-preview-img');
    const vpBox = await modalViewport.boundingBox();
    expect(vpBox).not.toBeNull();
    const cx = vpBox!.x + vpBox!.width / 2;
    const cy = vpBox!.y + vpBox!.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 55, cy - 25, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(220);

    const modalBox = await getNormalizedImageRect(modalViewport, modalImg);
    await page.getByTestId('crop-apply-btn').click();
    await expect(page.getByTestId('crop-modal')).toBeHidden();

    const gridBox = await getNormalizedImageRect(tile1, tileImg);
    expect(Math.abs(gridBox.relLeft - modalBox.relLeft)).toBeLessThan(0.01);
    expect(Math.abs(gridBox.relTop - modalBox.relTop)).toBeLessThan(0.01);
    expect(Math.abs(gridBox.relWidth - modalBox.relWidth)).toBeLessThan(0.01);
    expect(Math.abs(gridBox.relHeight - modalBox.relHeight)).toBeLessThan(0.01);
  });
});
