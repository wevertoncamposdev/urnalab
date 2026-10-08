import { randomUUID } from 'node:crypto';
import { adminRepository } from '../repositories/admin.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { PAYMENT_STATUS } from '../rules/payment-rules.js';
import { PRODUCT_KIND, PRODUCT_LIMITS } from '../rules/product-rules.js';
import { badRequest, notFound } from '../utils/errors.js';
import { normalizeText } from '../utils/object.js';

function slugify(name) {
  return normalizeText(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// `partial: true` (update) só valida/inclui no patch os campos que vieram — os que
// faltam mantêm o valor atual do produto, sem precisar reenviar tudo.
function validateProductInput(data, { partial = false } = {}) {
  const patch = {};

  if (!partial || data.name !== undefined) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) throw badRequest('PRODUCT_NAME_REQUIRED', 'Informe o nome do produto.');
    if (name.length > PRODUCT_LIMITS.nameMaxLength) {
      throw badRequest('PRODUCT_NAME_TOO_LONG', `O nome pode ter no máximo ${PRODUCT_LIMITS.nameMaxLength} caracteres.`);
    }
    patch.name = name;
  }

  if (!partial || data.description !== undefined) {
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    if (!description) throw badRequest('PRODUCT_DESCRIPTION_REQUIRED', 'Informe a descrição do produto.');
    if (description.length > PRODUCT_LIMITS.descriptionMaxLength) {
      throw badRequest(
        'PRODUCT_DESCRIPTION_TOO_LONG',
        `A descrição pode ter no máximo ${PRODUCT_LIMITS.descriptionMaxLength} caracteres.`,
      );
    }
    patch.description = description;
  }

  if (!partial || data.priceCents !== undefined) {
    const priceCents = Number(data.priceCents);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      throw badRequest('PRODUCT_PRICE_INVALID', 'Informe um preço válido, em centavos (maior que zero).');
    }
    patch.priceCents = priceCents;
  }

  if (!partial || data.active !== undefined) {
    patch.active = Boolean(data.active);
  }

  return patch;
}

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

  // Daqui pra baixo: Área de Gerenciamento (Etapa 16.2/16.3) — autorização já é
  // garantida pelo router (`adminOnly: true`, ver admin.routes.js) antes de chegar
  // aqui; `userId` só serve pra registrar o acesso (accountability LGPD, mesmo padrão
  // de admin.service.js).
  async listAll(userId) {
    const products = await productRepository.findAll();
    await adminRepository.logAccess(userId, 'LIST_PRODUCTS');
    return products;
  },

  // Upload de arquivo (produto EBOOK) não é feito por aqui ainda — o corpo da
  // requisição tem um teto de 1MB (ver utils/http.js) incompatível com um ebook de
  // verdade, e o roteador do projeto não lê multipart/form-data. Até isso existir,
  // produtos EBOOK continuam cadastrados via seed/banco direto (ver scripts/seed.js);
  // este CRUD cobre nome/descrição/preço/ativo de qualquer produto já existente, e a
  // criação de produtos sem arquivo fixo (ex. um novo SESSION_EXPORT, se um dia existir
  // mais de um).
  async create(input, userId) {
    const kind = PRODUCT_KIND[input?.kind];
    if (!kind) throw badRequest('PRODUCT_KIND_INVALID', 'Tipo de produto inválido.');

    const data = validateProductInput(input ?? {});
    const slug = slugify(data.name);
    if (!slug) throw badRequest('PRODUCT_NAME_REQUIRED', 'Informe um nome que gere uma URL válida.');

    const product = await productRepository.create({ id: randomUUID(), slug, kind, ...data });
    await adminRepository.logAccess(userId, `CREATE_PRODUCT:${product.id}`);
    return product;
  },

  // `kind` e `slug` não são editáveis aqui de propósito: trocar o tipo de um produto já
  // vendido mudaria com que ele libera acesso pra quem já comprou, e o slug pode estar
  // referenciado fora do banco (ver rules/product-rules.js SESSION_EXPORT_PRODUCT_ID).
  async update(productId, input, userId) {
    const existing = await productRepository.findById(productId);
    if (!existing) throw notFound('PRODUCT_NOT_FOUND', 'Produto não encontrado.');

    const data = validateProductInput(input ?? {}, { partial: true });
    const product = await productRepository.update(productId, data);
    await adminRepository.logAccess(userId, `UPDATE_PRODUCT:${productId}`);
    return product;
  },

  // Histórico de vendas (Etapa 16.3) — nenhum dado de quem comprou, só os pagamentos em
  // si (ver paymentRepository.findAllByProduct).
  async salesFor(productId, userId) {
    const product = await productRepository.findById(productId);
    if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Produto não encontrado.');

    const payments = await paymentRepository.findAllByProduct(productId);
    const approved = payments.filter((payment) => payment.status === PAYMENT_STATUS.APPROVED);

    await adminRepository.logAccess(userId, `VIEW_PRODUCT_SALES:${productId}`);

    return {
      product: { id: product.id, slug: product.slug, name: product.name },
      totalSales: approved.length,
      totalRevenueCents: approved.reduce((sum, payment) => sum + payment.amountCents, 0),
      payments: payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        amountCents: payment.amountCents,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
      })),
    };
  },
};
