import { resultService } from '../services/result.service.js';
import { resultsReportService } from '../services/results-report.service.js';
import { renderResultsPdf } from '../reports/results-pdf.js';
import { sendPdfDownload, sendSuccess } from '../utils/http.js';

export const resultController = {
  async get({ res, params, userId }) {
    sendSuccess(res, await resultService.getBySession(params.id, userId));
  },

  async createRunoffSession({ res, params, userId }) {
    sendSuccess(res, await resultService.createRunoffSession(params.id, userId), 201);
  },

  async downloadPdf({ res, params, userId }) {
    const report = await resultsReportService.build(params.id, userId);
    const buffer = await renderResultsPdf(report);
    sendPdfDownload(res, buffer, report.fileName);
  },
};
