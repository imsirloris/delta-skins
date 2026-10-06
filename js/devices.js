// iPhone display presets.
// Resolutions from https://iosref.com/res (logical points, scale, physical pixels).
// Safe-area insets are approximations (points) and can be edited in the UI.
(function (root) {
  'use strict';

  // safeTop = status bar / notch / Dynamic Island inset in portrait.
  // Home indicator inset is 34pt portrait / 21pt landscape on every edge-to-edge iPhone.
  const RAW = [
    // id, name, w, h, scale, pixelW, pixelH, family, safeTop
    ['iphone-17-pro-max', 'iPhone 17 Pro Max / 16 Pro Max (6.9")', 440, 956, 3, 1320, 2868, 'edgeToEdge', 62],
    ['iphone-air', 'iPhone Air (6.5")', 420, 912, 3, 1260, 2736, 'edgeToEdge', 62],
    ['iphone-17-pro', 'iPhone 17 Pro / 17 / 16 Pro (6.3")', 402, 874, 3, 1206, 2622, 'edgeToEdge', 62],
    ['iphone-16', 'iPhone 16 / 15 / 15 Pro / 14 Pro (6.1")', 393, 852, 3, 1179, 2556, 'edgeToEdge', 59],
    ['iphone-16-plus', 'iPhone 16 Plus / 15 Plus / 15 Pro Max / 14 Pro Max (6.7")', 430, 932, 3, 1290, 2796, 'edgeToEdge', 59],
    ['iphone-14-plus', 'iPhone 14 Plus / 13 Pro Max / 12 Pro Max (6.7")', 428, 926, 3, 1284, 2778, 'edgeToEdge', 47],
    ['iphone-16e', 'iPhone 17e / 16e / 14 / 13 / 13 Pro / 12 / 12 Pro (6.1")', 390, 844, 3, 1170, 2532, 'edgeToEdge', 47],
    ['iphone-13-mini', 'iPhone 13 mini / 12 mini (5.4")', 375, 812, 3, 1080, 2340, 'edgeToEdge', 50],
    ['iphone-11-pro-max', 'iPhone 11 Pro Max / XS Max (6.5")', 414, 896, 3, 1242, 2688, 'edgeToEdge', 44],
    ['iphone-11-pro', 'iPhone 11 Pro / XS / X (5.8")', 375, 812, 3, 1125, 2436, 'edgeToEdge', 44],
    ['iphone-11', 'iPhone 11 / XR (6.1")', 414, 896, 2, 828, 1792, 'edgeToEdge', 48],
    ['iphone-8-plus', 'iPhone 8 Plus / 7 Plus / 6s Plus / 6 Plus (5.5")', 414, 736, 3, 1080, 1920, 'standard', 0],
    ['iphone-se3', 'iPhone SE (2nd/3rd gen) / 8 / 7 / 6s / 6 (4.7")', 375, 667, 2, 750, 1334, 'standard', 0],
    ['iphone-se1', 'iPhone SE (1st gen) / 5s / 5c / 5 (4")', 320, 568, 2, 640, 1136, 'standard', 0],
  ];

  function makeDevice(id, name, w, h, scale, pixelW, pixelH, family, safeTop) {
    const edge = family === 'edgeToEdge';
    return {
      id,
      name,
      points: { w, h },
      scale,
      pixels: { w: pixelW, h: pixelH },
      family,
      safe: {
        portrait: { top: safeTop, bottom: edge ? 34 : 0 },
        landscape: { left: safeTop, right: safeTop, bottom: edge ? 21 : 0 },
      },
    };
  }

  const DEVICES = RAW.map((row) => makeDevice(...row));

  function getDevice(id) {
    const device = DEVICES.find((d) => d.id === id);
    return device ? JSON.parse(JSON.stringify(device)) : null;
  }

  // Custom devices default to a typical notch inset when edge-to-edge.
  const CUSTOM_SAFE_TOP = 59;

  function customDevice(w, h, scale, family, safeTop = family === 'edgeToEdge' ? CUSTOM_SAFE_TOP : 0) {
    return makeDevice('custom', 'Custom', w, h, scale, Math.round(w * scale), Math.round(h * scale), family, safeTop);
  }

  const api = { DEVICES, getDevice, customDevice };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeltaDevices = api;
})(typeof window !== 'undefined' ? window : globalThis);
