import { useEffect, useRef, useState } from "react";

import { SNIPPET_CLOSE, SNIPPET_OPEN } from "@edenwright/core";

import type { SearchHit } from "../../../preload/api";
import { useAppStore } from "../store";
import "./search-panel.css";

const KIND_OPTIONS = [
  { id: "", label: "All" },
  { id: "manuscript", label: "Manuscript" },
  { id: "codex", label: "Codex" },
  { id: "note", label: "Notes" },
] as const;

function Snippet({ text }: { text: string }) {
  const parts: { text: string; mark: boolean }[] = [];
  let rest = text;
  let marked = false;
  while (rest.length > 0) {
    if (marked) {
      const close = rest.indexOf(SNIPPET_CLOSE);
      if (close === -1) {
        parts.push({ text: rest, mark: true });
        break;
      }
      parts.push({ text: rest.slice(0, close), mark: true });
      rest = rest.slice(close + SNIPPET_CLOSE.length);
      marked = false;
    } else {
      const open = rest.indexOf(SNIPPET_OPEN);
      if (open === -1) {
        parts.push({ text: rest, mark: false });
        break;
      }
      if (open > 0) parts.push({ text: rest.slice(0, open), mark: false });
      rest = rest.slice(open + SNIPPET_OPEN.length);
      marked = true;
    }
  }
  return (
    <>
      {parts.map((part, index) =>
        part.mark ? (
          <mark key={index} className="search-panel__mark">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Global full-text search over the index (§7.3). */
export function SearchPanel() {
  const searchFocusSeq = useAppStore((state) => state.searchFocusSeq);
  const openFileAt = useAppStore((state) => state.openFileAt);
  const setReveal = useAppStore((state) => state.setReveal);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [searchFocusSeq]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearched(false);
    const timer = setTimeout(() => {
      void window.edenwright.query
        .search(trimmed, { kind: kind || undefined })
        .then((hits) => {
          setResults(hits);
          setSearched(true);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, kind]);

  const open = (hit: SearchHit) => {
    const term = query.trim().split(/\s+/)[0] ?? "";
    void openFileAt(hit.path).then(() => {
      if (term) setReveal({ path: hit.path, term });
    });
  };

  return (
    <div className="search-panel">
      <div className="search-panel__header">
        <span className="search-panel__label">Search</span>
      </div>
      <div className="search-panel__controls">
        <input
          ref={inputRef}
          className="search-panel__input"
          placeholder="Search every word in the eden…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="search-panel__kinds">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="search-panel__kind"
              data-active={kind === option.id || undefined}
              onClick={() => setKind(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="search-panel__results">
        {query.trim() && searched && results.length === 0 ? (
          <p className="search-panel__empty">
            Nothing grows by that name — try different words.
          </p>
        ) : null}
        {!query.trim() ? (
          <p className="search-panel__empty">
            Type to search titles and full text, index-fast.
          </p>
        ) : null}
        {results.map((hit) => (
          <button
            key={hit.path}
            type="button"
            className="search-panel__hit"
            onClick={() => open(hit)}
          >
            <span className="search-panel__hit-head">
              <span className="search-panel__hit-title">{hit.title}</span>
              <span className="search-panel__hit-kind">{hit.kind}</span>
            </span>
            <span className="search-panel__hit-path">{hit.path}</span>
            <span className="search-panel__hit-snippet">
              <Snippet text={hit.snippet} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
