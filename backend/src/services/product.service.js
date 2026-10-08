import { randomUUID } from 'node:crypto';
import { adminRepository } from '../repositories/admin.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { PAYMENT_STATUS } from '../rules/payment-rules.js';
import { PRODUCT_FILE_LIMITS, PRODUCT_KIND, PRODUCT_LIMITS } from '../rules/product-rules.js';
import { isStoredPhotoPath, parsePhotoDataUri, photoStorage } from '../storage/photo-storage.js';
import { parseProductFileDataUri, productFileStorage } from '../storage/product-file-storage.js';
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

// Capa pública (Etapa 16) — mesmo contrato de Person.photo (ver person.service.js
// normalizePhoto): aceita um link http(s) externo, um caminho já salvo (edição sem
// trocar a imagem), ou uma imagem nova em data URI (decodificada e gravada como foto
// comum — ver storage/photo-storage.js). `null`/string vazia remove a capa.
async function resolveCoverImage(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw badRequest('PRODUCT_COVER_IMAGE_INVALID', 'A capa deve ser um endereço http(s) ou uma imagem enviada.');
  }

  if (isStoredPhotoPath(value)) return value;

  const dataUri = parsePhotoDataUri(value);
  if (dataUri) {
    if (!dataUri.extension) throw badRequest('PRODUCT_COVER_IMAGE_INVALID', 'Formato de imagem não suportado.');
    if (dataUri.buffer.length > PRODUCT_FILE_LIMITS.coverImageMaxBytes) {
      throw badRequest('PRODUCT_COVER_IMAGE_TOO_LARGE', 'A imagem da capa é grande demais.');
    }
    return photoStorage.save(dataUri.buffer, dataUri.extension);
  }

  const url = value.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw badRequest('PRODUCT_COVER_IMAGE_INVALID', 'A capa deve ser um endereço http(s) válido ou uma imagem enviada.');
  }
  return url;
}

// Arquivo do produto EBOOK (Etapa 16) — ao contrário da capa, só aceita upload (data
// URI): o conteúdo pago não faz sentido como link externo, já que o gate de pagamento
// (ver product.controller.js download) só protege arquivo que a gente mesmo guarda.
async function resolveFile(value) {
  const dataUri = parseProductFileDataUri(value);
  if (!dataUri?.extension) {
    throw badRequest('PRODUCT_FILE_INVALID', 'Envie um arquivo PDF válido.');
  }
  if (dataUri.buffer.length > PRODUCT_FILE_LIMITS.ebookMaxBytes) {
    throw badRequest('PRODUCT_FILE_TOO_LARGE', 'O arquivo enviado é grande demais.');
  }
  return productFileStorage.save(dataUri.buffer, dataUri.extension);
}

export const productService = {
  // Catálogo da loja (Etapa 15.3) — só campos públicos; `fileKey` nunca sai daqui
  // (ver product.controller.js download, que resolve o arquivo só depois de confirmar
  // que a conta pagou). `coverImage` é pública de propósito: é a pré-visualização do
  // produto antes de comprar.
  async listActive() {
    const products = await productRepository.findActive();
    return products.map(({ id, slug, name, description, kind, priceCents, coverImage }) => ({
      id,
      slug,
      name,
      description,
      kind,
      priceCents,
      coverImage,
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

  async create(input, userId) {
    const kind = PRODUCT_KIND[input?.kind];
    if (!kind) throw badRequest('PRODUCT_KIND_INVALID', 'Tipo de produto inválido.');

    const data = validateProductInput(input ?? {});
    const slug = slugify(data.name);
    if (!slug) throw badRequest('PRODUCT_NAME_REQUIRED', 'Informe um nome que gere uma URL válida.');

    data.coverImage = await resolveCoverImage(input?.coverImage);

    // Só EBOOK tem arquivo fixo (ver rules/product-rules.js) — sem ele não tem o que
    // vender; SESSION_EXPORT gera o PDF na hora (reports/results-pdf.js), não precisa.
    if (kind === PRODUCT_KIND.EBOOK) {
      if (!input?.file) throw badRequest('PRODUCT_FILE_REQUIRED', 'Envie o arquivo do produto.');
      data.fileKey = await resolveFile(input.file);
    }

    const product = await productRepository.create({ id: randomUUID(), slug, kind, ...data });
    await adminRepository.logAccess(userId, `CREATE_PRODUCT:${product.id}`);
    return product;
  },

  // `kind` e `slug` não são editáveis aqui de propósito: trocar o tipo de um produto já
  // vendido mudaria com que ele libera acesso pra quem já comprou, e o slug pode estar
  // referenciado fora do banco (ver rules/product-rules.js SESSION_EXPORT_PRODUCT_ID).
  // `coverImage`/`file` só entram no patch quando vêm na requisição — omitir mantém o
  // que já existe (mesmo contrato de validateProductInput no modo parcial).
  async update(productId, input, userId) {
    const existing = await productRepository.findById(productId);
    if (!existing) throw notFound('PRODUCT_NOT_FOUND', 'Produto não encontrado.');

    const data = validateProductInput(input ?? {}, { partial: true });

    if (input?.coverImage !== undefined) {
      data.coverImage = await resolveCoverImage(input.coverImage);
    }

    if (input?.file !== undefined) {
      if (existing.kind !== PRODUCT_KIND.EBOOK) {
        throw badRequest('PRODUCT_FILE_NOT_ALLOWED', 'Esse tipo de produto não tem arquivo fixo.');
      }
      data.fileKey = await resolveFile(input.file);
    }

    const product = await productRepository.update(productId, data);

    // Só apaga o arquivo antigo depois que a atualização é confirmada, e só quando o
    // valor realmente mudou (mesmo cuidado de person.service.js update).
    if ('coverImage' in data && existing.coverImage && existing.coverImage !== data.coverImage) {
      await photoStorage.remove(existing.coverImage);
    }
    if ('fileKey' in data && existing.fileKey && existing.fileKey !== data.fileKey) {
      await productFileStorage.remove(existing.fileKey);
    }

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
