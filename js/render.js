// Draws the skin artwork on a canvas. All coordinates are in points; `ctx` must already be
// scaled (points -> pixels) by the caller.
(function (root) {
  'use strict';

  const DEFAULT_STYLE = {
    bg: '#2b2d42',
    bg2: '#1b1c2b',
    bezel: '#111219',
    button: '#3d405b',
    accent: '#ef233c',
    text: '#edf2f4',
    landscapeOpacity: 0.55,
  };

  const ACCENT_INPUTS = new Set(['a', 'b', 'x', 'y', 'c', 'z']);

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, v));
    const r = clamp((n >> 16) + amount);
    const g = clamp(((n >> 8) & 0xff) + amount);
    const b = clamp((n & 0xff) + amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function label(ctx, text, cx, cy, size, color) {
    if (!text) return;
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + size * 0.04);
  }

  function drawDpad(ctx, f, style) {
    const arm = Math.min(f.width, f.height) / 3;
    const cx = f.x + f.width / 2;
    const cy = f.y + f.height / 2;
    ctx.fillStyle = style.button;
    ctx.strokeStyle = shade(style.button, 40);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const r = arm * 0.18;
    roundRect(ctx, f.x, cy - arm / 2, f.width, arm, r);
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, cx - arm / 2, f.y, arm, f.height, r);
    ctx.fill();
    ctx.stroke();
    // Merge the center so the stroke doesn't cross it.
    ctx.fillRect(cx - arm / 2 + 1, cy - arm / 2 + 1, arm - 2, arm - 2);
    ctx.fillStyle = style.text;
    const t = arm * 0.22;
    const tri = (x1, y1, x2, y2, x3, y3) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();
    };
    const off = arm * 1.1;
    tri(cx, cy - off - t, cx - t, cy - off + t * 0.6, cx + t, cy - off + t * 0.6);
    tri(cx, cy + off + t, cx - t, cy + off - t * 0.6, cx + t, cy + off - t * 0.6);
    tri(cx - off - t, cy, cx - off + t * 0.6, cy - t, cx - off + t * 0.6, cy + t);
    tri(cx + off + t, cy, cx + off - t * 0.6, cy - t, cx + off - t * 0.6, cy + t);
  }

  function drawStickBase(ctx, f, style) {
    const cx = f.x + f.width / 2;
    const cy = f.y + f.height / 2;
    const r = Math.min(f.width, f.height) / 2;
    ctx.fillStyle = shade(style.button, -15);
    ctx.strokeStyle = shade(style.button, 40);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = shade(style.button, 20);
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Wide-tracked uppercase label (FlipPad style: MENU / SAVE / LOAD / FFW), no button body.
  function drawTextButton(ctx, item, style) {
    const f = item.frame;
    const text = item.label || '';
    if (!text) return;
    let size = f.height * 0.45;
    const font = (px) => `800 ${px}px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    const tracking = 0.32;
    const measure = () => {
      ctx.font = font(size);
      const chars = [...text].map((c) => ctx.measureText(c).width);
      return { chars, total: chars.reduce((a, b) => a + b, 0) + size * tracking * (chars.length - 1) };
    };
    let m = measure();
    if (m.total > f.width * 0.95) {
      size *= (f.width * 0.95) / m.total;
      m = measure();
    }
    ctx.save();
    ctx.fillStyle = style.text;
    ctx.globalAlpha *= 0.85;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let x = f.x + (f.width - m.total) / 2;
    const y = f.y + f.height / 2 + size * 0.04;
    [...text].forEach((c, i) => {
      ctx.fillText(c, x, y);
      x += m.chars[i] + size * tracking;
    });
    ctx.restore();
  }

  function drawButton(ctx, item, style) {
    const f = item.frame;
    if (item.shape === 'text') return drawTextButton(ctx, item, style);
    const input = Array.isArray(item.inputs) ? item.inputs[0] : '';
    const fill = ACCENT_INPUTS.has(input) ? style.accent : style.button;
    ctx.fillStyle = fill;
    ctx.strokeStyle = shade(fill, 45);
    ctx.lineWidth = 1.5;
    if (item.shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(f.x + f.width / 2, f.y + f.height / 2, f.width / 2 - 1, f.height / 2 - 1, 0, 0, Math.PI * 2);
    } else if (item.shape === 'pill') {
      roundRect(ctx, f.x, f.y, f.width, f.height, f.height / 2);
    } else {
      roundRect(ctx, f.x, f.y, f.width, f.height, Math.min(f.width, f.height) * 0.3);
    }
    ctx.fill();
    ctx.stroke();
    const icon = iconFor(item);
    if (icon) {
      drawIcon(ctx, icon, f.x + f.width / 2, f.y + f.height / 2, Math.min(f.width, f.height) * 0.58, style.text);
      return;
    }
    const size = item.shape === 'pill' ? f.height * 0.42 : Math.min(f.width, f.height) * 0.42;
    label(ctx, item.label, f.x + f.width / 2, f.y + f.height / 2, size, style.text);
  }

  // ---- icons for Delta's app buttons ----------------------------------------
  // Drawn on a 24×24 grid centered at (0, 0), stroked/filled with the text color.

  function arrowHead(ctx, x, y, dx, dy, size) {
    const px = -dy;
    const py = dx;
    ctx.beginPath();
    ctx.moveTo(x + dx * size, y + dy * size);
    ctx.lineTo(x + px * size * 0.8, y + py * size * 0.8);
    ctx.lineTo(x - px * size * 0.8, y - py * size * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  function doubleTriangle(ctx, cy, scale) {
    const s = scale;
    ctx.beginPath();
    ctx.moveTo(-10 * s, cy - 7 * s);
    ctx.lineTo(0, cy);
    ctx.lineTo(-10 * s, cy + 7 * s);
    ctx.closePath();
    ctx.moveTo(0, cy - 7 * s);
    ctx.lineTo(10 * s, cy);
    ctx.lineTo(0, cy + 7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const ICONS = {
    // Hamburger.
    menu(ctx) {
      ctx.beginPath();
      for (const y of [-6, 0, 6]) {
        ctx.moveTo(-8, y);
        ctx.lineTo(8, y);
      }
      ctx.lineWidth = 2.6;
      ctx.stroke();
    },
    // Floppy disk.
    quickSave(ctx) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(5, -9);
      ctx.lineTo(9, -5);
      ctx.lineTo(9, 9);
      ctx.lineTo(-9, 9);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeRect(-5, -9, 9, 6);
      ctx.fillRect(0.5, -7.5, 2, 3);
      ctx.strokeRect(-5.5, 2, 11, 7);
    },
    // Counter-clockwise arrow around a clock: restore the saved state.
    quickLoad(ctx) {
      const r = 8.5;
      const a0 = (200 * Math.PI) / 180;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, a0, a0 + (300 * Math.PI) / 180);
      ctx.stroke();
      const sx = Math.cos(a0) * r;
      const sy = Math.sin(a0) * r;
      // Opposite of the arc's clockwise tangent at its start.
      arrowHead(ctx, sx, sy, Math.sin(a0), -Math.cos(a0), 4);
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(0, 0);
      ctx.lineTo(3.5, 2.5);
      ctx.stroke();
    },
    // ⏩ while held.
    fastForward(ctx) {
      doubleTriangle(ctx, 0, 1);
    },
    // ⏩ above a toggle switch.
    toggleFastForward(ctx) {
      doubleTriangle(ctx, -4, 0.72);
      ctx.lineWidth = 1.7;
      roundRect(ctx, -8, 4.5, 16, 7, 3.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(4.5, 8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    },
  };

  // Labels older projects stored for these buttons; treat them as "use the icon".
  const LEGACY_ICON_LABELS = new Set(['≡', 'QS', 'QL', '»', '»|']);

  function iconFor(item) {
    const input = Array.isArray(item.inputs) && item.inputs.length === 1 ? item.inputs[0] : null;
    if (!input || !ICONS[input]) return null;
    return !item.label || LEGACY_ICON_LABELS.has(item.label) ? ICONS[input] : null;
  }

  function drawIcon(ctx, icon, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    icon(ctx);
    ctx.restore();
  }

  function drawItem(ctx, item, style) {
    if (item.kind === 'touch') return;
    if (item.kind === 'dpad') drawDpad(ctx, item.frame, style);
    else if (item.kind === 'thumbstick') drawStickBase(ctx, item.frame, style);
    else drawButton(ctx, item, style);
  }

  // First free horizontal band below the screens where the skin name fits without touching a control.
  function findTitleY(orient, W, H) {
    const bandW = 160;
    const bandH = 16;
    const x0 = (W - bandW) / 2;
    const start = Math.max(...orient.screens.map((s) => s.outputFrame.y + s.outputFrame.height)) + 10;
    const hits = (y) =>
      orient.items.some((i) => {
        const f = i.frame;
        return i.kind !== 'touch' && f.x < x0 + bandW && x0 < f.x + f.width && f.y < y + bandH && y < f.y + f.height;
      });
    for (let y = start; y + bandH < H; y += 2) {
      if (!hits(y)) return y + bandH / 2;
    }
    return null;
  }

  function drawCover(ctx, img, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  // opts: { orient, orientation, style, bgImage, drawControls, forExport, title }
  function renderSkin(ctx, opts) {
    const { orient, orientation, bgImage } = opts;
    const style = { ...DEFAULT_STYLE, ...opts.style };
    const W = orient.mappingSize.width;
    const H = orient.mappingSize.height;
    const portrait = orientation === 'portrait';

    ctx.save();
    if (bgImage) {
      drawCover(ctx, bgImage, W, H);
    } else if (portrait) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, style.bg);
      grad.addColorStop(1, style.bg2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      for (const s of orient.screens) {
        const f = s.outputFrame;
        const pad = 6;
        ctx.fillStyle = style.bezel;
        roundRect(ctx, f.x - pad, f.y - pad, f.width + pad * 2, f.height + pad * 2, 10);
        ctx.fill();
      }
      const titleY = opts.title ? findTitleY(orient, W, H) : null;
      if (titleY !== null) label(ctx, opts.title, W / 2, titleY, 11, shade(style.bg, 60));
    }

    // Game screens: transparent in the exported asset so the emulator output shows through.
    for (const s of orient.screens) {
      const f = s.outputFrame;
      if (opts.forExport) {
        ctx.clearRect(f.x, f.y, f.width, f.height);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(f.x, f.y, f.width, f.height);
      }
    }

    // Controls last, so landscape overlays stay visible on top of the screen area.
    if (opts.drawControls !== false) {
      ctx.globalAlpha = portrait || bgImage ? 1 : style.landscapeOpacity;
      for (const item of orient.items) drawItem(ctx, item, style);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function renderThumbstick(ctx, size, style) {
    const s = { ...DEFAULT_STYLE, ...style };
    const r = size / 2;
    const grad = ctx.createRadialGradient(r * 0.8, r * 0.7, r * 0.1, r, r, r);
    grad.addColorStop(0, shade(s.button, 50));
    grad.addColorStop(1, s.button);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(s.button, 70);
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.stroke();
  }

  const api = { DEFAULT_STYLE, renderSkin, renderThumbstick, roundRect, ICONS };
  root.DeltaRender = api;
})(window);
