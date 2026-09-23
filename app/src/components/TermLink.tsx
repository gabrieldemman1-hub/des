import { Link } from 'react-router';
import { useKnowledge } from '../state/knowledge-context';

/** A setting's name, linking to its explanation in Explain a concept. */
export function TermLink({ id, children }: { id: string; children?: string }) {
  const { termById } = useKnowledge();
  const term = termById(id);
  if (!term) return <span>{children ?? id}</span>;
  return <Link to={`/learn/${term.id}`}>{children ?? term.name}</Link>;
}
