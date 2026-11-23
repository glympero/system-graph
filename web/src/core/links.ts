import type { Lens } from './lenses.ts';

/** Everything on screen lives in the URL hash, so any view is a link someone can share. */
export interface ViewState {
  lens: Lens;
  focus?: string;
  depth?: number;
  q?: string;
  args?: Record<string, string>;
  finding?: string;
}

const LENS_IDS: readonly Lens[] = ['services', 'events', 'data', 'impact'];

export function encodeState(state: ViewState): string {
  const params = new URLSearchParams();
  params.set('lens', state.lens);
  if (state.focus) params.set('focus', state.focus);
  if (state.depth) params.set('depth', String(state.depth));
  if (state.q) params.set('q', state.q);
  for (const [key, value] of Object.entries(state.args ?? {})) params.set(`a.${key}`, value);
  if (state.finding) params.set('finding', state.finding);
  return `#${params.toString()}`;
}

export function decodeState(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const lens = params.get('lens') as Lens | null;
  const args: Record<string, string> = {};
  for (const [key, value] of params) if (key.startsWith('a.')) args[key.slice(2)] = value;
  const depth = Number(params.get('depth'));
  return {
    lens: lens && LENS_IDS.includes(lens) ? lens : 'services',
    focus: params.get('focus') ?? undefined,
    depth: depth > 0 ? depth : undefined,
    q: params.get('q') ?? undefined,
    args: Object.keys(args).length > 0 ? args : undefined,
    finding: params.get('finding') ?? undefined,
  };
}

/** A deep link into the explorer, used by the MCP server so an assistant's answer opens the same view. */
export function deepLink(base: string, state: ViewState): string {
  return `${base.replace(/#.*$/, '')}${encodeState(state)}`;
}
