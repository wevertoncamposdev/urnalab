import PDFDocument from 'pdfkit';
import { COLORS, FONTS, PAGE, RANKING_COLUMNS } from './pdf-theme.js';

// Único ponto do projeto que conhece `pdfkit` (mesmo princípio de resend em
// email.service.js e @prisma/client em database/index.js).

const CONTENT_X = PAGE.margins.left;
const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

// Quebra de página central: nunca deixa um bloco começar sem espaço pro mínimo
// que ele precisa (ex.: barra do cargo + cabeçalho da tabela + 3 linhas).
function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

const initialsOf = (name) =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

// Posiciona uma lista de chips com quebra de linha manual, só calculando (sem
// desenhar) — quem chama decide o y real depois de garantir espaço na página.
function layoutChips(doc, items, { x, y, maxWidth, renderLabel, fontSize = 9, chipHeight = 20, gapX = 6, gapY = 6, paddingX = 8 }) {
  doc.font(FONTS.bold).fontSize(fontSize);
  let cx = x;
  let cy = y;
  const chips = items.map((item) => {
    const label = renderLabel(item);
    const width = doc.widthOfString(label) + paddingX * 2;
    if (cx > x && cx + width > x + maxWidth) {
      cx = x;
      cy += chipHeight + gapY;
    }
    const chip = { label, x: cx, y: cy, width, height: chipHeight };
    cx += width + gapX;
    return chip;
  });
  return { chips, bottom: items.length ? cy + chipHeight : y };
}

function drawChips(doc, chips, { bg, fg, paddingX = 8, fontSize = 9 }) {
  doc.font(FONTS.bold).fontSize(fontSize);
  chips.forEach((chip) => {
    doc.roundedRect(chip.x, chip.y, chip.width, chip.height, chip.height / 2).fill(bg);
    doc.fillColor(fg).text(chip.label, chip.x + paddingX, chip.y + chip.height / 2 - fontSize / 2 - 0.5, {
      width: chip.width - paddingX * 2,
      lineBreak: false,
    });
  });
}

// Foto circular; cai pro monograma (iniciais) se não houver imagem local
// decodificável ou se a decodificação falhar — foto nunca derruba o relatório.
function drawAvatar(doc, asset, name, x, y, diameter) {
  const radius = diameter / 2;
  let drewImage = false;
  if (asset?.kind === 'image') {
    try {
      doc.save();
      doc.circle(x + radius, y + radius, radius).clip();
      doc.image(asset.buffer, x, y, { width: diameter, height: diameter });
      drewImage = true;
    } catch {
      // cai pro monograma abaixo
    } finally {
      doc.restore();
    }
  }
  if (!drewImage) {
    doc.save();
    doc.circle(x + radius, y + radius, radius).fill(COLORS.mutedSoft);
    doc.restore();
    doc
      .font(FONTS.bold)
      .fontSize(diameter * 0.38)
      .fillColor(COLORS.muted)
      .text(initialsOf(name), x, y + diameter * 0.28, { width: diameter, align: 'center', lineBreak: false });
  }
}

function drawTitleBlock(doc, report) {
  const width = contentWidth(doc);
  let y = doc.y;

  if (report.institutionName) {
    doc
      .font(FONTS.bold)
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(report.institutionName, CONTENT_X, y, { width, height: 14, ellipsis: true });
    y += 18;
  }

  doc
    .font(FONTS.bold)
    .fontSize(20)
    .fillColor(COLORS.foreground)
    .text(report.session.name, CONTENT_X, y, { width, height: 50, ellipsis: true });
  y += 54;

  doc
    .font(FONTS.regular)
    .fontSize(11)
    .fillColor(COLORS.muted)
    .text(`Eleição ${report.session.year} · Encerrada em ${report.session.finishedAtLabel}`, CONTENT_X, y, {
      width,
      lineBreak: false,
    });
  y += 26;

  doc.y = y;
}

