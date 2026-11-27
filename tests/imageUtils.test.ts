import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidImageUrl } from '../utils/imageUtils.ts';

describe('isValidImageUrl', () => {
  it('accepts valid HTTP and HTTPS image URLs', () => {
    assert.equal(isValidImageUrl('https://example.com/photo.jpg'), true);
    assert.equal(isValidImageUrl('http://example.com/image.png?w=800'), true);
    assert.equal(isValidImageUrl('  https://cdn.example.org/pic.webp  '), true);
  });

  it('accepts safe base64 image data URIs', () => {
    assert.equal(isValidImageUrl('data:image/png;base64,iVBORw0KGgo='), true);
    assert.equal(isValidImageUrl('data:image/jpeg;base64,/9j/4AAQ='), true);
    assert.equal(isValidImageUrl('data:image/webp;base64,UklGRh4='), true);
    assert.equal(isValidImageUrl('data:image/heic;base64,AAAA'), true);
  });

  it('rejects unsafe schemes and non-image data URIs', () => {
    assert.equal(isValidImageUrl('javascript:alert(1)'), false);
    assert.equal(isValidImageUrl('file:///etc/passwd'), false);
    assert.equal(isValidImageUrl('data:text/html;base64,PHNjcmlwdD4='), false);
    assert.equal(isValidImageUrl('data:image/png,not-base64'), false);
    assert.equal(isValidImageUrl('ftp://example.com/photo.jpg'), false);
    assert.equal(isValidImageUrl(''), false);
    assert.equal(isValidImageUrl('not a url'), false);
  });
});
