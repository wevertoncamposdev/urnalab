import { productRepository } from '../repositories/product.repository.js';
import { notFound } from '../utils/errors.js';

export const productService = {
  // Catálogo da loja (Etapa 15.3) — só campos públicos; `fileKey` nunca sai daqui
  // (ver product.controller.js download, que resolve o arquivo só depois de confirmar
  // que a conta pagou).
  async listActive() {
    const products = await productRepository.findActive();
    return products.map(({ id, slug, name, description, kind, priceCents }) => ({
      id,
      slug,
      name,
      description,
      kind,
      priceCents,
    }));
  },

  // Resolve o arquivo fixo de um produto "EBOOK" — chamado só depois que o controller
  // já confirmou que a conta pagou (ver product.controller.js download; paymentService.
  // isProductPaid é o gate, não isso aqui).
  async getFile(productId) {
    const product = await productRepository.findById(productId);
    if (!product?.fileKey) {
      throw notFound('PRODUCT_FILE_NOT_FOUND', 'Arquivo do produto não encontrado.');
    }
    return { slug: product.slug, fileKey: product.fileKey };
  },
};