function drawSummaryTiles(doc, summary) {
  const width = contentWidth(doc);
  const gap = 12;
  const tileWidth = (width - gap * 3) / 4;
  const tileHeight = 56;
  const y = doc.y;

  const tiles = [
    { label: 'Cargos apurados', value: String(summary.positionsCount) },
    { label: 'Total de votos', value: summary.totalVotes.toLocaleString('pt-BR') },
    {
      label: 'Votos válidos',
      value: `${summary.validVotes.toLocaleString('pt-BR')} (${summary.validPercent.toFixed(1)}%)`,
    },
    { label: 'Candidatos', value: String(summary.candidatesCount) },
  ];

  tiles.forEach((tile, index) => {
    const x = CONTENT_X + index * (tileWidth + gap);
    doc.roundedRect(x, y, tileWidth, tileHeight, 8).fill(COLORS.mutedSoft);
    doc
      .font(FONTS.bold)
      .fontSize(18)
      .fillColor(COLORS.foreground)
      .text(tile.value, x + 10, y + 10, { width: tileWidth - 20, height: 22, ellipsis: true });
    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(tile.label, x + 10, y + 34, { width: tileWidth - 20, lineBreak: false });
  });

  doc.y = y + tileHeight + 20;
}

// Card verde (eleitos) ou âmbar (2º turno); some do relatório quando não há itens
// (ex.: sessão sem nenhum cargo com maioria absoluta ainda não aconteceu).
function drawHighlightCard(doc, { title, items, accent, bg, chipBg, chipFg, renderLabel }) {
  if (items.length === 0) return;
  const width = contentWidth(doc);
  const paddingX = 14;
  const paddingTop = 32;
  const paddingBottom = 14;

  const { chips: relChips, bottom: relBottom } = layoutChips(doc, items, {
    x: paddingX,
    y: paddingTop,
    maxWidth: width - paddingX * 2,
    renderLabel,
  });
  const cardHeight = relBottom + paddingBottom;

  ensureSpace(doc, cardHeight + 12);
  const top = doc.y;

  doc.roundedRect(CONTENT_X, top, width, cardHeight, 8).fill(bg);
  doc.rect(CONTENT_X, top, 4, cardHeight).fill(accent);
  doc
    .font(FONTS.bold)
    .fontSize(11)
    .fillColor(accent)
    .text(title, CONTENT_X + paddingX, top + 12, { width: width - paddingX * 2, lineBreak: false });

  const chips = relChips.map((chip) => ({ ...chip, x: chip.x + CONTENT_X, y: chip.y + top }));
  drawChips(doc, chips, { bg: chipBg, fg: chipFg });

  doc.y = top + cardHeight + 12;
}

