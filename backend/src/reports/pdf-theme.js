import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo arquivo usado em frontend/public/img/urnalab-logo.png (e já reaproveitado
// em email.service.js) — copiado pra dentro de backend/src pra entrar na imagem
// Docker do backend (o Dockerfile só copia `src`, não o projeto `frontend` inteiro).
export const LOGO_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'urnalab-logo.png');

// Mesma paleta de frontend/src/styles/globals.css, repetida em hex puro — mesmo
// precedente de services/email.service.js (PDF também não lê CSS custom properties).
export const COLORS = {
  deepBlue: '#171c3a',
  primary: '#2c3ed9',
  green: '#12795a',
  greenSoft: '#dff3ec',
  accent: '#d98b1f',
  accentSoft: '#fbead0',
  coral: '#e8604c',
  coralSoft: '#fce8dd',
  background: '#f5f6fa',
  foreground: '#161b26',
  muted: '#5c6478',
  mutedSoft: '#eceef4',
  border: '#dfe2ea',
  white: '#ffffff',
};

// Helvetica/Helvetica-Bold são embutidas no PDF (um dos 14 fonts padrão) — cobrem
// todo o português (acentos, "º", "×") sem precisar carregar TTF nenhum.
export const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
};

// A4 com margem de 40pt cada lado = 515.28pt de largura útil para texto/tabelas.
export const PAGE = {
  size: 'A4',
  margins: { top: 110, bottom: 56, left: 40, right: 40 },
  headerHeight: 46,
};

// Marca d'água: a logo tem fundo branco (não transparente) — em opacidade baixa
// sobre a página (também branca) o fundo literalmente some, sobra só uma
// impressão bem fraca do contorno/ícone. Por isso dá pra usar o PNG original,
// sem precisar de uma versão com transparência à parte.
export const WATERMARK_OPACITY = 0.05;

// Larguras de coluna da tabela de ranking — soma bate com a largura útil (515.28pt).
export const RANKING_COLUMNS = {
  rank: 20,
  photo: 30,
  name: 170.28,
  party: 70,
  number: 40,
  votes: 50,
  percent: 45,
  bar: 90,
};
