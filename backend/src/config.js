import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const isProduction = process.env.NODE_ENV === 'production';

// Sem JWT_SECRET definido, cai num valor fixo de desenvolvimento — tokens emitidos
// assim não devem ser considerados seguros fora da máquina local. Em produção isso
// é um erro fatal: silenciosamente aceitar o segredo padrão permitiria forjar tokens.
const DEV_JWT_SECRET = 'eYuda158Eid3*-4d7a5Oidjel';
if (!process.env.JWT_SECRET) {
  if (isProduction) {
    throw new Error('[config] JWT_SECRET é obrigatório em produção (NODE_ENV=production).');
  }
  console.warn('[config] JWT_SECRET não definido — usando segredo de desenvolvimento (não use em produção).');
}

// Sem DATABASE_URL o Prisma só falharia na primeira query, com um erro confuso.
// Falhar aqui, na subida do processo, deixa o problema óbvio de imediato.
if (!process.env.DATABASE_URL) {
  throw new Error('[config] DATABASE_URL é obrigatório (string de conexão do PostgreSQL).');
}

// Confirmação de e-mail (Etapa 8.1) depende do Resend pra funcionar de ponta a ponta —
// sem essas três, falhar aqui é melhor do que falhar silenciosamente no primeiro cadastro.
for (const name of ['RESEND_API_KEY', 'EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME']) {
  if (!process.env[name]) {
    throw new Error(`[config] ${name} é obrigatório (confirmação de e-mail via Resend).`);
  }
}

// FRONTEND_URL aceita uma ou mais origens separadas por vírgula — por exemplo,
// "http://localhost:5173,http://192.168.0.10:5173" pra liberar o próprio
// computador (localhost) e o celular (IP da rede local) ao mesmo tempo.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  // Railway (e containers em geral) precisam escutar em todas as interfaces —
  // "localhost" dentro do container não é alcançável de fora dele.
  host: process.env.HOST || (isProduction ? '0.0.0.0' : 'localhost'),
  // Só fotos de candidatos ficam em disco agora — o resto dos dados mora no
  // Postgres (ver DATABASE_URL). Em produção, aponte para um volume persistente.
  dataPath: process.env.DATA_PATH
    ? path.resolve(process.env.DATA_PATH)
    : path.join(backendRoot, 'data'),
  allowedOrigins,
  // Primeira origem configurada em FRONTEND_URL — convenção do projeto pra "a URL
  // canônica do frontend", usada pra montar links de e-mail (ver forgotPassword).
  frontendUrl: allowedOrigins[0],
  jwtSecret: process.env.JWT_SECRET || DEV_JWT_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS,
  emailFromName: process.env.EMAIL_FROM_NAME,
  // E-mail da única conta com acesso à Área de Gerenciamento (ver admin.service.js).
  // Sem essa variável, nenhuma conta acessa — não existe um admin "padrão".
  adminEmail: process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : null,
};