function drawRankingTable(doc, position) {
  const width = contentWidth(doc);
  const cols = RANKING_COLUMNS;
  const colX = {};
  let x = CONTENT_X;
  for (const [key, colWidth] of Object.entries(cols)) {
    colX[key] = x;
    x += colWidth;
  }

  let y = doc.y;
  doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.muted);
  doc.text('#', colX.rank, y, { width: cols.rank, lineBreak: false });
  doc.text('Candidato', colX.name, y, { width: cols.name, lineBreak: false });
  doc.text('Partido', colX.party, y, { width: cols.party, lineBreak: false });
  doc.text('Nº', colX.number, y, { width: cols.number, lineBreak: false });
  doc.text('Votos', colX.votes, y, { width: cols.votes, align: 'right', lineBreak: false });
  doc.text('%', colX.percent, y, { width: cols.percent, align: 'right', lineBreak: false });
  y += 14;
  doc.moveTo(CONTENT_X, y).lineTo(CONTENT_X + width, y).strokeColor(COLORS.border).lineWidth(1).stroke();
  y += 6;
  doc.y = y;

  const rowHeight = 24;
  const maxVotes = position.candidates[0]?.votes ?? 0;

  position.candidates.forEach((candidate, index) => {
    ensureSpace(doc, rowHeight);
    const rowY = doc.y;
    const isWinner = position.winners.includes(candidate.id);
    const inRunoff = position.runoff ? position.runoff.candidateIds.includes(candidate.id) : false;

    if (isWinner) doc.rect(CONTENT_X, rowY, width, rowHeight).fill(COLORS.greenSoft);

    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(String(index + 1), colX.rank, rowY + 7, { width: cols.rank, lineBreak: false });

    drawAvatar(doc, candidate.photoAsset, candidate.name, colX.photo + 2, rowY + 2, 20);

    const statusSuffix = candidate.status === 'INACTIVE' ? ' (inativo)' : '';
    doc
      .font(FONTS.bold)
      .fontSize(9)
      .fillColor(COLORS.foreground)
      .text(candidate.name + statusSuffix, colX.name, rowY + 3, { width: cols.name - 6, height: 11, ellipsis: true });

    const chipLabel = isWinner ? 'ELEITO' : inRunoff ? '2º TURNO' : null;
    if (chipLabel) {
      doc.font(FONTS.bold).fontSize(7);
      const chipWidth = doc.widthOfString(chipLabel) + 10;
      doc.roundedRect(colX.name, rowY + 13, chipWidth, 10, 5).fill(isWinner ? COLORS.green : COLORS.accent);
      doc
        .fillColor(COLORS.white)
        .text(chipLabel, colX.name, rowY + 15.5, { width: chipWidth, align: 'center', lineBreak: false });
    }

    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(candidate.party ? candidate.party.acronym : '—', colX.party, rowY + 7, {
        width: cols.party,
        lineBreak: false,
      });
    doc.text(candidate.number, colX.number, rowY + 7, { width: cols.number, lineBreak: false });
    doc
      .fillColor(COLORS.foreground)
      .text(candidate.votes.toLocaleString('pt-BR'), colX.votes, rowY + 7, { width: cols.votes, align: 'right', lineBreak: false });
    doc
      .fillColor(COLORS.muted)
      .text(`${candidate.percentValid.toFixed(1)}%`, colX.percent, rowY + 7, {
        width: cols.percent,
        align: 'right',
        lineBreak: false,
      });

    const barMaxWidth = cols.bar - 10;
    const barWidth = maxVotes > 0 ? (candidate.votes / maxVotes) * barMaxWidth : 0;
    doc.roundedRect(colX.bar, rowY + 9, barMaxWidth, 6, 3).fill(COLORS.mutedSoft);
    if (barWidth > 0) doc.roundedRect(colX.bar, rowY + 9, barWidth, 6, 3).fill(COLORS.primary);

    doc.y = rowY + rowHeight;
  });
}

// Barra 100% empilhada (válidos/brancos/nulos) — cargo sem voto vira texto em
// vez de dividir por zero.
function drawStackedBar(doc, position) {
  const width = contentWidth(doc);
  const { totalVotes, validVotes, blankVotes, nullVotes, blankPercent, nullPercent } = position.totals;
  const barHeight = 10;

  ensureSpace(doc, 46);
  doc.y += 10;
  const y = doc.y;

  if (totalVotes === 0) {
    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text('Nenhum voto registrado neste cargo.', CONTENT_X, y, { width, lineBreak: false });
    doc.y = y + 20;
    return;
  }

  const validWidth = (validVotes / totalVotes) * width;
  const blankWidth = (blankVotes / totalVotes) * width;
  const nullWidth = width - validWidth - blankWidth;

  let x = CONTENT_X;
  doc.rect(x, y, validWidth, barHeight).fill(COLORS.primary);
  x += validWidth;
  doc.rect(x, y, blankWidth, barHeight).fill(COLORS.mutedSoft);
  x += blankWidth;
  doc.rect(x, y, nullWidth, barHeight).fill(COLORS.coral);

  const legendY = y + barHeight + 8;
  const legend = [
    { color: COLORS.primary, label: `Válidos: ${validVotes.toLocaleString('pt-BR')}` },
    { color: COLORS.mutedSoft, label: `Brancos: ${blankVotes.toLocaleString('pt-BR')} (${blankPercent.toFixed(1)}%)` },
    { color: COLORS.coral, label: `Nulos: ${nullVotes.toLocaleString('pt-BR')} (${nullPercent.toFixed(1)}%)` },
    { color: null, label: `Total: ${totalVotes.toLocaleString('pt-BR')}` },
  ];

  doc.font(FONTS.regular).fontSize(8);
  let lx = CONTENT_X;
  legend.forEach((item) => {
    if (item.color) {
      doc.rect(lx, legendY + 1, 7, 7).fill(item.color);
      lx += 11;
    }
    doc.fillColor(COLORS.muted).text(item.label, lx, legendY, { lineBreak: false });
    lx += doc.widthOfString(item.label) + 14;
  });

  doc.y = legendY + 18;
}

