import { candidateRepository } from '../repositories/candidate.repository.js';
import { personRepository } from '../repositories/person.repository.js';
import { PERSON_LIMITS } from '../rules/person-rules.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { isPlainObject, normalizeText } from '../utils/object.js';
import { isStoredPhotoPath, parsePhotoDataUri, photoStorage } from '../storage/photo-storage.js';

// Uma captura da webcam (480x480, JPEG, ver PhotoCaptureField.jsx) fica na casa de
// dezenas de KB — bem abaixo disso. O limite também precisa caber com folga no
// corpo da requisição JSON como um todo (MAX_BODY_BYTES em utils/http.js), já que
// o base64 inflaciona ~33%.
const PHOTO_MAX_BYTES = 300_000;

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw badRequest('PERSON_NAME_REQUIRED', 'Informe o nome.');
  if (name.length > PERSON_LIMITS.nameMaxLength) {
    throw badRequest('PERSON_NAME_TOO_LONG', `O nome pode ter no máximo ${PERSON_LIMITS.nameMaxLength} caracteres.`);
  }
  return name;
}

// Aceita três formatos de entrada: um endereço http(s) (link externo), um caminho
// já salvo por este serviço (edição sem trocar a foto), ou uma captura da webcam
// em data URI — que é decodificada e gravada em disco por photoStorage.save.
async function normalizePhoto(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw badRequest('PERSON_PHOTO_INVALID', 'A foto deve ser um endereço http(s) ou uma captura da câmera.');
  }

  if (isStoredPhotoPath(value)) return value;

  const dataUri = parsePhotoDataUri(value);
  if (dataUri) {
    if (!dataUri.extension) {
      throw badRequest('PERSON_PHOTO_INVALID', 'Formato de imagem não suportado.');
    }
    if (dataUri.buffer.length > PHOTO_MAX_BYTES) {
      throw badRequest('PERSON_PHOTO_TOO_LARGE', 'A foto capturada é grande demais.');
    }
    return photoStorage.save(dataUri.buffer, dataUri.extension);
  }

  const photo = value.trim();
  if (!/^https?:\/\/\S+$/i.test(photo) || photo.length > PERSON_LIMITS.photoMaxLength) {
    throw badRequest(
      'PERSON_PHOTO_INVALID',
      'A foto deve ser um endereço http(s) válido ou uma captura da câmera.',
    );
  }
  return photo;
}

async function findOrFail(id, userId) {
  const person = await personRepository.findById(id);
  if (!person || person.userId !== userId) throw notFound('PERSON_NOT_FOUND', 'Pessoa não encontrada.');
  return person;
}

async function withCandidaciesCount(person, countByPerson) {
  const count = countByPerson
    ? countByPerson.get(person.id) ?? 0
    : (await candidateRepository.findWhere((c) => c.personId === person.id)).length;
  return { ...person, candidaciesCount: count };
}

export const personService = {
  // Lista pensada pro seletor "reaproveitar candidato existente" do formulário de
  // candidatos: nome, foto e em quantas candidaturas a pessoa já aparece.
  async list(filters = {}, userId) {
    const search = normalizeText(filters.search).trim();
    let people = await personRepository.findAllForUser(userId);
    if (search) people = people.filter((p) => normalizeText(p.name).includes(search));

    const candidates = await candidateRepository.findAllForUser(userId);
    const countByPerson = new Map();
    candidates.forEach((c) => countByPerson.set(c.personId, (countByPerson.get(c.personId) ?? 0) + 1));

    const withCounts = await Promise.all(people.map((p) => withCandidaciesCount(p, countByPerson)));
    return withCounts.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },

  async getById(id, userId) {
    return withCandidaciesCount(await findOrFail(id, userId));
  },

  async create(input, userId) {
    const data = isPlainObject(input) ? input : {};
    const name = normalizeName(data.name);
    const photo = await normalizePhoto(data.photo);
    const person = await personRepository.create({ name, photo, userId, createdAt: new Date().toISOString() });
    return withCandidaciesCount(person);
  },

  async update(id, input, userId) {
    const current = await findOrFail(id, userId);
    const changes = isPlainObject(input) ? input : {};
    const name = normalizeName(changes.name ?? current.name);
    const photo = await normalizePhoto(changes.photo ?? current.photo);

    const updated = await personRepository.update(id, { name, photo });
    // Só apaga o arquivo antigo depois que a atualização é confirmada, e só se
    // realmente era um arquivo nosso (link externo ou nulo não tem o que apagar).
    if (current.photo && current.photo !== photo) await photoStorage.remove(current.photo);
    return withCandidaciesCount(updated);
  },

  // Bloqueia a remoção se a pessoa já tem candidatura em alguma sessão — o
  // histórico de candidaturas/votos nunca pode ficar sem a pessoa que referencia.
  async remove(id, userId) {
    const person = await findOrFail(id, userId);
    const candidacies = await candidateRepository.findWhere((c) => c.personId === id);
    if (candidacies.length > 0) {
      throw conflict('PERSON_IN_USE', 'Esta pessoa está vinculada a candidaturas e não pode ser removida.');
    }
    await personRepository.delete(id);
    if (person.photo) await photoStorage.remove(person.photo);
  },
};
