import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

// Arquivo fixo de um produto "EBOOK" (ver rules/product-rules.js) — diferente das fotos
// (middleware/photo-static.js), não tem rota pública estática: só é lido depois que
// product.controller.js download confirma que a conta pagou (ver payment.service.js
// isPaid). Ficam em backend/data/products, fora do alcance do servidor de fotos.
const productFileDir = () => path.join(config.dataPath, 'products');

export const productFileStorage = {
  // Usado hoje só pelo seed de desenvolvimento (scripts/seed.js) — a Etapa 16 (upload
  // pelo admin) vai chamar isso de um controller de verdade.
  async save(buffer, extension) {
    const fileKey = `${randomUUID()}.${extension}`;
    await fs.mkdir(productFileDir(), { recursive: true });
    await fs.writeFile(path.join(productFileDir(), fileKey), buffer);
    return fileKey;
  },

  read(fileKey) {
    return fs.readFile(path.join(productFileDir(), fileKey));
  },
};
