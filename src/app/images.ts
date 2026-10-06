// Background images: reading uploads and decoding the data URLs stored in the project.

import type { OrientationMap } from '../types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Decodes every stored background by orientation; ones that fail are dropped from `bgImages`.
async function loadImages(bgImages: OrientationMap<string>): Promise<OrientationMap<HTMLImageElement>> {
  const images: OrientationMap<HTMLImageElement> = {};
  for (const [orientation, src] of Object.entries(bgImages || {}) as [keyof typeof bgImages, string][]) {
    try {
      images[orientation] = await loadImage(src);
    } catch (_) {
      delete bgImages[orientation];
    }
  }
  return images;
}

export { loadImage, readFileAsDataUrl, loadImages };
