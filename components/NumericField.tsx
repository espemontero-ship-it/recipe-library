"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState, type InputHTMLAttributes } from "react";
import { parseSimpleNumber } from "@/lib/ingredientParser";

function formatNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}

export function NumericField({
  value,
  onCommit,
  className,
  warningClassName,
  warningText = "Not a number — kept your text",
  ...inputProps
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  className?: string;
  warningClassName?: string;
  warningText?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [text, setText] = useState(value === null ? "" : formatNumber(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!invalid) setText(value === null ? "" : formatNumber(value));
  }, [value, invalid]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setText(next);
    if (!next.trim()) {
      setInvalid(false);
      onCommit(null);
      return;
    }
    const parsed = parseSimpleNumber(next);
    if (parsed !== null) {
      setInvalid(false);
      onCommit(parsed);
    } else {
      setInvalid(true);
    }
  }

  return (
    <>
      <input
        {...inputProps}
        aria-invalid={invalid}
        className={className}
        inputMode="decimal"
        onChange={handleChange}
        title={invalid ? warningText : inputProps.title}
        value={text}
      />
      {invalid && (
        <span className={warningClassName}>
          <AlertTriangle aria-hidden="true" size={12} />
          {warningText}
        </span>
      )}
    </>
  );
}
