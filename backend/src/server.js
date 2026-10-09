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

    // Sempre tenta decodificar o token, mesmo em rota pública (abaixo só rejeita se
    // faltar numa rota que não é `public`) — é o que permite uma rota pública, como a
    // de doação (ver donation.routes.js), saber se quem está doando está logado ou
    // não, sem precisar de duas rotas diferentes pra isso. `verifyJwt` nunca lança,
    // só devolve null num token ausente/inválido/expirado — nenhuma rota pública
    // quebra por causa disso.
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const payload = token ? verifyJwt(token) : null;
    const userId = payload?.sub ?? null;

    if (!match.public) {
      if (!userId) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Faça login para continuar.');
      }

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

        // Segunda camada (Etapa 19): além da conta ser ADMIN_EMAIL, exige um token à
        // parte (header X-Admin-Verification) emitido só depois de confirmar o código
        // mandado por e-mail (ver admin.service.js confirmVerification) — nunca o mesmo
        // token do Authorization acima. `skipAdminVerification` é a saída usada só
        // pelas duas rotas que resolvem esse desafio.
        if (!match.skipAdminVerification) {
          const verificationToken = req.headers['x-admin-verification'];
          const verificationPayload = typeof verificationToken === 'string' ? verifyJwt(verificationToken) : null;
          if (verificationPayload?.scope !== 'admin-verified' || verificationPayload.sub !== userId) {
            return sendError(
              res,
              401,
              'ADMIN_VERIFICATION_REQUIRED',
              'Confirme o código enviado por e-mail para continuar.',
            );
          }
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
