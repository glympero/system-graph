import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { useEffect, useMemo, useRef } from 'react';
import Sigma from 'sigma';
import { extremityArrow } from 'sigma/rendering';
import type { View } from '../core/lenses.ts';
import type { Label } from '../core/types.ts';
import { NODE_SIZE, palette } from '../theme.ts';

export interface GraphViewProps {
  view: View;
  highlight: ReadonlySet<string>;
  selected?: string;
  findingByNode: ReadonlyMap<string, Label>;
  showLabels: boolean;
  showFindings: boolean;
  spread: number;
  dark: boolean;
  lensLabel: string;
  onSelect: (id: string | undefined) => void;
}

/** Same id, same starting point: the layout is stable between reloads, so shared links look the same. */
function seeded(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const angle = ((h >>> 0) % 3600) / 3600 * 2 * Math.PI;
  const radius = 50 + ((h >>> 12) % 50);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function layout(view: View, spread: number): Graph {
  const graph = new Graph({ multi: true, type: 'directed' });
  for (const node of view.nodes) {
    const [x, y] = seeded(node.id);
    graph.addNode(node.id, { label: node.label, nodeType: node.type, x, y, size: NODE_SIZE[node.type] ?? 6 });
  }
  for (const edge of view.edges) {
    graph.addDirectedEdgeWithKey(edge.id, edge.from, edge.to, { rel: edge.rel, size: Math.min(4, 1 + edge.edges.length / 2) });
  }
  if (graph.order > 1) {
    const settings = { ...forceAtlas2.inferSettings(graph), scalingRatio: 10 * spread, gravity: 0.5, barnesHutOptimize: false };
    forceAtlas2.assign(graph, { iterations: 400, settings });
  }
  return graph;
}

export function GraphView(props: GraphViewProps) {
  const { view, spread, lensLabel } = props;
  const container = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const latest = useRef(props);
  const graph = useMemo(() => layout(view, spread), [view, spread]);

  useEffect(() => {
    latest.current = props;
    sigmaRef.current?.refresh({ skipIndexation: true });
  });

  useEffect(() => {
    if (!container.current) return;
    const sigma = new Sigma(graph, container.current, {
      primitives: { edges: { extremities: [extremityArrow()], defaultHead: 'arrow' } },
      settings: { itemSizesReference: 'screen', renderEdgeLabels: false, labelDensity: 1, labelRenderedSizeThreshold: 4, stagePadding: 40 },
      nodeReducer: (key, data, attrs) => {
        const p = latest.current;
        const colors = palette(p.dark);
        const finding = p.showFindings ? p.findingByNode.get(key) : undefined;
        const focused = p.highlight.size === 0 || p.highlight.has(key) || key === p.selected;
        const type = attrs.nodeType as keyof typeof colors.node;
        let color = colors.node[type] ?? colors.node.endpoint;
        if (finding && finding !== 'Good') color = colors.finding[finding];
        let labelVisibility: 'auto' | 'visible' | 'hidden' = p.showLabels || key === p.selected ? 'visible' : 'auto';
        if (!focused) labelVisibility = 'hidden';
        return {
          ...data,
          color: focused ? color : colors.dimmed,
          labelColor: colors.label,
          labelVisibility,
          highlighted: key === p.selected,
          zIndex: focused ? 1 : 0,
        };
      },
      edgeReducer: (key, data, attrs) => {
        const p = latest.current;
        const colors = palette(p.dark);
        const [from, , to] = key.split('|');
        const focused = p.highlight.size === 0 || (p.highlight.has(from) && p.highlight.has(to))
          || (p.highlight.size === 0 && (from === p.selected || to === p.selected));
        return { ...data, color: focused ? colors.edge[attrs.rel as keyof typeof colors.edge] ?? colors.edge.calls : colors.dimmed, zIndex: focused ? 1 : 0 };
      },
    });
    sigma.on('clickNode', ({ node }) => latest.current.onSelect(node));
    sigma.on('clickStage', () => latest.current.onSelect(undefined));
    sigmaRef.current = sigma;
    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph]);

  return (
    <div
      ref={container}
      className="graph"
      role="img"
      aria-label={`${lensLabel} lens: ${view.nodes.length} nodes and ${view.edges.length} connections. Use the side panels or the question palette (Ctrl+K) to explore with a keyboard.`}
    />
  );
}
