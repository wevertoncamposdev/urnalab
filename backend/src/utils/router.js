// Roteador mínimo: converte "/api/sessions/:id" em regex e extrai os parâmetros.
// `public: true` marca uma rota que não exige login; `rateLimit: { windowMs, max }`
// aplica um limite por IP (ver middleware/rate-limit.js e server.js) — toda rota
// protegida exige login por padrão, nenhuma tem rate limit por padrão.
export class Router {
  #routes = [];

  add(method, pattern, handler, { public: isPublic = false, rateLimit = null } = {}) {
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
      return { handler: route.handler, params, public: route.public, rateLimit: route.rateLimit };
    }
    return null;
  }
}
