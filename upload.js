// This module can be used for watermarking PDFs before upload
const fs = require('fs');
const { PDFDocument, rgb } = require('pdf-lib');

async function addWatermark(inputPath, outputPath, watermarkText) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  pages.forEach(page => {
    page.drawText(watermarkText, {
      x: 50,
      y: 50,
      size: 24,
      color: rgb(0.8, 0.8, 0.8),
      opacity: 0.5,
      rotate: { degrees: 45 },
    });
  });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = { addWatermark };
