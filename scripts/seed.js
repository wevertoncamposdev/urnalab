// Preenche o banco (Postgres, via Prisma) com uma eleição fictícia para testes manuais e
// demonstração — cobre o fluxo inteiro do sistema (votação, apuração, cobrança de PDF,
// doações) numa conta só, pronta para logar e mostrar tudo de uma vez.
// Usa os services (não grava no banco direto, exceto onde comentado), então passa pelas
// mesmas validações da API.
// Uso: node scripts/seed.js [--voters=N] [--no-finish]
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../backend/src/config.js';
import { prisma } from '../backend/src/database/index.js';
import { authService } from '../backend/src/services/auth.service.js';
import { institutionProfileService } from '../backend/src/services/institution-profile.service.js';
import { sessionService } from '../backend/src/services/session.service.js';
import { userRepository } from '../backend/src/repositories/user.repository.js';
import { partyService } from '../backend/src/services/party.service.js';
import { personService } from '../backend/src/services/person.service.js';
import { candidateService } from '../backend/src/services/candidate.service.js';
import { voteService } from '../backend/src/services/vote.service.js';
import { productRepository } from '../backend/src/repositories/product.repository.js';
import { paymentRepository } from '../backend/src/repositories/payment.repository.js';
import { donationRepository } from '../backend/src/repositories/donation.repository.js';
import { productFileStorage } from '../backend/src/storage/product-file-storage.js';
import { buildPlaceholderPdf } from '../backend/src/reports/placeholder-pdf.js';
import { SESSION_EXPORT_PRODUCT_ID } from '../backend/src/rules/product-rules.js';

// Conta fixa só para o seed: cada conta tem seus próprios dados agora (multiusuário),
// então o seed precisa de um "dono" — reaproveita a mesma conta a cada execução. É essa
// conta que deve ser usada para mostrar a demonstração completa (não existe, hoje, uma
// eleição "visível para todas as contas" — o isolamento por conta é intencional).
const SEED_ACCOUNT = { name: 'Demo', email: 'demo@urna.local', password: 'demo12345' };

// Nome fixo da doação anônima de exemplo (ver createDemoDonations) — ela nasce com
// `userId: null` (é assim que uma doação anônima de verdade também fica), então não tem
// como `clearPreviousDemoData` achá-la por `userId` como faz com o resto dos dados do
// seed; usa esse nome como marcador pra conseguir apagar ela de novo antes de recriar.
const SEED_ANONYMOUS_DONOR_NAME = 'Visitante Exemplo (seed)';

// Perfil de instituição exigido antes de criar qualquer sessão (ver session.service.js
// create) desde a Etapa 8.3 — o seed nunca tinha sido atualizado pra isso.
const SEED_INSTITUTION = {
  name: 'Escola Demo',
  address: 'Rua das Eleições, 100',
  contact: '(11) 99999-0000',
};

const PARTIES = [
  { name: 'Partido ABC', acronym: 'ABC', number: 10 },
  { name: 'Partido XYZ', acronym: 'XYZ', number: 20 },
  { name: 'Partido DEMO', acronym: 'DEMO', number: 30 },
];

const CANDIDATES_BY_POSITION = {
  PRESIDENTE: [
    { name: 'João Silva', number: '10' },
    { name: 'Maria Souza', number: '20' },
    { name: 'Carlos Oliveira', number: '30' },
  ],
  GOVERNADOR: [
    { name: 'Ana Santos', number: '11' },
    { name: 'Pedro Lima', number: '22' },
    { name: 'Lúcia Ramos', number: '33' },
  ],
  SENADOR: [
    { name: 'Rafael Costa', number: '101' },
    { name: 'Beatriz Alves', number: '202' },
    { name: 'Tiago Mendes', number: '303' },
  ],
};

// Gerador pseudoaleatório de semente fixa, para a simulação ser reprodutível.
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv) {
  const voters = argv.find((arg) => arg.startsWith('--voters='));
  return {
    // Demonstração completa por padrão: dá pra rodar só `npm run seed` e já ganhar uma
    // sessão finalizada com votos e resultado — passe --voters=0 pra pular isso.
    voters: voters ? Number(voters.slice('--voters='.length)) : 150,
    finish: !argv.includes('--no-finish'),
  };
}

// Primeira vez: cria a conta demo (e já ganha os cargos padrão). Nas próximas, só entra
// nela — assim o seed continua idempotente mesmo rodando várias vezes. authService.login
// exige e-mail confirmado (fluxo normal, com código por e-mail via Resend) — o seed não
// passa por esse fluxo, então confirma direto no banco se a conta já existir sem isso.
async function ensureSeedUser() {
  try {
    const { user } = await authService.register(SEED_ACCOUNT);
    // register() nunca verifica (é o fluxo normal, por código enviado por e-mail) —
    // confirma direto aqui, já que o seed não passa pelo Resend.
    return userRepository.markEmailVerified(user.id);
  } catch (error) {
    if (error.code !== 'USER_EMAIL_ALREADY_EXISTS') throw error;
  }

  const existing = await userRepository.findByEmail(SEED_ACCOUNT.email);
  return existing.emailVerifiedAt ? existing : userRepository.markEmailVerified(existing.id);
}

