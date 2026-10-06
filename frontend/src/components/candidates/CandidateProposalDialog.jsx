import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CandidateAvatar } from './CandidateAvatar';

export function CandidateProposalDialog({ candidate, onOpenChange }) {
  return (
    <Dialog open={Boolean(candidate)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {candidate && <CandidateAvatar name={candidate.name} photo={candidate.photo} />}
            {candidate?.name}
          </DialogTitle>
          <DialogDescription>
            {candidate?.party ? `${candidate.party.acronym} (${candidate.party.number}) • número ${candidate.number}` : `Número ${candidate?.number}`}
          </DialogDescription>
        </DialogHeader>
        {candidate?.governmentProposal ? (
          <p className="whitespace-pre-wrap text-sm">{candidate.governmentProposal}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Este candidato não cadastrou uma proposta de governo.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
