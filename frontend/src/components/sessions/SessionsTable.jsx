import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatNumber } from '@/lib/format';
import { SessionStatusBadge } from './SessionStatusBadge';

// Mesmo padrão de botão ícone-only (habilitado só quando faz sentido pro status
// atual) usado nos cards do Dashboard (ver SessionCard.jsx) — aqui dá acesso direto
// a votar ou se candidatar sem precisar abrir a sessão primeiro.
function CandidacyLinkButton({ session }) {
  const enabled = session.status === 'DRAFT';
  const url = `/candidatar/${session.candidacyToken}`;
  return (
    <Button
      size="icon"
      variant="outline"
      asChild={enabled}
      disabled={!enabled}
      aria-label="Link de candidatura"
      title={enabled ? 'Link de candidatura' : 'Só disponível na etapa de candidatura'}
    >
      {enabled ? <a href={url} target="_blank" rel="noreferrer"><UserPlus /></a> : <UserPlus />}
    </Button>
  );
}

function VoteLinkButton({ session }) {
  const enabled = session.status === 'OPEN';
  const url = `/votar/${session.publicToken}`;
  return (
    <Button
      size="icon"
      variant="outline"
      asChild={enabled}
      disabled={!enabled}
      aria-label="Votar"
      title={enabled ? 'Votar' : 'Abra a votação para registrar votos'}
    >
      {enabled ? <a href={url} target="_blank" rel="noreferrer"><Vote /></a> : <Vote />}
    </Button>
  );
}

export function SessionsTable({ sessions }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Ano</TableHead>
          <TableHead>Cargos</TableHead>
          <TableHead>Candidatos</TableHead>
          <TableHead>Votos</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Criada em</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="font-medium">{session.name}</TableCell>
            <TableCell>{session.year}</TableCell>
            <TableCell>{session.positionsCount}</TableCell>
            <TableCell>{formatNumber(session.candidatesCount)}</TableCell>
            <TableCell>{formatNumber(session.votesCount)}</TableCell>
            <TableCell><SessionStatusBadge status={session.status} /></TableCell>
            <TableCell className="text-muted-foreground">{formatDateTime(session.createdAt)}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <CandidacyLinkButton session={session} />
                <VoteLinkButton session={session} />
                <Button asChild size="icon" aria-label="Gerenciar sessão" title="Gerenciar sessão">
                  <Link to={`/sessoes/${session.id}`}><ArrowRight /></Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
