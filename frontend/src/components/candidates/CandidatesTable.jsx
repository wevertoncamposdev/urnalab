import { Check, FileText, Pencil, Power, PowerOff, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RowActions } from '@/components/layout/RowActions';
import { ActiveBadge } from '@/components/layout/StatusBadge';
import { CandidateAvatar } from './CandidateAvatar';

export function CandidatesTable({
  candidates,
  positionLabels,
  sessionsById,
  onEdit,
  onDeactivate,
  onReactivate,
  onApprove,
  onReject,
  onViewProposal,
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Candidato</TableHead>
          <TableHead>Partido</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((candidate) => {
          const session = sessionsById[candidate.sessionId];
          const locked = session?.status === 'FINISHED';
          return (
            <TableRow key={candidate.id}>
              <TableCell className="font-mono font-medium tabular-nums">{candidate.number}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <CandidateAvatar name={candidate.name} photo={candidate.photo} />
                  <div>
                    <div className="font-medium">{candidate.name}</div>
                    {session && <div className="text-xs text-muted-foreground">{session.name} ({session.year})</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {candidate.party ? `${candidate.party.acronym} • ${candidate.party.number}` : '—'}
              </TableCell>
              <TableCell>{positionLabels[candidate.position] ?? candidate.position}</TableCell>
              <TableCell><ActiveBadge status={candidate.status} /></TableCell>
              <TableCell className="text-right">
                <RowActions
                  label={candidate.name}
                  items={[
                    { label: 'Ver proposta', icon: FileText, onSelect: () => onViewProposal(candidate) },
                    { label: 'Editar', icon: Pencil, onSelect: () => onEdit(candidate), disabled: locked },
                    ...(candidate.status === 'PENDING'
                      ? [
                          { label: 'Aprovar', icon: Check, onSelect: () => onApprove(candidate), disabled: locked },
                          { label: 'Reprovar', icon: X, onSelect: () => onReject(candidate), disabled: locked },
                        ]
                      : candidate.status === 'ACTIVE'
                        ? [{ label: 'Desativar', icon: PowerOff, onSelect: () => onDeactivate(candidate), disabled: locked }]
                        : [{ label: 'Reativar', icon: Power, onSelect: () => onReactivate(candidate), disabled: locked }]),
                  ]}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
