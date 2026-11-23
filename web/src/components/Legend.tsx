import type { Lens } from '../core/lenses.ts';
import type { NodeType } from '../core/types.ts';
import { palette, TYPE_LABEL } from '../theme.ts';

const BY_LENS: Record<Lens, readonly NodeType[]> = {
  services: ['service', 'topic', 'schema'],
  events: ['service', 'topic', 'subscription'],
  data: ['service', 'table'],
  impact: ['service', 'topic', 'table', 'subscription'],
};

export function Legend({ dark, lens }: { dark: boolean; lens: Lens }) {
  const colors = palette(dark);
  return (
    <div className="legend" aria-label="Legend">
      <ul>
        {BY_LENS[lens].map((type) => (
          <li key={type}>
            <span className="swatch" style={{ background: colors.node[type] }} aria-hidden="true" />
            {TYPE_LABEL[type]}
          </li>
        ))}
        <li>
          <span className="swatch" style={{ background: colors.finding.Bad }} aria-hidden="true" />
          Bad finding
        </li>
        <li>
          <span className="swatch" style={{ background: colors.finding.Gap }} aria-hidden="true" />
          Gap finding
        </li>
      </ul>
    </div>
  );
}