// Idempotente (upsertForUser) — roda em todo `npm run seed`, não só na primeira vez.
async function ensureSeedInstitutionProfile(userId) {
  return institutionProfileService.save(SEED_INSTITUTION, userId);
}

// Apaga a conta demo de uma execução anterior (se houver) antes de recriar tudo do
// zero — `onDelete: Cascade` em toda relação de User (ver prisma/schema.prisma) já leva
// partidos/pessoas/candidatos/sessões/votos/pagamentos junto, então não precisa apagar
// tabela por tabela. Sem isso, a segunda execução do seed sempre falhava: `createParties`
// tentava recriar os mesmos partidos (mesmo número/sigla) pra uma conta que já os tinha,
// batendo na constraint `@@unique([userId, number])`.
// Exceção: Donation.user é `onDelete: SetNull` (de propósito — uma doação não deve
// desaparecer se a conta for excluída depois), então sobreviveria ao delete do usuário
// como registro órfão; apaga explícito aqui pra não acumular doação demo duplicada a
// cada reseed.
async function clearPreviousDemoData() {
  const existing = await userRepository.findByEmail(SEED_ACCOUNT.email);
  if (existing) {
    await prisma.donation.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }
  // Doação anônima de exemplo: nasce com `userId: null`, então o delete acima nunca a
  // alcança — sem isso ela se acumularia (uma nova a cada reseed, pra sempre).
  await prisma.donation.deleteMany({ where: { donorName: SEED_ANONYMOUS_DONOR_NAME } });

  // As fotos de candidatos antigos (arquivo em disco, não cascateia com o delete acima)
  // ficariam órfãs sem isso.
  await fs.rm(path.join(config.dataPath, 'photos'), { recursive: true, force: true });
}

// Idempotente (upsert por slug) — roda em todo `npm run seed`, não só na primeira vez.
// Só pra ambiente de desenvolvimento: a Etapa 16 (CRUD de produto pelo admin) é o jeito
// de verdade de cadastrar isso em produção. O PDF em si é só placeholder, pra testar o
// fluxo de compra/download ponta a ponta — o ebook de verdade (texto, plano de aula) é
// decisão de conteúdo da própria UrnaLab, fora do escopo deste script.
async function ensureDemoEbookProduct() {
  const buffer = await buildPlaceholderPdf(
    'UrnaLab — Material de apoio (exemplo)',
    'Este é um arquivo de demonstração gerado pelo seed de desenvolvimento (scripts/seed.js) — '
    + 'substitua pelo conteúdo real do material didático (plano de aula de cidadania usando o '
    + 'UrnaLab) antes de vender de verdade.',
  );
  const fileKey = await productFileStorage.save(buffer, 'pdf');
  return productRepository.upsertBySlug('ebook-cidadania-demo', {
    name: 'Plano de aula: Cidadania com o UrnaLab (exemplo)',
    description: 'Material de demonstração — em breve, o plano de aula de verdade.',
    kind: 'EBOOK',
    priceCents: 1990,
    active: true,
    fileKey,
  });
}

async function createParties(userId) {
  const partiesByAcronym = new Map();
  for (const data of PARTIES) {
    const party = await partyService.create(data, userId);
    partiesByAcronym.set(party.acronym, party);
  }
  return partiesByAcronym;
}

// `peopleCache` é compartilhado entre as duas sessões demo (ver main) — mesma pessoa
// concorrendo nas duas, sem recriar o cadastro (Person não pertence a uma sessão só).
async function createCandidates(sessionId, partiesByAcronym, userId, peopleCache) {
  const parties = [...partiesByAcronym.values()];
  for (const [position, candidates] of Object.entries(CANDIDATES_BY_POSITION)) {
    for (const [index, candidate] of candidates.entries()) {
      let person = peopleCache.get(candidate.name);
      if (!person) {
        person = await personService.create({ name: candidate.name }, userId);
        peopleCache.set(candidate.name, person);
      }
      await candidateService.create(
        {
          sessionId,
          partyId: parties[index % parties.length].id,
          position,
          personId: person.id,
          number: candidate.number,
        },
        userId,
      );
    }
  }
}

// Decide o tipo de voto (80% válido, 10% branco, 10% nulo) e, se válido, o candidato.
function pickVote(random, position) {
  const roll = random();
  if (roll < 0.8) {
    const candidates = CANDIDATES_BY_POSITION[position];
    const candidate = candidates[Math.floor(random() * candidates.length)];
    return { type: 'VALID', number: candidate.number };
  }
  if (roll < 0.9) return { type: 'BLANK' };
  return { type: 'NULL' };
}

async function castVotes(sessionId, voters, random, userId) {
  const positions = Object.keys(CANDIDATES_BY_POSITION);
  let count = 0;
  for (let voter = 0; voter < voters; voter += 1) {
    for (const position of positions) {
      const vote = pickVote(random, position);
      await voteService.create({ sessionId, position, confirmed: true, ...vote }, userId);
      count += 1;
    }
  }
  return count;
}

