"use client";

import { useState, type KeyboardEvent } from "react";

export function TagListField({
  values,
  onChange,
  placeholder = "Add…",
  containerClassName,
  pillClassName,
  removeClassName,
  inputClassName,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  containerClassName?: string;
  pillClassName?: string;
  removeClassName?: string;
  inputClassName?: string;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) onChange([...values, trimmed]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
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
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={values.length ? "" : placeholder}
        value={draft}
      />
    </div>
  );
}
