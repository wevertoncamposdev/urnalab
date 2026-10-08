import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CandidateAvatar } from './CandidateAvatar';

// Foto grande + proposta em destaque (Etapa 21) — reaproveitado tanto na Área
// de Gerenciamento (tabela de candidatos) quanto na "colinha" da tela de
// votação, pra consulta de proposta ficar visualmente igual nos dois lugares.
export function CandidateProposalDialog({ candidate, onOpenChange }) {
  return (
    <Dialog open={Boolean(candidate)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex-row items-center gap-4">
          {candidate && (
            <CandidateAvatar name={candidate.name} photo={candidate.photo} className="size-20 text-lg" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-xl">{candidate?.name}</DialogTitle>
            <DialogDescription>
              {candidate?.party ? `${candidate.party.acronym} (${candidate.party.number}) • número ${candidate.number}` : `Número ${candidate?.number}`}
            </DialogDescription>
          </div>
        </DialogHeader>
        {candidate?.governmentProposal ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed">{candidate.governmentProposal}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Este candidato não cadastrou uma proposta de governo.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
