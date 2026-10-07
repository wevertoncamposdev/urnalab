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
