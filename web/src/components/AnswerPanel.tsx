import { useState } from 'react';
import type { GraphIndex } from '../core/graph.ts';
import type { Answer } from '../core/questions.ts';
import { EvidenceList } from './EvidenceList.tsx';

interface Props {
  index: GraphIndex;
  answer?: Answer;
  error?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function AnswerPanel({ index, answer, error, onSelect, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <section className="panel" aria-labelledby="answer-title">
      <header className="panel-head">
        <h2 id="answer-title">{answer?.title ?? 'Question'}</h2>
        <div className="panel-actions">
          {answer && (
            <button type="button" onClick={copy}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close answer">
            ×
          </button>
        </div>
      </header>
      {error && <p role="alert" className="error">{error}</p>}
      {answer && (
        <>
          <p className="summary" aria-live="polite">{answer.summary}</p>
          <ol className="rows">
            {answer.rows.map((row) => (
              <li key={row.label}>
                <button type="button" className="row-title" onClick={() => onSelect(row.nodeIds[0])}>
                  {row.label}
                </button>
                {row.detail && <span className="detail">{row.detail}</span>}
                <EvidenceList index={index} evidence={row.evidence} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