function drawPositionSection(doc, position, index) {
  const width = contentWidth(doc);
  const barHeight = 26;
  const tableHeaderHeight = 20;
  const rowHeight = 24;

  ensureSpace(doc, barHeight + tableHeaderHeight + rowHeight * 3 + 16);
  if (index > 0) doc.y += 10;

  let y = doc.y;
  doc.rect(CONTENT_X, y, width, barHeight).fill(COLORS.primary);
  doc
    .font(FONTS.bold)
    .fontSize(12)
    .fillColor(COLORS.white)
    .text(position.label, CONTENT_X + 10, y + 7, { width: width - 200, height: 16, ellipsis: true });

  if (position.twoRoundEnabled) {
    const chipLabel = '2 TURNOS';
    doc.font(FONTS.bold).fontSize(8);
    const chipWidth = doc.widthOfString(chipLabel) + 14;
    const chipX = CONTENT_X + width - chipWidth - 118;
    doc.roundedRect(chipX, y + 6, chipWidth, 14, 7).fill(COLORS.deepBlue);
    doc.fillColor(COLORS.white).text(chipLabel, chipX, y + 9.5, { width: chipWidth, align: 'center', lineBreak: false });
  }

  doc
    .font(FONTS.regular)
    .fontSize(10)
    .fillColor(COLORS.white)
    .text(`${position.totals.totalVotes.toLocaleString('pt-BR')} votos`, CONTENT_X, y + 7, {
      width: width - 10,
      align: 'right',
      lineBreak: false,
    });
  y += barHeight + 10;

  if (position.runoff) {
    const names = position.runoff.candidateIds
      .map((id) => position.candidates.find((c) => c.id === id)?.name)
      .join(' × ');
    const alertHeight = 32;
    doc.roundedRect(CONTENT_X, y, width, alertHeight, 6).fill(COLORS.accentSoft);
    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.foreground)
      .text(`Ninguém alcançou maioria absoluta dos votos válidos. Vai para o 2º turno: ${names}.`, CONTENT_X + 10, y + 10, {
        width: width - 20,
      });
    y += alertHeight + 10;
  }

  doc.y = y;
  drawRankingTable(doc, position);
  drawStackedBar(doc, position);
}

function drawHowToRead(doc) {
  const width = contentWidth(doc);
  const lines = [
    'O percentual de cada candidato é calculado sobre os votos válidos do cargo.',
    'Votos em branco e nulos não entram na disputa, mas aparecem nos totais de cada cargo.',
    'Em cargos com 2º turno, só há vencedor direto com maioria absoluta (mais de 50% dos votos válidos).',
  ];
  const blockHeight = 38 + lines.length * 14;
  ensureSpace(doc, blockHeight);
  doc.y += 14;
  const y = doc.y;
  doc.moveTo(CONTENT_X, y).lineTo(CONTENT_X + width, y).strokeColor(COLORS.border).lineWidth(1).stroke();
  doc
    .font(FONTS.bold)
    .fontSize(10)
    .fillColor(COLORS.foreground)
    .text('Como ler este relatório', CONTENT_X, y + 10, { width, lineBreak: false });

  let ly = y + 28;
  lines.forEach((line) => {
    doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.muted).text(`•  ${line}`, CONTENT_X, ly, { width });
    ly += 14;
  });
  doc.y = ly;
}

