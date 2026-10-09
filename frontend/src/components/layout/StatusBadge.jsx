import { Badge } from '@/components/ui/badge';

// Status ACTIVE/INACTIVE de partidos e candidatos. Candidatos também podem estar
// PENDING (Etapa 20): candidatura recebida pelo link público, ainda sem análise
// de quem administra a sessão.
export function ActiveBadge({ status }) {
  if (status === 'ACTIVE') return <Badge variant="success">Ativo</Badge>;
  if (status === 'PENDING') return <Badge variant="warning">Pendente</Badge>;
  return <Badge>Inativo</Badge>;
}
