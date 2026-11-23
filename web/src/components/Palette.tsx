import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { GraphIndex } from '../core/graph.ts';
import { QUESTIONS, type Param, type Question } from '../core/questions.ts';
import { NodeOptions } from './NodeOptions.tsx';

interface Props {
  index: GraphIndex;
  open: boolean;
  focus?: string;
  onClose: () => void;
  onAsk: (question: string, args: Record<string, string>) => void;
}

/** Ctrl+K question palette. A native <dialog> gives focus trapping and Escape for free. */
export function Palette({ index, open, focus, onClose, onAsk }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  const [question, setQuestion] = useState<Question>();
  const ids = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const reset = () => {
    setFilter('');
    setActive(0);
    setQuestion(undefined);
  };
  const close = () => {
    reset();
    onClose();
  };

  const matches = QUESTIONS.filter((q) => `${q.title} ${q.description}`.toLowerCase().includes(filter.toLowerCase()));

  const choose = (q: Question | undefined) => {
    if (!q) return;
    if (q.params.length === 0) {
      onAsk(q.id, {});
      close();
    } else {
      setQuestion(q);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, matches.length - 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
    else if (e.key === 'Enter') choose(matches[active]);
    else return;
    e.preventDefault();
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!question) return;
    const data = new FormData(e.currentTarget);
    const args: Record<string, string> = {};
    for (const p of question.params) {
      const value = String(data.get(p.name) ?? '').trim();
      if (value) args[p.name] = value;
    }
    onAsk(question.id, args);
    close();
  };

  const focusNode = focus ? index.nodes.get(focus) : undefined;
  // The selected node fills the first node field when its type fits the question.
  const prefill = (p: Param): string => (focusNode && (!p.types || p.types.includes(focusNode.type)) ? focusNode.id : '');

  return (
    <dialog ref={dialog} className="palette" aria-labelledby={`${ids}-title`} onClose={close}>
      <h2 id={`${ids}-title`} className="visually-hidden">Ask a question</h2>
      {!question ? (
        <>
          <input
            autoFocus
            className="palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${ids}-list`}
            aria-activedescendant={matches[active] ? `${ids}-${matches[active].id}` : undefined}
            aria-label="Search questions"
            placeholder="Ask about the architecture…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <ul id={`${ids}-list`} role="listbox" className="palette-list" aria-label="Questions">
            {matches.map((q, i) => (
              <li
                key={q.id}
                id={`${ids}-${q.id}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(q)}
              >
                <span className="q-title">{q.title}</span>
                <span className="q-desc">{q.description}</span>
              </li>
            ))}
            {matches.length === 0 && <li className="empty">No question matches.</li>}
          </ul>
        </>
      ) : (
        <form onSubmit={submit} className="palette-form">
          <p className="q-title">{question.title}</p>
          {question.params.map((p, i) => (
            <label key={p.name}>
              <span>{p.label}{p.optional ? ' (optional)' : ''}</span>
              {p.kind === 'node' && (
                <>
                  <input
                    name={p.name}
                    list={`${ids}-${p.name}-options`}
                    required={!p.optional}
                    autoFocus={i === 0}
                    defaultValue={i === 0 ? prefill(p) : ''}
                    placeholder="Type a name, e.g. orders"
                  />
                  <NodeOptions index={index} id={`${ids}-${p.name}-options`} types={p.types} />
                </>
              )}
              {p.kind === 'depth' && <input name={p.name} type="number" min={1} max={6} defaultValue={2} />}
              {p.kind === 'rule' && (
                <select name={p.name} required autoFocus={i === 0}>
                  {index.findings.rules.map((r) => (
                    <option key={r.id} value={r.id}>{r.id} {r.title}</option>
                  ))}
                </select>
              )}
            </label>
          ))}
          <div className="palette-buttons">
            <button type="button" onClick={() => setQuestion(undefined)}>Back</button>
            <button type="submit" className="primary">Ask</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
