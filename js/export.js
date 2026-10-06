// Renders assets at the device's physical resolution and packs the .deltaskin (zip) file.
(function (root) {
  'use strict';

  const { buildInfoJson, assetPlan, slug } = root.DeltaSkinJson;
  const { renderSkin, renderThumbstick } = root.DeltaRender;

  function makeCanvas(wPt, hPt, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(wPt * scale);
    canvas.height = Math.round(hPt * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / wPt, canvas.height / hPt);
    return { canvas, ctx };
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG'))), 'image/png'),
    );
  }

  // PDF page sized in points, image embedded at full pixel resolution.
  function canvasToPdf(canvas, wPt, hPt) {
    const { jsPDF } = root.jspdf;
    const pdf = new jsPDF({
      orientation: wPt > hPt ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [wPt, hPt],
      compress: true,
    });
    pdf.addImage(canvas, 'PNG', 0, 0, wPt, hPt, undefined, 'FAST');
    return pdf.output('blob');
  }

  function renderAsset(entry, state, images) {
    const scale = state.device.scale;
    if (entry.type === 'thumbstick') {
      const { width, height } = entry.item.thumbstick;
      const { canvas, ctx } = makeCanvas(width, height, scale);
      renderThumbstick(ctx, Math.min(width, height), state.style);
      return { canvas, wPt: width, hPt: height };
    }
    const orient = state.orientations[entry.orientation];
    const { width, height } = orient.mappingSize;
    const { canvas, ctx } = makeCanvas(width, height, scale);
    renderSkin(ctx, {
      orient,
      orientation: entry.orientation,
      style: state.style,
      bgImage: images[entry.orientation] || null,
      drawControls: orient.drawControls !== false,
      forExport: true,
      title: state.showTitle ? state.name : '',
    });
    return { canvas, wPt: width, hPt: height };
  }

  async function buildFiles(state, images) {
    const files = [];
    for (const entry of assetPlan(state)) {
      const { canvas, wPt, hPt } = renderAsset(entry, state, images);
      const blob = state.assetFormat === 'png' ? await canvasToBlob(canvas) : canvasToPdf(canvas, wPt, hPt);
      files.push({ name: entry.file, blob });
    }
    const info = buildInfoJson(state);
    files.push({ name: 'info.json', blob: new Blob([JSON.stringify(info, null, 2)], { type: 'application/json' }) });
    return files;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Files go at the zip root (no wrapping folder), as Delta requires.
  async function exportDeltaSkin(state, images) {
    const zip = new root.JSZip();
    for (const f of await buildFiles(state, images)) zip.file(f.name, f.blob);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    download(blob, `${slug(state.name)}.deltaskin`);
  }

  function exportInfoJson(state) {
    const info = buildInfoJson(state);
    download(new Blob([JSON.stringify(info, null, 2)], { type: 'application/json' }), 'info.json');
  }

  root.DeltaExport = { exportDeltaSkin, exportInfoJson, download };
})(window);