function drawHeader(doc) {
  const width = doc.page.width;
  doc.save();
  doc.rect(0, 0, width, PAGE.headerHeight).fill(COLORS.deepBlue);
  doc.font(FONTS.bold).fontSize(14).fillColor(COLORS.white).text('urnalab', PAGE.margins.left, 15, { lineBreak: false });
  doc
    .font(FONTS.regular)
    .fontSize(10)
    .fillColor(COLORS.white)
    .text('Resultado da apuração', 0, 17, { width: width - PAGE.margins.right, align: 'right', lineBreak: false });
  doc.restore();
}

function drawFooter(doc, report, pageNumber, pageCount) {
  const width = doc.page.width;
  const height = doc.page.height;
  const y = height - 40;
  doc.save();
  doc.moveTo(PAGE.margins.left, y).lineTo(width - PAGE.margins.right, y).strokeColor(COLORS.border).lineWidth(1).stroke();
  doc
    .font(FONTS.regular)
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      `Projeto educacional — não é uma urna eletrônica oficial. Gerado em ${report.generatedAtLabel}.`,
      PAGE.margins.left,
      y + 8,
      { width: width - PAGE.margins.left - PAGE.margins.right - 90, lineBreak: false },
    );
  doc.text(`Página ${pageNumber} de ${pageCount}`, width - PAGE.margins.right - 90, y + 8, {
    width: 90,
    align: 'right',
    lineBreak: false,
  });
  doc.restore();
}

// Monta o PDF inteiro em memória antes de devolver (não streama direto pra
// resposta HTTP) — um erro no meio ainda vira JSON normal via error-handler.js,
// em vez de corromper uma resposta já iniciada.
export function renderResultsPdf(report) {
  const doc = new PDFDocument({ size: PAGE.size, margins: PAGE.margins, bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  drawTitleBlock(doc, report);
  drawSummaryTiles(doc, report.summary);
  drawHighlightCard(doc, {
    title: 'ELEITOS',
    items: report.electedChips,
    accent: COLORS.green,
    bg: COLORS.greenSoft,
    chipBg: COLORS.green,
    chipFg: COLORS.white,
    renderLabel: (item) => {
      const c = item.candidate;
      const party = c.party ? `${c.party.acronym} nº${c.number}` : `nº${c.number}`;
      return `${item.positionLabel} — ${c.name} (${party}) · ${c.votes.toLocaleString('pt-BR')} votos (${c.percentValid.toFixed(1)}%)`;
    },
  });
  drawHighlightCard(doc, {
    title: 'VAI PARA O 2º TURNO',
    items: report.runoffChips,
    accent: COLORS.accent,
    bg: COLORS.accentSoft,
    chipBg: COLORS.accent,
    chipFg: COLORS.white,
    renderLabel: (item) => `${item.positionLabel} — ${item.candidates.map((c) => c.name).join(' × ')}`,
  });

  report.positions.forEach((position, index) => drawPositionSection(doc, position, index));
  drawHowToRead(doc);

  // Cabeçalho/rodapé vivem dentro da margem reservada (header acima de margins.top,
  // footer abaixo de margins.bottom) — sem zerar a margem aqui, o pdfkit interpreta
  // qualquer texto desenhado ali como overflow e insere uma página extra sozinho.
  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i += 1) {
    doc.switchToPage(start + i);
    const { top, bottom } = doc.page.margins;
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;
    drawHeader(doc);
    drawFooter(doc, report, i + 1, count);
    doc.page.margins.top = top;
    doc.page.margins.bottom = bottom;
  }

  doc.end();
  return finished;
}
