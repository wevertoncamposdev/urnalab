import { resultService } from '../services/result.service.js';
import { resultsReportService } from '../services/results-report.service.js';
import { paymentService } from '../services/payment.service.js';
import { renderResultsPdf } from '../reports/results-pdf.js';
import { sendPdfDownload, sendSuccess } from '../utils/http.js';
import { paymentRequired } from '../utils/errors.js';

export const resultController = {
  async get({ res, params, userId }) {
    sendSuccess(res, await resultService.getBySession(params.id, userId));
  },

  async createRunoffSession({ res, params, userId }) {
    sendSuccess(res, await resultService.createRunoffSession(params.id, userId), 201);
  },

  async downloadPdf({ res, params, userId }) {
    const paid = await paymentService.isPaid(params.id, userId);
    if (!paid) {
      throw paymentRequired('PAYMENT_REQUIRED', 'Pague pela exportação para baixar o PDF desta sessão.');
    }
    // Trava do reembolso (ver payment.service.js refund): a partir do primeiro download,
    // essa cobrança não pode mais ser reembolsada.
    await paymentService.markDownloaded(params.id, userId);

    const report = await resultsReportService.build(params.id, userId);
    const buffer = await renderResultsPdf(report);
    sendPdfDownload(res, buffer, report.fileName);
  },
};
