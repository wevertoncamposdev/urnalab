import { institutionProfileRepository } from '../repositories/institution-profile.repository.js';
import { photoStorage } from '../storage/photo-storage.js';
import { normalizeText } from '../utils/object.js';
import { resultService } from './result.service.js';

// Só caminho local .jpg/.png embute no PDF — pdfkit só decodifica esses dois formatos.
// .webp e URL remota (e caminho local ausente) caem pro monograma no renderer.
const LOCAL_JPEG_OR_PNG_PATTERN = /^\/photos\/([0-9a-f-]+\.(?:jpg|png))$/i;

// Cacheada por caminho de foto, já que a mesma pessoa pode concorrer em vários cargos
// (cada candidatura é um registro separado, mas aponta pro mesmo arquivo).
async function resolvePhotoAsset(photo, cache) {
  const match = LOCAL_JPEG_OR_PNG_PATTERN.exec(photo ?? '');
  if (!match) return { kind: 'monogram' };

  if (cache.has(photo)) return cache.get(photo);

  const asset = await photoStorage
    .read(match[1])
    .then((buffer) => ({ kind: 'image', buffer }))
    .catch(() => ({ kind: 'monogram' }));
  cache.set(photo, asset);
  return asset;
}

function formatDateTime(iso) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date.toLocaleDateString('pt-BR')} às ${time}`;
}

function slugify(text) {
  const slug = normalizeText(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'sessao';
}

const percent = (count, base) => (base > 0 ? (count / base) * 100 : 0);

export const resultsReportService = {
  async build(sessionId, userId) {
    const result = await resultService.getBySession(sessionId, userId);
    const institutionProfile = await institutionProfileRepository.findByUserId(userId);

    const photoCache = new Map();
    const positions = [];
    for (const position of result.positions) {
      const candidates = [];
      for (const candidate of position.candidates) {
        candidates.push({ ...candidate, photoAsset: await resolvePhotoAsset(candidate.photo, photoCache) });
      }
      positions.push({ ...position, candidates });
    }

    const totals = positions.reduce(
      (acc, p) => ({
        totalVotes: acc.totalVotes + p.totals.totalVotes,
        validVotes: acc.validVotes + p.totals.validVotes,
      }),
      { totalVotes: 0, validVotes: 0 },
    );
    const candidatesCount = positions.reduce((acc, p) => acc + p.candidates.length, 0);

    const electedChips = positions.flatMap((p) =>
      p.winners.map((id) => ({ positionLabel: p.label, candidate: p.candidates.find((c) => c.id === id) })),
    );

    const runoffChips = positions
      .filter((p) => p.runoff)
      .map((p) => ({
        positionLabel: p.label,
        candidates: p.runoff.candidateIds.map((id) => p.candidates.find((c) => c.id === id)),
      }));

    return {
      session: {
        name: result.session.name,
        year: result.session.year,
        finishedAtLabel: formatDateTime(result.session.finishedAt),
      },
      institutionName: institutionProfile?.name ?? null,
      summary: {
        positionsCount: positions.length,
        totalVotes: totals.totalVotes,
        validVotes: totals.validVotes,
        validPercent: percent(totals.validVotes, totals.totalVotes),
        candidatesCount,
      },
      electedChips,
      runoffChips,
      positions,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      fileName: `apuracao-${slugify(result.session.name)}-${result.session.year}.pdf`,
    };
  },
};
