export const PRODUCT_KIND = Object.freeze({
  // Acesso ligado a uma sessão (ver payment.service.js scopeForProduct) — o PDF é
  // gerado na hora (reports/results-pdf.js), não existe arquivo fixo.
  SESSION_EXPORT: 'SESSION_EXPORT',
  // Acesso "por conta": libera direto pro userId, sem sessão envolvida. Tem um
  // arquivo fixo (Product.fileKey, ver storage/product-file-storage.js).
  EBOOK: 'EBOOK',
});

// Id fixo (não uuid gerado) do produto "exportação de PDF" — criado pela própria
// migração (ver prisma/migrations/20261007234700_add_products), existe em todo
// ambiente desde a Etapa 12. Referenciado direto por id em vez de consultado por slug
// a cada chamada (payment.service.js getStatus/isPaid/createCheckout/markDownloaded).
export const SESSION_EXPORT_PRODUCT_ID = 'session-export';

// Validação do CRUD de produto pelo admin (Etapa 16.2, ver product.service.js).
export const PRODUCT_LIMITS = Object.freeze({
  nameMaxLength: 120,
  descriptionMaxLength: 500,
});
