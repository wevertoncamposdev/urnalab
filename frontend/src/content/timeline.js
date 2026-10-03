// Linha do tempo do projeto: o que cada etapa construiu e o que ela ensina.
// Conteúdo estático, pensado pra quem usar este repo como material de estudo
// (ver ROADMAP.md) — não precisa rodar o projeto pra entender a evolução dele.
export const TIMELINE = [
  {
    phase: 'Etapa 1',
    title: 'Arquitetura e fundação',
    summary:
      'Servidor HTTP e roteador escritos à mão (sem Express nem outro framework), em camadas: ' +
      'Routes → Controllers → Services → Repositories → JsonDatabase. Persistência em arquivos ' +
      'JSON, com fila de escrita (uma operação por vez) e gravação atômica — arquivo temporário ' +
      'seguido de rename, pra nunca deixar um arquivo pela metade.',
    lesson:
      'Como um framework web funciona por baixo dos panos, e por que separar responsabilidades em ' +
      'camadas facilita trocar uma peça (ex.: JSON → PostgreSQL) sem mexer nas outras.',
  },
  {
    phase: 'Etapa 2',
    title: 'Sessões eleitorais',
    summary:
      'CRUD de sessões com um ciclo de vida de três estados — DRAFT → OPEN → FINISHED — e os ' +
      'cargos em disputa definidos por sessão.',
    lesson: 'Modelar uma máquina de estados simples e validar transições (o que pode virar o quê).',
  },
  {
    phase: 'Etapa 3',
    title: 'Partidos',
    summary:
      'CRUD de partidos com sigla e número únicos. Remover um partido na verdade desativa — nunca ' +
      'apaga — pra não perder o vínculo com candidatos e votos já registrados.',
    lesson:
      'Por que preservar histórico importa em dados que outras entidades referenciam, e como ' +
      'garantir unicidade na própria camada de persistência (sem depender só da validação).',
  },
  {
    phase: 'Etapa 4',
    title: 'Candidatos',
    summary:
      'Candidatos vinculados a sessão, cargo e partido, com número único por cargo dentro da ' +
      'sessão. Depois que a votação abre, a identidade (partido/cargo/número) trava — só nome, ' +
      'foto e status continuam editáveis. Foto por link ou webcam do navegador.',
    lesson:
      'Regras de negócio que mudam de comportamento conforme o estado de outra entidade (a ' +
      'sessão), e captura de mídia (câmera) direto no navegador.',
  },
  {
    phase: 'Etapa 5',
    title: 'Votação',
    summary:
      'Busca do candidato pelo número digitado, registro de voto (válido, branco ou nulo) e ' +
      'nenhum dado do eleitor armazenado. Uma trava (lock) garante que nenhum voto passe depois ' +
      'que a sessão foi finalizada, mesmo com requisições simultâneas.',
    lesson: 'Condições de corrida em sistemas com múltiplos clientes, e como evitá-las sem um banco real.',
  },
  {
    phase: 'Etapa 6',
    title: 'Resultados',
    summary:
      'Apuração por cargo, liberada só depois que a sessão finaliza — como numa eleição de ' +
      'verdade. Ranking por votos válidos, com brancos e nulos contabilizados à parte.',
    lesson:
      'Separar a lógica de apuração da de registro de voto, e a diferença prática entre "total de ' +
      'votos" e "votos válidos" (a base usada pros percentuais).',
  },
  {
    phase: 'Etapa 7',
    title: 'Auditoria',
    summary:
      'Cada voto grava um hash encadeado ao hash do voto anterior da mesma sessão. Reconferir a ' +
      'cadeia inteira detecta alteração, remoção ou reordenação de qualquer voto feita direto no ' +
      'arquivo, depois que foi gravado.',
    lesson: 'Hashing encadeado como mecanismo de integridade — a mesma ideia por trás de um blockchain, numa escala bem menor.',
  },
  {
    phase: 'Depois das 7 etapas',
    title: 'Cargos configuráveis',
    summary:
      'A lista fixa de cargos brasileiros (`POSITION_RULES`) virou um cadastro de verdade, com ' +
      'CRUD próprio — nome, dígitos do número e ordem na cédula ficaram livres, abrindo o ' +
      'simulador pra eleições fora do modelo brasileiro.',
    lesson: 'Generalizar um modelo até então fixo em código, transformando-o num registro editável sem quebrar quem já dependia dele.',
  },
  {
    phase: 'Depois das 7 etapas',
    title: 'Pessoa e candidatura separados',
    summary:
      'Nome e foto viraram uma entidade própria (Pessoas), reaproveitável entre candidaturas em ' +
      'sessões diferentes. "Candidato" passou a significar só o vínculo — sessão, cargo, partido ' +
      'e número — de uma pessoa numa eleição específica.',
    lesson:
      'Normalização de dados: separar "quem a pessoa é" (estável) de "que papel ela exerce aqui" ' +
      '(específico de cada sessão).',
  },
  {
    phase: 'Depois das 7 etapas',
    title: 'Experiência da votação',
    summary:
      'Painel maior com a foto do candidato, digitação pelo teclado físico (com Enter pra ' +
      'confirmar), o som de confirmação da urna, botão de tela cheia e menu lateral recolhível.',
    lesson: 'Como pequenos detalhes de interação fazem uma tela "parecer" com o hardware real que a inspirou.',
  },
  {
    phase: 'Depois das 7 etapas',
    title: 'Dois turnos',
    summary:
      'Regra de maioria absoluta configurável por cargo: sem ninguém passar de 50% dos votos ' +
      'válidos no 1º turno, a apuração aponta os dois mais votados pra disputa, em vez de ' +
      'declarar um vencedor.',
    lesson:
      'Nem toda regra de negócio é "este cargo sempre funciona assim" — às vezes a regra em si ' +
      'precisa virar uma opção configurável.',
  },
];
