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

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[exponent]}`;
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(Math.round(totalSeconds ?? 0), 0);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min`;
  return `${seconds}s`;
}
