import type { GraphIndex } from '../core/graph.ts';
import type { NodeType } from '../core/types.ts';

const LIMIT = 1000;

/** Suggestions for a node input. shortcut: first 1000 nodes only; swap for a searchable listbox on bigger estates. */
export function NodeOptions({ index, id, types }: { index: GraphIndex; id: string; types?: readonly NodeType[] }) {
  return (
    <datalist id={id}>
      {index.search('', types, LIMIT).map((n) => (
        <option key={n.id} value={n.id}>{n.name}</option>
      ))}
    </datalist>
  );
}
