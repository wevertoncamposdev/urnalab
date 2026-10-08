import { badRequest } from './errors.js';

const MAX_BODY_BYTES = 1_000_000;

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export const sendSuccess = (res, data, status = 200) =>
  sendJson(res, status, { success: true, data });

export const sendError = (res, status, code, message) =>
  sendJson(res, status, { success: false, error: { code, message } });

export function sendPdfDownload(res, buffer, fileName) {
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': buffer.length,
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store',
  });
  res.end(buffer);
}

// `maxBytes` (Etapa 16, ver utils/router.js `maxBodyBytes`) sobrepõe o teto padrão por
// rota — só rotas com upload de arquivo maior (ex. admin.routes.js produtos) pedem um
// valor maior explicitamente; todo o resto usa MAX_BODY_BYTES.
export async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw badRequest('PAYLOAD_TOO_LARGE', 'O corpo da requisição é grande demais.');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    throw badRequest('INVALID_JSON', 'O corpo da requisição não é um JSON válido.');
  }
}
