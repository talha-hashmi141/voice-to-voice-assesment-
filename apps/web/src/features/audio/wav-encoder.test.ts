import { describe, expect, it } from 'vitest';
import { encodeWav, rmsLevel } from './wav-encoder';

describe('encodeWav', () => {
  it('writes a valid 16-bit mono PCM header and clamps samples', () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 2, -2]), 16_000);
    const view = new DataView(wav);
    expect(String.fromCharCode(...new Uint8Array(wav.slice(0, 4)))).toBe('RIFF');
    expect(String.fromCharCode(...new Uint8Array(wav.slice(8, 12)))).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(44 + 2, true)).toBe(Math.round(0.5 * 0x7fff));
    expect(view.getInt16(44 + 6, true)).toBe(0x7fff);
    expect(view.getInt16(44 + 8, true)).toBe(-0x8000);
  });
});

describe('rmsLevel', () => {
  it('is 0 for silence and grows with amplitude up to 1', () => {
    expect(rmsLevel(new Float32Array(100))).toBe(0);
    expect(rmsLevel(new Float32Array(100).fill(0.1))).toBeCloseTo(0.4, 5);
    expect(rmsLevel(new Float32Array(100).fill(1))).toBe(1);
  });
});
