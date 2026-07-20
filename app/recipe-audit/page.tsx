"use client";

import Link from "next/link";
import { Download, ExternalLink, FileJson, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import {
  auditRecipes,
  type RecipeAuditCategory,
  type RecipeAuditReport,
  type RecipeAuditResult,
} from "@/lib/recipeAudit";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import styles from "./recipeAudit.module.css";

const CATEGORY_LABELS: Record<RecipeAuditCategory | "all", string> = {
  all: "All recipes",
  healthy: "Looks correct",
  safe_repair: "Safe repair candidate",
  review: "Needs review",
  no_source: "No original text",
};

const CATEGORY_DESCRIPTIONS: Record<RecipeAuditCategory, string> = {
  healthy: "No meaningful discrepancy detected between the saved recipe and Parser v2.",
  safe_repair: "Parser v2 recovered clearly missing data without a conflicting saved value.",
  review: "The saved recipe and Parser v2 disagree, or the source text could not be parsed reliably.",
  no_source: "There is no raw source text to run through Parser v2.",
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(report: RecipeAuditReport) {
  const headers = [
    "category",
    "title",
    "recipe_id",
    "issue_codes",
    "issues",
    "current_ingredients",
    "parsed_ingredients",
    "ingredient_similarity",
    "current_steps",
    "parsed_steps",
    "method_similarity",
    "current_author",
    "parsed_author",
    "current_url",
    "parsed_url",
  ];
  const rows = report.results.map((result) => [
    result.category,
    result.recipe.title,
    result.recipe.id,
    result.issues.map((issue) => issue.code).join(" | "),
    result.issues.map((issue) => `${issue.label}: ${issue.detail}`).join(" | "),
    result.comparison.currentIngredientCount,
    result.comparison.parsedIngredientCount,
    Math.round(result.comparison.ingredientSimilarity * 100),
    result.comparison.currentStepCount,
    result.comparison.parsedStepCount,
    Math.round(result.comparison.methodSimilarity * 100),
    result.comparison.currentAuthor,
    result.comparison.parsedAuthor,
    result.comparison.currentUrl,
    result.comparison.parsedUrl,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recipe-audit-${report.generatedAt.slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportDiagnostics(report: RecipeAuditReport) {
  const payload = {
    format: "recipe-library-audit-diagnostics-v1",
    generatedAt: report.generatedAt,
    summary: report.summary,
    results: report.results.map((result) => ({
      category: result.category,
      recipeId: result.recipe.id,
      slug: result.recipe.slug,
      issues: result.issues,
      comparison: result.comparison,
      current: {
        title: result.recipe.title,
        author: result.recipe.source.author,
        publication: result.recipe.source.publication,
        sourceType: result.recipe.source.type,
        originalUrl: result.recipe.source.originalUrl,
        servings: result.recipe.yield.servingsDisplay ?? result.recipe.yield.servings,
        rawSourceText: result.recipe.rawSourceText,
        ingredientSections: result.recipe.ingredientSections.map((section) => ({
          title: section.title,
          items: section.items.map((item) => ({
            originalLine: item.originalLine,
            quantity: item.quantity,
            unit: item.unit,
            food: item.canonicalIngredient,
            preparation: item.preparationNote,
          })),
        })),
        methodSections: result.recipe.methodSections.map((section) => ({
          title: section.title,
          steps: section.steps.map((step) => ({ title: step.title, body: step.body })),
        })),
      },
      parsed: result.parsed
        ? {
            title: result.parsed.title,
            author: result.parsed.author,
            publication: result.parsed.publication,
            sourceType: result.parsed.sourceType,
            sourceUrl: result.parsed.sourceUrl,
            servings: result.parsed.servings,
            ingredients: result.parsed.ingredients,
            method: result.parsed.method,
          }
        : null,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recipe-audit-diagnostics-${report.generatedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function scoreLabel(score: number) {
  return `${Math.round(score * 100)}%`;
}

function ResultCard({ result }: { result: RecipeAuditResult }) {
  const currentIngredients = result.recipe.ingredientSections.flatMap((section) =>
    section.items.map((ingredient) => ingredient.originalLine),
  );
  const currentSteps = result.recipe.methodSections.flatMap((section) =>
    section.steps.map((step) => step.body),
  );
  const parsedIngredients = result.parsed?.ingredients ?? [];
  const parsedSteps = result.parsed?.method.map((step) => step.body) ?? [];

  return (
    <details className={`${styles.result} ${styles[result.category]}`}>
      <summary>
        <span className={styles.category}>{CATEGORY_LABELS[result.category]}</span>
        <span className={styles.titleBlock}>
          <strong>{result.recipe.title}</strong>
          <small>
            {result.comparison.currentIngredientCount} ingredients · {result.comparison.currentStepCount} steps
          </small>
        </span>
        <span className={styles.issueCount}>
          {result.issues.length ? `${result.issues.length} finding${result.issues.length === 1 ? "" : "s"}` : "No findings"}
        </span>
      </summary>

      <div className={styles.detailBody}>
        <div className={styles.readOnlyNote}>Read-only report. Nothing on this page writes to Supabase.</div>

        <section className={styles.findings}>
          <h3>Findings</h3>
          <p className={styles.categoryDescription}>{CATEGORY_DESCRIPTIONS[result.category]}</p>
          {result.issues.length ? (
            <div className={styles.issueList}>
              {result.issues.map((issue) => (
                <article className={styles[`issue_${issue.level}`]} key={issue.code}>
                  <strong>{issue.label}</strong>
                  <p>{issue.detail}</p>
                </article>
              ))}
            </div>
          ) : (
            <p>No suspicious difference was detected.</p>
          )}
        </section>

        <section className={styles.comparisonMetrics} aria-label="Saved and reparsed counts">
          <article>
            <span>Ingredients</span>
            <strong>{result.comparison.currentIngredientCount} → {result.comparison.parsedIngredientCount}</strong>
            <small>{scoreLabel(result.comparison.ingredientSimilarity)} exact normalized match</small>
          </article>
          <article>
            <span>Method</span>
            <strong>{result.comparison.currentStepCount} → {result.comparison.parsedStepCount}</strong>
            <small>{scoreLabel(result.comparison.methodSimilarity)} exact normalized match</small>
          </article>
          <article>
            <span>Author</span>
            <strong>{result.comparison.currentAuthor || "—"}</strong>
            <small>Parser v2: {result.comparison.parsedAuthor || "—"}</small>
          </article>
          <article>
            <span>Source text</span>
            <strong>{result.recipe.rawSourceText ? "Available" : "Missing"}</strong>
            <small>{result.recipe.rawSourceText?.length ?? 0} characters</small>
          </article>
        </section>

        {result.parsed && (
          <div className={styles.sideBySide}>
            <section>
              <h3>Saved recipe</h3>
              <dl className={styles.metadata}>
                <div><dt>Title</dt><dd>{result.recipe.title || "—"}</dd></div>
                <div><dt>Author</dt><dd>{result.recipe.source.author || "—"}</dd></div>
                <div><dt>URL</dt><dd>{result.recipe.source.originalUrl || "—"}</dd></div>
              </dl>
              <h4>Ingredients</h4>
              <ol>{currentIngredients.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
              <h4>Method</h4>
              <ol>{currentSteps.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
            </section>

            <section>
              <h3>Parser v2 preview</h3>
              <dl className={styles.metadata}>
                <div><dt>Title</dt><dd>{result.parsed.title || "—"}</dd></div>
                <div><dt>Author</dt><dd>{result.parsed.author || "—"}</dd></div>
                <div><dt>URL</dt><dd>{result.parsed.sourceUrl || "—"}</dd></div>
              </dl>
              <h4>Ingredients</h4>
              <ol>{parsedIngredients.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
              <h4>Method</h4>
              <ol>{parsedSteps.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
            </section>
          </div>
        )}

        <div className={styles.actions}>
          <Link href={`/recipes/${result.recipe.slug || result.recipe.id}`}>
            Open saved recipe <ExternalLink aria-hidden="true" size={15} />
          </Link>
        </div>
      </div>
    </details>
  );
}

export default function RecipeAuditPage() {
  const [report, setReport] = useState<RecipeAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecipeAuditCategory | "all">("all");
  const [visibleCount, setVisibleCount] = useState(50);

  async function loadAudit() {
    setLoading(true);
    setError("");
    try {
      const recipes = await getSupabaseRecipes();
      setReport(auditRecipes(recipes));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not audit recipes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  const filteredResults = useMemo(() => {
    if (!report) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return report.results.filter((result) => {
      if (category !== "all" && result.category !== category) return false;
      if (!normalizedQuery) return true;
      return [
        result.recipe.title,
        result.recipe.source.author ?? "",
        ...result.issues.map((issue) => `${issue.label} ${issue.detail}`),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [category, query, report]);

  useEffect(() => setVisibleCount(50), [category, query]);

  return (
    <AdminGate>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Parser v2 · read-only</p>
            <h1>Existing recipe audit</h1>
            <p>
              Compares every saved recipe with a fresh Parser v2 preview. It does not update,
              repair or delete anything.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className="button" disabled={loading} onClick={() => void loadAudit()} type="button">
              <RefreshCw aria-hidden="true" size={16} /> Refresh
            </button>
            <button className="button" disabled={!report} onClick={() => report && exportCsv(report)} type="button">
              <Download aria-hidden="true" size={16} /> Export summary CSV
            </button>
            <button className="button button--dark" disabled={!report} onClick={() => report && exportDiagnostics(report)} type="button">
              <FileJson aria-hidden="true" size={16} /> Export full diagnostics
            </button>
          </div>
        </header>

        {loading && <section className={styles.message}>Loading and reparsing recipes locally…</section>}
        {error && <section className={`${styles.message} ${styles.error}`}>{error}</section>}

        {report && (
          <>
            <section className={styles.metrics} aria-label="Recipe audit summary">
              <article><span>Total recipes</span><strong>{report.summary.total}</strong></article>
              <article><span>Looks correct</span><strong>{report.summary.healthy}</strong></article>
              <article><span>Safe repair candidates</span><strong>{report.summary.safeRepair}</strong></article>
              <article><span>Needs review</span><strong>{report.summary.review}</strong></article>
              <article><span>No original text</span><strong>{report.summary.noSource}</strong></article>
            </section>

            <section className={styles.controls}>
              <label className={styles.search}>
                <Search aria-hidden="true" size={17} />
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, author or finding"
                  type="search"
                  value={query}
                />
              </label>
              <div className={styles.filters} role="group" aria-label="Audit category">
                {(Object.keys(CATEGORY_LABELS) as Array<RecipeAuditCategory | "all">).map((value) => (
                  <button
                    className={category === value ? styles.activeFilter : ""}
                    key={value}
                    onClick={() => setCategory(value)}
                    type="button"
                  >
                    {CATEGORY_LABELS[value]}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.listHeader}>
              <p>
                Showing {Math.min(visibleCount, filteredResults.length)} of {filteredResults.length} matching recipes.
              </p>
              <p>Audit generated {new Date(report.generatedAt).toLocaleString()}.</p>
            </section>

            <section className={styles.results}>
              {filteredResults.slice(0, visibleCount).map((result) => (
                <ResultCard key={result.recipe.id} result={result} />
              ))}
              {!filteredResults.length && <div className={styles.message}>No recipes match this filter.</div>}
            </section>

            {visibleCount < filteredResults.length && (
              <button className={styles.loadMore} onClick={() => setVisibleCount((count) => count + 50)} type="button">
                Show 50 more
              </button>
            )}
          </>
        )}
      </main>
    </AdminGate>
  );
}
