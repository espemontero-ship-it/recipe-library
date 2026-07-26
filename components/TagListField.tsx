"use client";

import { useState, type KeyboardEvent } from "react";

export type TagSuggestion = { value: string; count: number };

export function TagListField({
  values,
  onChange,
  placeholder = "Add…",
  containerClassName,
  pillClassName,
  removeClassName,
  inputClassName,
  suggestions = [],
  suggestionsClassName,
  suggestionItemClassName,
  suggestionCountClassName,
  newValueClassName,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  containerClassName?: string;
  pillClassName?: string;
  removeClassName?: string;
  inputClassName?: string;
  suggestions?: TagSuggestion[];
  suggestionsClassName?: string;
  suggestionItemClassName?: string;
  suggestionCountClassName?: string;
  newValueClassName?: string;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  function commit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!values.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      setOpen(false);
    } else if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const term = draft.trim().toLowerCase();
  const existingLower = new Set(values.map((value) => value.toLowerCase()));
  const matches = suggestions
    .filter((suggestion) => !existingLower.has(suggestion.value.toLowerCase()))
    .filter((suggestion) => !term || suggestion.value.toLowerCase().includes(term))
    .slice(0, 6);
  const showNewValue = term.length > 0 && !suggestions.some((suggestion) => suggestion.value.toLowerCase() === term);
  const showDropdown = open && (matches.length > 0 || showNewValue);

  return (
    <>
      <div className={containerClassName}>
        {values.map((value) => (
          <span className={pillClassName} key={value}>
            {value}
            <button
              aria-label={`Remove ${value}`}
              className={removeClassName}
              onClick={() => onChange(values.filter((item) => item !== value))}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className={inputClassName}
          onBlur={() =>
            window.setTimeout(() => {
              commit(draft);
              setOpen(false);
            }, 120)
          }
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length ? "" : placeholder}
          value={draft}
        />
      </div>

      {showDropdown && (
        <ul className={suggestionsClassName}>
          {matches.map((suggestion) => (
            <li key={suggestion.value}>
              <button
                className={suggestionItemClassName}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(suggestion.value);
                  setOpen(false);
                }}
                type="button"
              >
                <span>{suggestion.value}</span>
                <span className={suggestionCountClassName}>{suggestion.count}</span>
              </button>
            </li>
          ))}
          {showNewValue && (
            <li>
              <button
                className={newValueClassName}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(draft);
                  setOpen(false);
                }}
                type="button"
              >
                <span>Add “{draft.trim()}”</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </>
  );
}
