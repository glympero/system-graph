import { useEffect, useMemo, useState } from 'react';
import { AnswerPanel } from './components/AnswerPanel.tsx';
import { DetailsPanel } from './components/DetailsPanel.tsx';
import { FindingsPanel } from './components/FindingsPanel.tsx';
import { GraphView } from './components/GraphView.tsx';
import { Legend } from './components/Legend.tsx';
import { Palette } from './components/Palette.tsx';
import type { GraphIndex } from './core/graph.ts';
import { buildView, displayId, LENSES, type Lens } from './core/lenses.ts';
import { runQuestion, type Answer } from './core/questions.ts';
import type { Label } from './core/types.ts';
import { useGraph, usePrefersDark, useViewState } from './state.ts';

const SEVERITY: Record<Label, number> = { Bad: 3, Gap: 2, Good: 1 };

export function App() {
  const loaded = useGraph();
  if (!loaded) return <main className="status">Loading graph…</main>;
  if (loaded.error !== undefined) {
    return (
      <main className="status" role="alert">
        <h1>No graph to show</h1>
        <p>
          Could not load <code>graph.json</code> ({loaded.error}). Build one first with <code>npm run graph</code>.
        </p>
      </main>
    );
  }
  return <Explorer index={loaded.index} />;
}

function Explorer({ index }: { index: GraphIndex }) {
  const [state, update] = useViewState();
  const dark = usePrefersDark();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [labels, setLabels] = useState(true);
  const [showFindings, setShowFindings] = useState(true);
  const [spread, setSpread] = useState(1);
  const { lens, focus } = state;
  const depth = state.depth ?? 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const view = useMemo(() => buildView(index, lens, focus, depth), [index, lens, focus, depth]);

  const { answer, error } = useMemo((): { answer?: Answer; error?: string } => {
    if (!state.q) return {};
    try {
      return { answer: runQuestion(index, state.q, state.args ?? {}) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [index, state.q, state.args]);

  const finding = index.findings.findings.find((f) => f.id === state.finding);

  const highlight = useMemo(() => {
    const asked = Object.values(state.args ?? {}).flatMap((arg) => index.resolve(arg)?.id ?? []);
    const ids = finding ? finding.nodes : [...asked, ...(answer?.rows.flatMap((r) => r.nodeIds) ?? [])];
    const shown = new Set<string>();
    for (const id of ids) {
      const placed = index.nodes.has(id) ? displayId(index, lens, id) : undefined;
      if (placed) shown.add(placed);
    }
    return shown;
  }, [index, lens, finding, answer, state.args]);

  const findingByNode = useMemo(() => {
    const worst = new Map<string, Label>();
    for (const f of index.findings.findings) {
      // Only the subject is coloured; the other nodes of a finding show up when it is selected.
      const placed = displayId(index, lens, f.subject);
      const current = placed ? worst.get(placed) : undefined;
      if (placed && (!current || SEVERITY[f.label] > SEVERITY[current])) worst.set(placed, f.label);
    }
    return worst;
  }, [index, lens]);

  const node = focus ? index.nodes.get(focus) : undefined;
  const selected = node ? displayId(index, lens, node.id) : undefined;
  const lensInfo = LENSES.find((l) => l.id === lens) ?? LENSES[0];

  const ask = (q: string, args: Record<string, string>) => update({ q, args, finding: undefined });
  const selectNode = (id: string | undefined) => update({ focus: id });

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>system-graph</h1>
          <span className="estate">
            {index.data.name} · built {index.data.built.slice(0, 10)}
          </span>
        </div>
        <nav aria-label="Lenses" className="lenses">
          {LENSES.map((l) => (
            <button key={l.id} type="button" aria-pressed={l.id === lens} title={l.hint} onClick={() => update({ lens: l.id as Lens })}>
              {l.label}
            </button>
          ))}
        </nav>
        <label className="find">
          <span className="visually-hidden">Find a node</span>
          <input
            list="all-nodes"
            placeholder="Find a node…"
            onChange={(e) => index.nodes.has(e.target.value) && selectNode(e.target.value)}
          />
          <datalist id="all-nodes">
            {index.search('', undefined, 1000).map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </datalist>
        </label>
        <button type="button" className="primary ask" onClick={() => setPaletteOpen(true)}>
          Ask a question <kbd>Ctrl K</kbd>
        </button>
        <details className="options">
          <summary>Options</summary>
          <div className="options-body">
            <label><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Show all labels</label>
            <label><input type="checkbox" checked={showFindings} onChange={(e) => setShowFindings(e.target.checked)} /> Colour nodes with findings</label>
            <label>
              Spread
              <input type="range" min={0.5} max={3} step={0.25} value={spread} onChange={(e) => setSpread(Number(e.target.value))} />
            </label>
          </div>
        </details>
      </header>

      <main className="workspace">
        <div className="canvas">
          {lens === 'impact' && (
            <div className="lens-bar">
              {node ? (
                <label>
                  Impact of <strong>{node.name}</strong> within
                  <input type="number" min={1} max={6} value={depth} onChange={(e) => update({ depth: Number(e.target.value) || 1 })} />
                  steps
                </label>
              ) : (
                <p>Select a node, or find one above, to see what depends on it.</p>
              )}
            </div>
          )}
          <GraphView
            view={view}
            highlight={highlight}
            selected={selected}
            findingByNode={findingByNode}
            showLabels={labels}
            showFindings={showFindings}
            spread={spread}
            dark={dark}
            lensLabel={lensInfo.label}
            onSelect={selectNode}
          />
          <Legend dark={dark} lens={lens} />
        </div>
        <aside className="sidebar" aria-label="Details and answers">
          {(answer || error) && (
            <AnswerPanel index={index} answer={answer} error={error} onSelect={selectNode} onClose={() => update({ q: undefined, args: undefined })} />
          )}
          {node && (
            <DetailsPanel
              index={index}
              node={node}
              onAsk={(q, id) => ask(q, { node: id })}
              onImpactLens={(id) => update({ lens: 'impact', focus: id })}
              onClose={() => selectNode(undefined)}
            />
          )}
          <FindingsPanel
            index={index}
            selected={state.finding}
            onSelect={(f) => update({ finding: f?.id, focus: f?.subject, q: undefined, args: undefined })}
          />
        </aside>
      </main>
      <Palette index={index} open={paletteOpen} focus={focus} onClose={() => setPaletteOpen(false)} onAsk={ask} />
    </div>
  );
}
