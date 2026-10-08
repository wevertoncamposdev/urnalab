import http from 'node:http';
import { config } from './config.js';
import { createRouter } from './routes/index.js';
import { applyCors } from './middleware/cors.js';
import { handleError } from './middleware/error-handler.js';
import { servePhoto } from './middleware/photo-static.js';
import { checkRateLimit, getClientIp } from './middleware/rate-limit.js';
import { applySecurityHeaders } from './middleware/security-headers.js';
import { readJsonBody, sendError } from './utils/http.js';
import { verifyJwt } from './utils/jwt.js';

const router = createRouter();

async function handleRequest(req, res) {
  if (applyCors(req, res)) return;
  applySecurityHeaders(res);

  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname.startsWith('/photos/')) {
      return servePhoto(res, url.pathname);
    }

    const match = router.match(req.method, url.pathname);

    if (!match) {
      return sendError(res, 404, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }

    if (match.rateLimit) {
      const key = `${req.method}:${url.pathname}:${getClientIp(req)}`;
      const result = checkRateLimit(key, match.rateLimit);
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        return sendError(res, 429, 'RATE_LIMITED', 'Muitas tentativas. Tente de novo em instantes.');
      }
    }

    let userId = null;
    if (!match.public) {
      const authHeader = req.headers.authorization ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const payload = token && verifyJwt(token);
      if (!payload?.sub) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Faça login para continuar.');
      }
      userId = payload.sub;

      // Gate da Área de Gerenciamento (Etapa 16) direto aqui, antes de qualquer
      // handler/controller/service rodar — só compara o e-mail já carimbado no token
      // (ver auth.service.js issueToken) contra ADMIN_EMAIL, sem nenhuma consulta ao
      // banco. Mesmo código/mensagem que admin.service.js sempre usou, pra não mudar o
      // que o frontend recebe.
      if (match.adminOnly) {
        const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
        if (!config.adminEmail || email !== config.adminEmail) {
          return sendError(res, 403, 'ADMIN_ONLY', 'Acesso restrito à administração do sistema.');
        }
      }
    }

    const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method);
    const body = hasBody ? await readJsonBody(req, match.maxBodyBytes ?? undefined) : {};

    await match.handler({
      req,
      res,
      params: match.params,
      query: Object.fromEntries(url.searchParams),
      body,
      userId,
    });
  } catch (error) {
    handleError(res, error);
  }
}

const server = http.createServer(handleRequest);

server.listen(config.port, config.host, () => {
  console.log(`API em http://${config.host}:${config.port}`);
  console.log(`Dados em ${config.dataPath}`);
});
