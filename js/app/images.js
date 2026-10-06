// Background images: reading uploads and decoding the data URLs stored in the project.
(function (root) {
  'use strict';

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // Decodes every stored background by orientation; ones that fail are dropped from `bgImages`.
  async function loadImages(bgImages) {
    const images = {};
    for (const [orientation, src] of Object.entries(bgImages || {})) {
      try {
        images[orientation] = await loadImage(src);
      } catch (_) {
        delete bgImages[orientation];
      }
    }
    return images;
  }

  root.DeltaImages = { loadImage, readFileAsDataUrl, loadImages };
})(window);
