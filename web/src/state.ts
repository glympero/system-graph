import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { GraphIndex } from './core/graph.ts';
import { decodeState, encodeState, type ViewState } from './core/links.ts';
import type { FindingsData, GraphData } from './core/types.ts';

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The view state lives in the URL hash; every change is a history entry, so Back works and links can be shared. */
export function useViewState(): [ViewState, (next: Partial<ViewState>) => void] {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const state = useMemo(() => decodeState(hash), [hash]); // stable objects, so memos downstream do not rerun
  const update = useCallback((next: Partial<ViewState>) => {
    window.location.hash = encodeState({ ...decodeState(window.location.hash), ...next });
  }, []);
  return [state, update];
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeDark(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const prefersDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribeDark, prefersDark);
}

type Loaded = { index: GraphIndex; error?: undefined } | { index?: undefined; error: string };

export function useGraph(): Loaded | undefined {
  const [loaded, setLoaded] = useState<Loaded>();
  useEffect(() => {
    let live = true;
    const get = async <T,>(name: string): Promise<T> => {
      const res = await fetch(`./${name}`);
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      return (await res.json()) as T;
    };
    Promise.all([get<GraphData>('graph.json'), get<FindingsData>('findings.json')])
      .then(([graph, findings]) => live && setLoaded({ index: new GraphIndex(graph, findings) }))
      .catch((err: unknown) => live && setLoaded({ error: err instanceof Error ? err.message : String(err) }));
    return () => {
      live = false;
    };
  }, []);
  return loaded;
}
