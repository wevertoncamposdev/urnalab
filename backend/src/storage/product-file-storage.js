import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

// Arquivo fixo de um produto "EBOOK" (ver rules/product-rules.js) — diferente das fotos
// (middleware/photo-static.js), não tem rota pública estática: só é lido depois que
// product.controller.js download confirma que a conta pagou (ver payment.service.js
// isPaid). Ficam em backend/data/products, fora do alcance do servidor de fotos.
const productFileDir = () => path.join(config.dataPath, 'products');

// Hoje só PDF (é o formato de "ebook"/plano de aula) — mesmo espírito de
// photo-storage.js parsePhotoDataUri, mas pra um documento em vez de imagem.
const DATA_URI_PATTERN = /^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/;
const EXTENSION_BY_MIME = { 'application/pdf': 'pdf' };

// Reconhece um arquivo enviado pelo admin (data URI) ainda não salvo em disco — usado
// por product.service.js antes de chamar save() (ver normalizeFile).
export function parseProductFileDataUri(value) {
  const match = typeof value === 'string' ? DATA_URI_PATTERN.exec(value) : null;
  if (!match) return null;
  const [, mime, base64] = match;
  return { extension: EXTENSION_BY_MIME[mime], buffer: Buffer.from(base64, 'base64') };
}

export const productFileStorage = {
  async save(buffer, extension) {
    const fileKey = `${randomUUID()}.${extension}`;
    await fs.mkdir(productFileDir(), { recursive: true });
    await fs.writeFile(path.join(productFileDir(), fileKey), buffer);
    return fileKey;
  },

  read(fileKey) {
    return fs.readFile(path.join(productFileDir(), fileKey));
  },

  // Chamado quando o admin substitui o arquivo de um produto (ver product.service.js
  // update) — sem efeito se `fileKey` for nulo/indefinido, então é seguro chamar sempre.
  async remove(fileKey) {
    if (!fileKey) return;
    await fs.unlink(path.join(productFileDir(), fileKey)).catch(() => {});
  },
};
