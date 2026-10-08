import { productService } from '../services/product.service.js';
import { paymentService } from '../services/payment.service.js';
import { productFileStorage } from '../storage/product-file-storage.js';
import { sendPdfDownload, sendSuccess } from '../utils/http.js';
import { paymentRequired } from '../utils/errors.js';

export const productController = {
  async list({ res }) {
    sendSuccess(res, await productService.listActive());
  },

  async getStatus({ res, params, userId }) {
    sendSuccess(res, await paymentService.getProductStatus(params.id, userId));
  },

  async createCheckout({ res, params, userId }) {
    sendSuccess(res, await paymentService.createProductCheckout(params.id, userId), 201);
  },

  // Produtos "por conta" (ex. ebook) — mesmo gate de pagamento da exportação de PDF
  // (ver result.controller.js downloadPdf), só que lendo um arquivo fixo em disco em
  // vez de gerar o PDF na hora.
  async download({ res, params, userId }) {
    const paid = await paymentService.isProductPaid(params.id, userId);
    if (!paid) {
      throw paymentRequired('PAYMENT_REQUIRED', 'Compre esse produto para baixar o arquivo.');
    }

    const { slug, fileKey } = await productService.getFile(params.id);
    const buffer = await productFileStorage.read(fileKey);
    // Trava do reembolso (ver payment.service.js refund) só é gravada depois que o
    // arquivo foi lido com sucesso — mesmo cuidado de result.controller.js downloadPdf.
    await paymentService.markProductDownloaded(params.id, userId);

    sendPdfDownload(res, buffer, `${slug}.pdf`);
  },

  // Área de Gerenciamento (Etapa 16.2/16.3) — rotas registradas com `adminOnly: true`
  // em admin.routes.js.
  async adminList({ res, userId }) {
    sendSuccess(res, await productService.listAll(userId));
  },

  async adminCreate({ res, userId, body }) {
    sendSuccess(res, await productService.create(body, userId), 201);
  },

  async adminUpdate({ res, userId, params, body }) {
    sendSuccess(res, await productService.update(params.id, body, userId));
  },

  async adminSales({ res, userId, params }) {
    sendSuccess(res, await productService.salesFor(params.id, userId));
  },
};
