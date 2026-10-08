import PDFDocument from 'pdfkit';

// PDF de uma página só, usado hoje só pelo seed de desenvolvimento (scripts/seed.js)
// pra ter um arquivo de verdade por trás de um produto EBOOK de demonstração (Etapa
// 15.3) — o conteúdo real do material (texto, plano de aula) é decisão de conteúdo,
// fora do escopo deste gerador.
export function buildPlaceholderPdf(title, body) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 72, bottom: 72, left: 72, right: 72 } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text(title, { align: 'left' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#555').text(body);
    doc.end();
  });
}
