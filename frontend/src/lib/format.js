export const formatNumber = (value) => Number(value ?? 0).toLocaleString('pt-BR');

export const pluralize = (count, singular, plural) =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`;

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export const shortHash = (hash) => (hash ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : '—');

export const formatCents = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
