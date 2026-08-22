import { describe, expect, it } from 'vitest';
import { responsiveToolImageSource } from './responsive-image';

describe('responsive tool image sources', () => {
  it('uses generated variants only for known local tool assets', () => {
    expect(responsiveToolImageSource('./tool-images/hammer-drill.jpg')).toBe(
      './tool-images/hammer-drill-320.jpg 320w, ./tool-images/hammer-drill-640.jpg 640w, ./tool-images/hammer-drill.jpg 1024w',
    );
    expect(responsiveToolImageSource('/tool-images/hammer-drill.jpg')).toBe(
      '/tool-images/hammer-drill-320.jpg 320w, /tool-images/hammer-drill-640.jpg 640w, /tool-images/hammer-drill.jpg 1024w',
    );
  });

  it('does not invent derivatives for remote, uploaded, or unsupported sources', () => {
    expect(responsiveToolImageSource('https://cdn.example.com/hammer-drill.jpg')).toBeUndefined();
    expect(responsiveToolImageSource('data:image/jpeg;base64,cHJvb2Y=')).toBeUndefined();
    expect(responsiveToolImageSource('./tool-images/hammer-drill.png')).toBeUndefined();
    expect(responsiveToolImageSource('./tool-images/hammer-drill-320.jpg')).toBeUndefined();
  });
});
