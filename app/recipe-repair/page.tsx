"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  RotateCcw,
  Search,
  SkipForward,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { auditRecipes, type RecipeAuditResult } from "@/lib/recipeAudit";
import {
  createDefaultRepairDecision,
  createRepairPlanItem,
  REPAIR_FIELDS,
  resolveRepairSelection,
  type RepairChoice,
  type RepairDecision,
  type RepairField,
} from "@/lib/recipeRepair";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import styles from "./recipeRepair.module.css";

const STORAGE_KEY = "recipe-library-repair-decisions-v0.14.0";

type DecisionMap = Record<string, RepairDecision>;

type Filter = "all" | "unreviewed" | "ready" | "skipped" | "safe" | "review";

const FIELD_LABELS: Record<RepairField, string> = {
  title: "Title",
  author: "Author",
  sourceUrl: "Source URL",
  servings: "Servings",
  ingredients: "Ingredients",
  method: "Method",
};

function loadStoredDecisions(): DecisionMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDecisions(decisions: DecisionMap) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
}

function downloadRepairPlan(results: RecipeAuditResult[], decisions: DecisionMap, generatedAt: string) {
  const items = results
    .map((result) => {
      const decision = decisions[result.recipe.id];
      return decision ? createRepairPlanItem(result, decision) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const payload = {
    format: "recipe-library-repair-plan-v1",
    generatedAt: new Date().toISOString(),
    auditGeneratedAt: generatedAt,
    readOnly: true,
    summary: {
      totalCandidates: results.length,
      ready: items.filter((item) => item.status === "ready").length,
      skipped: items.filter((item) => item.status === "skipped").length,
      unreviewed: results.length - items.length,
    },
    items,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recipe-repair-plan-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function scalarValue(result: RecipeAuditResult, field: Exclude<RepairField, "ingredients" | "method">, source: "saved" | "parser") {
  if (field === "title") return source === "saved" ? result.recipe.title : result.parsed?.title ?? "";
  if (field === "author") return source === "saved" ? result.recipe.source.author ?? "" : result.parsed?.author ?? "";
  if (field === "sourceUrl") return source === "saved" ? result.recipe.source.originalUrl ?? "" : result.parsed?.sourceUrl ?? "";
  const saved = result.recipe.yield.servingsDisplay ?? (result.recipe.yield.servings == null ? "" : String(result.recipe.yield.servings));
  return source === "saved" ? saved : result.parsed?.servings ?? "";
}

function ChoiceButtons({
  choice,
  onChange,
  parserDisabled = false,
}: {
  choice: RepairChoice;
  onChange: (choice: RepairChoice) => void;
  parserDisabled?: boolean;
}) {
  return (
    <div className={styles.choiceButtons} role="group" aria-label="Choose repair source">
      <button className={choice === "saved" ? styles.choiceActive : ""} onClick={() => onChange("saved")} type="button">
        Keep saved
      </button>
      <button className={choice === "parser" ? styles.choiceActive : ""} disabled={parserDisabled} onClick={() => onChange("parser")} type="button">
        Use Parser v2
      </button>
      <button className={choice === "custom" ? styles.choiceActive : ""} onClick={() => onChange("custom")} type="button">
        Custom
      </button>
    </div>
  );
}

function ScalarField({
  field,
  result,
  decision,
  onDecision,
}: {
  field: Exclude<RepairField, "ingredients" | "method">;
  result: RecipeAuditResult;
  decision: RepairDecision;
  onDecision: (next: RepairDecision) => void;
}) {
  const saved = scalarValue(result, field, "saved");
  const parsed = scalarValue(result, field, "parser");
  const choice = decision.choices[field];
  return (
    <section className={styles.fieldCard}>
      <div className={styles.fieldHeader}>
        <h3>{FIELD_LABELS[field]}</h3>
        <ChoiceButtons
          choice={choice}
          onChange={(nextChoice) => onDecision({
            ...decision,
            choices: { ...decision.choices, [field]: nextChoice },
            updatedAt: new Date().toISOString(),
          })}
          parserDisabled={!parsed}
        />
      </div>
      <div className={styles.scalarCompare}>
        <article><span>Saved</span><p>{saved || "—"}</p></article>
        <article><span>Parser v2</span><p>{parsed || "—"}</p></article>
      </div>
      {choice === "custom" && (
        <input
          className={styles.customInput}
          onChange={(event) => onDecision({
            ...decision,
            custom: { ...decision.custom, [field]: event.target.value },
            updatedAt: new Date().toISOString(),
          })}
          value={decision.custom[field]}
        />
      )}
    </section>
  );
}

function ListField({
  field,
  result,
  decision,
  onDecision,
}: {
  field: "ingredients" | "method";
  result: RecipeAuditResult;
  decision: RepairDecision;
  onDecision: (next: RepairDecision) => void;
}) {
  const saved = field === "ingredients"
    ? result.recipe.ingredientSections.flatMap((section) => section.items.map((item) => item.originalLine))
    : result.recipe.methodSections.flatMap((section) => section.steps.map((step) => step.body));
  const parsed = field === "ingredients"
    ? result.parsed?.ingredients ?? []
    : result.parsed?.method.map((step) => step.body) ?? [];
  const choice = decision.choices[field];

  return (
    <section className={styles.fieldCard}>
      <div className={styles.fieldHeader}>
        <div>
          <h3>{FIELD_LABELS[field]}</h3>
          <small>{saved.length} saved · {parsed.length} parsed</small>
        </div>
        <ChoiceButtons
          choice={choice}
          onChange={(nextChoice) => onDecision({
            ...decision,
            choices: { ...decision.choices, [field]: nextChoice },
            updatedAt: new Date().toISOString(),
          })}
          parserDisabled={!parsed.length}
        />
      </div>
      <div className={styles.listCompare}>
        <article>
          <span>Saved</span>
          <ol>{saved.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
        </article>
        <article>
          <span>Parser v2</span>
          <ol>{parsed.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
        </article>
      </div>
      {choice === "custom" && (
        <label className={styles.customArea}>
          <span>{field === "ingredients" ? "One ingredient per line" : "Separate steps with a blank line"}</span>
          <textarea
            onChange={(event) => onDecision({
              ...decision,
              custom: { ...decision.custom, [field]: event.target.value },
              updatedAt: new Date().toISOString(),
            })}
            rows={field === "ingredients" ? 12 : 16}
            value={decision.custom[field]}
          />
        </label>
      )}
    </section>
  );
}

export default function RecipeRepairPage() {
  const [results, setResults] = useState<RecipeAuditResult[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    setDecisions(loadStoredDecisions());
    void (async () => {
      try {
        const report = auditRecipes(await getSupabaseRecipes());
        const candidates = report.results.filter((result) => result.category === "review" || result.category === "safe_repair");
        setResults(candidates);
        setGeneratedAt(report.generatedAt);
        setSelectedId((current) => current || candidates[0]?.recipe.id || "");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load repair candidates.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") saveDecisions(decisions);
  }, [decisions]);

  const effectiveDecision = (result: RecipeAuditResult) => decisions[result.recipe.id] ?? createDefaultRepairDecision(result);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return results.filter((result) => {
      const decision = effectiveDecision(result);
      if (filter === "safe" && result.category !== "safe_repair") return false;
      if (filter === "review" && result.category !== "review") return false;
      if (["unreviewed", "ready", "skipped"].includes(filter) && decision.status !== filter) return false;
      if (!normalized) return true;
      return [result.recipe.title, result.recipe.source.author ?? "", ...result.issues.map((issue) => issue.label)]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [decisions, filter, query, results]);

  const selected = results.find((result) => result.recipe.id === selectedId) ?? filtered[0] ?? null;
  const selectedIndex = selected ? filtered.findIndex((result) => result.recipe.id === selected.recipe.id) : -1;
  const decision = selected ? effectiveDecision(selected) : null;
  const preview = selected && decision ? resolveRepairSelection(selected, decision) : null;

  const statusCounts = useMemo(() => {
    const counts = { unreviewed: 0, ready: 0, skipped: 0 };
    results.forEach((result) => { counts[effectiveDecision(result).status] += 1; });
    return counts;
  }, [decisions, results]);

  function updateDecision(next: RepairDecision) {
    setDecisions((current) => ({ ...current, [next.recipeId]: next }));
  }

  function move(delta: number) {
    if (!filtered.length) return;
    const nextIndex = selectedIndex < 0 ? 0 : Math.min(filtered.length - 1, Math.max(0, selectedIndex + delta));
    setSelectedId(filtered[nextIndex].recipe.id);
  }

  function resetSelected() {
    if (!selected) return;
    setDecisions((current) => {
      const next = { ...current };
      delete next[selected.recipe.id];
      return next;
    });
  }

  return (
    <AdminGate>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Repair workspace · no database writes</p>
            <h1>Review existing recipes</h1>
            <p>Choose what should be kept for every disputed field. Decisions are stored only in this browser until you export a repair plan.</p>
          </div>
          <div className={styles.headerActions}>
            <Link className="button" href="/recipe-audit">Back to audit</Link>
            <button className="button button--dark" disabled={!results.length} onClick={() => downloadRepairPlan(results, decisions, generatedAt)} type="button">
              <Download aria-hidden="true" size={16} /> Export repair plan
            </button>
          </div>
        </header>

        {loading && <div className={styles.message}>Loading repair candidates…</div>}
        {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}

        {!loading && !error && (
          <>
            <section className={styles.metrics}>
              <article><span>Candidates</span><strong>{results.length}</strong></article>
              <article><span>Unreviewed</span><strong>{statusCounts.unreviewed}</strong></article>
              <article><span>Ready</span><strong>{statusCounts.ready}</strong></article>
              <article><span>Skipped</span><strong>{statusCounts.skipped}</strong></article>
            </section>

            <section className={styles.workspace}>
              <aside className={styles.sidebar}>
                <label className={styles.search}>
                  <Search aria-hidden="true" size={16} />
                  <input onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" type="search" value={query} />
                </label>
                <div className={styles.filters}>
                  {(["all", "unreviewed", "ready", "skipped", "safe", "review"] as Filter[]).map((value) => (
                    <button className={filter === value ? styles.filterActive : ""} key={value} onClick={() => setFilter(value)} type="button">
                      {value.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <div className={styles.candidateList}>
                  {filtered.map((result) => {
                    const rowDecision = effectiveDecision(result);
                    return (
                      <button
                        className={`${styles.candidate} ${selected?.recipe.id === result.recipe.id ? styles.candidateActive : ""}`}
                        key={result.recipe.id}
                        onClick={() => setSelectedId(result.recipe.id)}
                        type="button"
                      >
                        <span className={`${styles.statusDot} ${styles[`status_${rowDecision.status}`]}`} />
                        <span><strong>{result.recipe.title}</strong><small>{result.category === "safe_repair" ? "Safe suggestion" : `${result.issues.length} finding${result.issues.length === 1 ? "" : "s"}`}</small></span>
                      </button>
                    );
                  })}
                  {!filtered.length && <p className={styles.empty}>No candidates match this filter.</p>}
                </div>
              </aside>

              <section className={styles.editor}>
                {selected && decision && preview ? (
                  <>
                    <div className={styles.recipeHeader}>
                      <div>
                        <div className={styles.badges}>
                          <span>{selected.category === "safe_repair" ? "Safe repair candidate" : "Needs review"}</span>
                          <span>{decision.status}</span>
                        </div>
                        <h2>{selected.recipe.title}</h2>
                        <p>{selected.issues.map((issue) => issue.label).join(" · ")}</p>
                      </div>
                      <Link href={`/recipes/${selected.recipe.slug || selected.recipe.id}`} target="_blank">
                        Open recipe <ExternalLink aria-hidden="true" size={15} />
                      </Link>
                    </div>

                    <details className={styles.sourceText}>
                      <summary>Original source text</summary>
                      <pre>{selected.recipe.rawSourceText || "No source text"}</pre>
                    </details>

                    <ScalarField field="title" result={selected} decision={decision} onDecision={updateDecision} />
                    <ScalarField field="author" result={selected} decision={decision} onDecision={updateDecision} />
                    <ScalarField field="sourceUrl" result={selected} decision={decision} onDecision={updateDecision} />
                    <ScalarField field="servings" result={selected} decision={decision} onDecision={updateDecision} />
                    <ListField field="ingredients" result={selected} decision={decision} onDecision={updateDecision} />
                    <ListField field="method" result={selected} decision={decision} onDecision={updateDecision} />

                    <section className={styles.preview}>
                      <div className={styles.previewHeader}>
                        <div><p className="eyebrow">Selected result</p><h3>{preview.title || "Untitled recipe"}</h3></div>
                        <span>{preview.ingredients.length} ingredients · {preview.method.length} steps</span>
                      </div>
                      <dl>
                        <div><dt>Author</dt><dd>{preview.author || "—"}</dd></div>
                        <div><dt>Servings</dt><dd>{preview.servings || "—"}</dd></div>
                        <div><dt>URL</dt><dd>{preview.sourceUrl || "—"}</dd></div>
                      </dl>
                    </section>

                    <div className={styles.reviewActions}>
                      <button className="button" onClick={resetSelected} type="button"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
                      <button className="button" onClick={() => updateDecision({ ...decision, status: "skipped", updatedAt: new Date().toISOString() })} type="button"><SkipForward aria-hidden="true" size={16} /> Skip for now</button>
                      {selected.category === "safe_repair" && (
                        <button className="button" onClick={() => updateDecision(createDefaultRepairDecision(selected))} type="button"><WandSparkles aria-hidden="true" size={16} /> Restore safe suggestions</button>
                      )}
                      <button className="button button--dark" onClick={() => updateDecision({ ...decision, status: "ready", updatedAt: new Date().toISOString() })} type="button"><Check aria-hidden="true" size={16} /> Mark ready</button>
                    </div>

                    <div className={styles.pager}>
                      <button disabled={selectedIndex <= 0} onClick={() => move(-1)} type="button"><ChevronLeft aria-hidden="true" size={17} /> Previous</button>
                      <span>{selectedIndex + 1} of {filtered.length}</span>
                      <button disabled={selectedIndex < 0 || selectedIndex >= filtered.length - 1} onClick={() => move(1)} type="button">Next <ChevronRight aria-hidden="true" size={17} /></button>
                    </div>
                  </>
                ) : (
                  <div className={styles.message}>Select a recipe to review.</div>
                )}
              </section>
            </section>
          </>
        )}
      </main>
    </AdminGate>
  );
}