// Cobrança da exportação em PDF já paga (Etapa 14/15) — grava direto no repository
// (sem passar pelo Mercado Pago de verdade, igual ao resto do seed que atalha fluxos
// externos) só pra Financeiro.jsx e o resumo financeiro do admin já mostrarem algo sem
// precisar simular um checkout de verdade.
async function createDemoPayment(sessionId, userId) {
  const product = await productRepository.findById(SESSION_EXPORT_PRODUCT_ID);
  return paymentRepository.create({
    userId,
    productId: product.id,
    sessionId,
    amountCents: product.priceCents,
    status: 'APPROVED',
    mpPreferenceId: 'seed-preference-export',
    mpPaymentId: 'seed-payment-export',
    paidAt: new Date().toISOString(),
  });
}

// Doações já aprovadas (uma logada pela própria conta demo, uma anônima — mesmos dois
// casos que a landing/dashboard suportam de verdade) pra popular o total de doações no
// resumo financeiro do admin sem precisar de um pagamento real no Mercado Pago.
async function createDemoDonations(userId) {
  await donationRepository.create({
    userId,
    donorName: null,
    amountCents: 5000,
    status: 'APPROVED',
    mpPreferenceId: 'seed-preference-donation-1',
    mpPaymentId: 'seed-payment-donation-1',
    paidAt: new Date().toISOString(),
  });
  await donationRepository.create({
    userId: null,
    donorName: SEED_ANONYMOUS_DONOR_NAME,
    amountCents: 2500,
    status: 'APPROVED',
    mpPreferenceId: 'seed-preference-donation-2',
    mpPaymentId: 'seed-payment-donation-2',
    paidAt: new Date().toISOString(),
  });
}

async function main() {
  const { voters, finish } = parseArgs(process.argv.slice(2));

  await clearPreviousDemoData();
  const user = await ensureSeedUser();
  await ensureSeedInstitutionProfile(user.id);
  const ebookProduct = await ensureDemoEbookProduct();
  const partiesByAcronym = await createParties(user.id);
  const peopleCache = new Map();
  const positions = Object.keys(CANDIDATES_BY_POSITION);

  // Sessão A: fica OPEN, com zero votos — pra demonstrar (e deixar qualquer um testar,
  // sem login, pelo link público) o fluxo de votação e de candidatura do zero.
  const openSession = await sessionService.create(
    { name: 'Eleição Demo 2026 — vote agora', year: 2026, positions },
    user.id,
  );
  await createCandidates(openSession.id, partiesByAcronym, user.id, peopleCache);
  await sessionService.open(openSession.id, user.id);

  // Sessão B: já com votos simulados e (por padrão) finalizada — pra demonstrar
  // apuração, exportação em PDF e 2º turno sem precisar votar manualmente antes.
  const resultSession = await sessionService.create(
    { name: 'Eleição Demo 2026 — resultado', year: 2026, positions },
    user.id,
  );
  await createCandidates(resultSession.id, partiesByAcronym, user.id, peopleCache);
  await sessionService.open(resultSession.id, user.id);

  let votesCast = 0;
  if (voters > 0) {
    votesCast = await castVotes(resultSession.id, voters, mulberry32(42), user.id);
  }

  if (finish) {
    await sessionService.finish(resultSession.id, user.id);
  }

  await createDemoPayment(resultSession.id, user.id);
  await createDemoDonations(user.id);

  console.log(`Dados em ${config.dataPath}`);
  console.log(`Conta demo: ${SEED_ACCOUNT.email} / ${SEED_ACCOUNT.password}`);
  console.log(`Login: ${config.frontendUrl}/login`);
  console.log(`Partidos criados: ${partiesByAcronym.size}`);
  console.log(`Candidatos por sessão: ${Object.values(CANDIDATES_BY_POSITION).flat().length}`);
  console.log('');
  console.log(`Sessão aberta para votar: "${openSession.name}" (${openSession.id})`);
  console.log(`  Votar sem login: ${config.frontendUrl}/votar/${openSession.publicToken}`);
  console.log(`  Candidatar-se sem login: ${config.frontendUrl}/candidatar/${openSession.candidacyToken}`);
  console.log('');
  console.log(`Sessão com resultado: "${resultSession.name}" (${resultSession.id})`);
  console.log(`  Votos simulados: ${votesCast}`);
  console.log(`  Finalizada: ${finish ? 'sim' : 'não'}`);
  if (finish) console.log(`  Resultado sem login: ${config.frontendUrl}/votar/${resultSession.publicToken}`);
  console.log('');
  console.log(`Produto ebook de demonstração: "${ebookProduct.name}" (${ebookProduct.id})`);
  console.log('Cobrança de exportação em PDF e doações de exemplo: criadas (já aprovadas).');
}

main().catch((error) => {
  console.error('[seed] falhou:', error);
  process.exitCode = 1;
});
