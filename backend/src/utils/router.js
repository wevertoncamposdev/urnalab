// Roteador mínimo: converte "/api/sessions/:id" em regex e extrai os parâmetros.
// `public: true` marca uma rota que não exige login; `rateLimit: { windowMs, max }`
// aplica um limite por IP (ver middleware/rate-limit.js e server.js) — toda rota
// protegida exige login por padrão, nenhuma tem rate limit por padrão. `adminOnly: true`
// (Etapa 16) exige que o e-mail do token bata com ADMIN_EMAIL (ver server.js) — rejeitado
// ali mesmo, antes do handler/controller/service rodarem, sem nenhuma consulta ao banco.
// Toda rota `adminOnly` também exige o código de verificação por e-mail (Etapa 19), a não
// ser que marque `skipAdminVerification: true` — só as duas rotas que resolvem esse
// próprio desafio (POST /api/admin/verify/request e /confirm) usam essa saída.
// `maxBodyBytes` sobrepõe o teto padrão do corpo da requisição (ver utils/http.js) — só
// rotas com upload de arquivo maior (ex. produtos com capa/ebook) precisam disso.
export class Router {
  #routes = [];

  add(
    method,
    pattern,
    handler,
    {
      public: isPublic = false,
      rateLimit = null,
      adminOnly = false,
      skipAdminVerification = false,
      maxBodyBytes = null,
    } = {},
  ) {
    const keys = [];
    const source = pattern.replace(/:([A-Za-z]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.#routes.push({
      method,
      regex: new RegExp(`^${source}/?$`),
      keys,
      handler,
      public: isPublic,
      rateLimit,
      adminOnly,
      skipAdminVerification,
      maxBodyBytes,
    });
  }

  get(pattern, handler, options) { this.add('GET', pattern, handler, options); }
  post(pattern, handler, options) { this.add('POST', pattern, handler, options); }
  put(pattern, handler, options) { this.add('PUT', pattern, handler, options); }
  delete(pattern, handler, options) { this.add('DELETE', pattern, handler, options); }

  match(method, pathname) {
    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const found = route.regex.exec(pathname);
      if (!found) continue;

      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(found[i + 1]);
      });
      return {
        handler: route.handler,
        params,
        public: route.public,
        rateLimit: route.rateLimit,
        adminOnly: route.adminOnly,
        skipAdminVerification: route.skipAdminVerification,
        maxBodyBytes: route.maxBodyBytes,
      };
    }
    return null;
  }
}
