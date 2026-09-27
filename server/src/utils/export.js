import PDFDocument from 'pdfkit';

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** sections: [{ title, headers, rows }] — written one after another in a single CSV */
export function sendCSV(res, filename, sections) {
  const lines = [];
  sections.forEach((sec, i) => {
    if (i > 0) lines.push('');
    if (sec.title) lines.push(csvCell(sec.title));
    lines.push(sec.headers.map(csvCell).join(','));
    sec.rows.forEach((r) => lines.push(r.map(csvCell).join(',')));
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + lines.join('\r\n'));
}

/**
 * Renders a simple report PDF.
 * opts: { title, subtitle, meta: [[label, value]], sections: [{ title, headers, rows, widths? }] }
 */
export function sendPDF(res, filename, opts) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: opts.landscape ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageW = doc.page.width - 80;
  const ink = '#1f2328';
  const muted = '#6b6f76';

  doc.fillColor(ink).font('Helvetica-Bold').fontSize(18).text(opts.title);
  if (opts.subtitle) doc.moveDown(0.2).font('Helvetica').fontSize(10).fillColor(muted).text(opts.subtitle);
  doc.moveDown(0.6);

  if (opts.meta?.length) {
    doc.fontSize(10);
    for (const [label, value] of opts.meta) {
      doc.font('Helvetica-Bold').fillColor(ink).text(`${label}: `, { continued: true }).font('Helvetica').text(String(value ?? '-'));
    }
    doc.moveDown(0.8);
  }

  for (const sec of opts.sections || []) {
    ensureSpace(doc, 60);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(ink).text(sec.title, 40);
    doc.moveDown(0.4);
    drawTable(doc, sec.headers, sec.rows, sec.widths || sec.headers.map(() => pageW / sec.headers.length));
    doc.moveDown(1);
  }

  doc.fontSize(8).fillColor(muted).text(`Generated on ${new Date().toLocaleString('en-GB')}`, 40, doc.page.height - 50, { lineBreak: false });
  doc.end();
}

function ensureSpace(doc, h) {
  if (doc.y + h > doc.page.height - 60) doc.addPage();
}

function drawTable(doc, headers, rows, widths) {
  const x0 = 40;
  const pad = 4;
  const drawRow = (cells, { bold = false, fill = null } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    const heights = cells.map((c, i) => doc.heightOfString(String(c ?? ''), { width: widths[i] - pad * 2 }));
    const h = Math.max(...heights) + pad * 2;
    if (doc.y + h > doc.page.height - 60) {
      doc.addPage();
      if (!bold) drawRow(headers, { bold: true, fill: '#eef1f5' });
    }
    const y = doc.y;
    const totalW = widths.reduce((a, b) => a + b, 0);
    if (fill) doc.rect(x0, y, totalW, h).fill(fill);
    doc.moveTo(x0, y + h).lineTo(x0 + totalW, y + h).lineWidth(0.5).strokeColor('#d6d9de').stroke();
    let x = x0;
    cells.forEach((c, i) => {
      doc.fillColor('#1f2328').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
        .text(String(c ?? ''), x + pad, y + pad, { width: widths[i] - pad * 2 });
      x += widths[i];
    });
    doc.y = y + h;
  };
  drawRow(headers, { bold: true, fill: '#eef1f5' });
  if (!rows.length) drawRow(['No records', ...headers.slice(1).map(() => '')]);
  rows.forEach((r) => drawRow(r));
  doc.x = x0;
}
