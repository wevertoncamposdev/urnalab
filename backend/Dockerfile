FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Prisma (motor de query) precisa de OpenSSL no Alpine.
RUN apk add --no-cache openssl su-exec

# package.json + prisma/ antes do `npm ci` de propósito: o hook `postinstall`
# (prisma generate) já roda durante o próprio `npm ci` e precisa do schema
# presente nesse momento. Copiar `src` só depois também aproveita melhor o
# cache do Docker (mudar código não invalida a camada de install).
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY src ./src

# Fotos de candidatos continuam em arquivo (o resto dos dados foi para o
# Postgres via Prisma). Sem instrução VOLUME aqui de propósito — o Railway
# rejeita o build com ela (usa Railway Volumes, configurado no dashboard do
# serviço, não no Dockerfile); localmente o docker-compose.yml já declara o
# volume. Sem montar um volume de verdade em /app/data (Railway Volumes ou
# docker-compose), as fotos somem a cada deploy/recriação do container.
RUN mkdir -p /app/data && chown -R node:node /app
ENV DATA_PATH=/app/data

# Volumes externos (Railway Volumes, ou qualquer `docker run -v`) são montados em
# /app/data no runtime, por cima do que foi chown'd ali em build time — e chegam
# com o dono que o provedor define (normalmente root), não "node". Por isso o
# container continua iniciando como root (sem USER aqui): o entrypoint corrige a
# permissão do volume de verdade já montado e só então troca pro usuário "node"
# (via su-exec) antes de rodar o CMD — nenhum processo da aplicação roda como root.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]

# `migrate deploy` só aplica migrações pendentes (idempotente) — seguro rodar
# em todo start do container, antes de abrir a porta. O echo no início não
# imprime a senha — só o tamanho da string, pra diagnosticar "DATABASE_URL
# chega vazia" sem expor segredo nenhum no log.
CMD ["sh", "-c", "echo \"[boot] DATABASE_URL length: ${#DATABASE_URL}\"; echo \"[boot] JWT_SECRET length: ${#JWT_SECRET}\"; npx prisma migrate deploy && node src/server.js"]
