"use client";

import {
  AlertTriangle,
  Apple,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileCheck2,
  Link2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import {
  snapshotRecipe,
  snapshotsMatch,
  type CompleteRepairPlan,
} from "@/lib/recipeRepairBatch";
import type { Recipe } from "@/lib/recipeModel";
import {
  getRecipeNutritionBackup,
  getRecipeSourceBackup,
  getSupabaseRecipes,
  restoreSupabaseRecipeNutritionBackup,
  restoreSupabaseRecipeRepairBackup,
  restoreSupabaseRecipeSourceBackup,
  updateSupabaseRecipeNutrition,
  updateSupabaseRecipeSource,
  type RecipeNutritionBackupRow,
  type RecipeRepairBackupRow,
  type RecipeSourceBackupRow,
} from "@/lib/supabaseRecipes";
import styles from "./maintenance.module.css";

const APPLY_LOG_KEY = "recipe-library-researched-source-apply-log-v1";
const BATCH_URL = "/researchedSourceBatch.json";
const PLAN_URL = "/completeRepairPlan.json";
const NUTRITION_APPLY_LOG_KEY = "recipe-library-nutrition-estimate-apply-log-v1";
const NUTRITION_BATCH_URL = "/nutritionEstimateBatch.json";

type ResearchedSourceItem = {
  recipeId: string;
  title: string;
  sourceUrl: string;
  confidence: "web_exact" | "duplicate_high";
  evidence: string[];
  sourceMedium: string;
  publication: string | null;
  replaceExisting: boolean;
};

type ResearchedSourceBatch = {
  format: "recipe-library-researched-source-batch-v1";
  generatedAt: string;
  summary: {
    researchedLinks: number;
    exactWebMatches: number;
    exactDuplicateMatches: number;
    imagesIncluded: number;
  };
  items: ResearchedSourceItem[];
};

type ApplyItem = {
  recipeId: string;
  title: string;
  status: "updated" | "unchanged" | "existing_conflict" | "missing" | "conflict" | "failed";
  sourceUrl: string;
  message: string | null;
};

type ApplyLog = {
  format: "recipe-library-researched-source-apply-log-v1";
  generatedAt: string;
  batchGeneratedAt: string;
  summary: {
    checked: number;
    updated: number;
    unchanged: number;
    existingConflicts: number;
    missingRecipes: number;
    updateConflicts: number;
    failed: number;
  };
  items: ApplyItem[];
};

type SourceBackup = {
  format: "recipe-library-source-backup-v1";
  generatedAt: string;
  rows: RecipeSourceBackupRow[];
};

type RepairBackup = {
  format: "recipe-library-repair-backup-v1";
  generatedAt: string;
  planGeneratedAt: string;
  rows: RecipeRepairBackupRow[];
};

type NutritionBatchItem = {
  recipeId: string;
  title: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  note: string | null;
};

type NutritionBatch = {
  format: "recipe-library-nutrition-estimate-batch-v1";
  generatedAt: string;
  summary: { recipesEstimated: number; method: string };
  items: NutritionBatchItem[];
};

type NutritionApplyItem = {
  recipeId: string;
  title: string;
  status: "updated" | "unchanged" | "missing" | "conflict" | "failed";
  fieldsFilled: string[];
  message: string | null;
};

type NutritionApplyLog = {
  format: "recipe-library-nutrition-estimate-apply-log-v1";
  generatedAt: string;
  batchGeneratedAt: string;
  summary: {
    checked: number;
    updated: number;
    unchanged: number;
    missingRecipes: number;
    conflicts: number;
    failed: number;
  };
  items: NutritionApplyItem[];
};

type NutritionBackup = {
  format: "recipe-library-nutrition-backup-v1";
  generatedAt: string;
  rows: RecipeNutritionBackupRow[];
};

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeSourceUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "igsh", "fbclid"].forEach((key) => {
      url.searchParams.delete(key);
    });
    const text = url.toString().replace(/\?$/, "");
    return text.endsWith("/") ? text.slice(0, -1) : text;
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function isOptimisticConflict(message: string) {
  return /changed while|skipped safely/i.test(message);
}

export default function MaintenancePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [batch, setBatch] = useState<ResearchedSourceBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ completed: 0, total: 0, title: "" });
  const [log, setLog] = useState<ApplyLog | null>(null);
  const [repairStatus, setRepairStatus] = useState({ applied: 0, pending: 0, conflicts: 0 });
  const sourceRestoreInput = useRef<HTMLInputElement>(null);
  const repairRestoreInput = useRef<HTMLInputElement>(null);
  const nutritionRestoreInput = useRef<HTMLInputElement>(null);

  const [nutritionBatch, setNutritionBatch] = useState<NutritionBatch | null>(null);
  const [nutritionRunning, setNutritionRunning] = useState(false);
  const [nutritionMessage, setNutritionMessage] = useState("");
  const [nutritionError, setNutritionError] = useState("");
  const [nutritionProgress, setNutritionProgress] = useState({ completed: 0, total: 0, title: "" });
  const [nutritionLog, setNutritionLog] = useState<NutritionApplyLog | null>(null);

  function missingNutritionFields(recipe: Recipe): string[] {
    const fields: string[] = [];
    if (recipe.nutrition.calories.min === null) fields.push("calories");
    if (recipe.nutrition.proteinG.min === null) fields.push("protein");
    if (recipe.nutrition.carbohydratesG.min === null) fields.push("carbs");
    if (recipe.nutrition.fatG.min === null) fields.push("fat");
    if (recipe.nutrition.fiberG.min === null) fields.push("fiber");
    return fields;
  }

  const stats = useMemo(() => {
    const withLink = recipes.filter((recipe) => Boolean(recipe.source.originalUrl)).length;
    const applicable = batch
      ? batch.items.filter((item) => {
          const recipe = recipes.find((candidate) => candidate.id === item.recipeId);
          return recipe && !recipe.source.originalUrl;
        }).length
      : 0;
    const projectedWithLink = Math.min(recipes.length, withLink + applicable);
    const missingNutrition = recipes.filter((recipe) => missingNutritionFields(recipe).length > 0).length;
    return {
      total: recipes.length,
      withLink,
      researched: batch?.items.length ?? 0,
      projectedWithLink,
      stillMissing: Math.max(0, recipes.length - projectedWithLink),
      withImage: recipes.filter((recipe) => Boolean(recipe.media.heroImage)).length,
      missingNutrition,
      nutritionEstimated: nutritionBatch?.items.length ?? 0,
    };
  }, [batch, recipes, nutritionBatch]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [liveRecipes, batchResponse] = await Promise.all([
        getSupabaseRecipes(),
        fetch(BATCH_URL, { cache: "no-store" }),
      ]);
      if (!batchResponse.ok) throw new Error("The researched source batch is missing from this installation.");
      const researchedBatch = (await batchResponse.json()) as ResearchedSourceBatch;
      if (researchedBatch.format !== "recipe-library-researched-source-batch-v1" || !Array.isArray(researchedBatch.items)) {
        throw new Error("The researched source batch has an invalid format.");
      }
      setRecipes(liveRecipes);
      setBatch(researchedBatch);

      try {
        const nutritionResponse = await fetch(NUTRITION_BATCH_URL, { cache: "no-store" });
        if (nutritionResponse.ok) {
          const parsedNutritionBatch = (await nutritionResponse.json()) as NutritionBatch;
          if (parsedNutritionBatch.format === "recipe-library-nutrition-estimate-batch-v1" && Array.isArray(parsedNutritionBatch.items)) {
            setNutritionBatch(parsedNutritionBatch);
          }
        }
      } catch {
        // Nutrition batch is optional; the panel simply stays hidden without it.
      }

      try {
        const planResponse = await fetch(PLAN_URL, { cache: "no-store" });
        if (planResponse.ok) {
          const plan = (await planResponse.json()) as CompleteRepairPlan;
          const byId = new Map(liveRecipes.map((recipe) => [recipe.id, recipe]));
          let applied = 0;
          let pending = 0;
          let conflicts = 0;
          plan.items.filter((item) => item.status === "ready" && item.changedFields.length).forEach((item) => {
            const recipe = byId.get(item.recipeId);
            if (!recipe) { conflicts += 1; return; }
            const snapshot = snapshotRecipe(recipe);
            if (snapshotsMatch(snapshot, item.selected)) applied += 1;
            else if (snapshotsMatch(snapshot, item.expectedSnapshot)) pending += 1;
            else conflicts += 1;
          });
          setRepairStatus({ applied, pending, conflicts });
        }
      } catch {
        // Repair status is informative only.
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Maintenance data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    try {
      const stored = localStorage.getItem(APPLY_LOG_KEY);
      if (stored) setLog(JSON.parse(stored) as ApplyLog);
    } catch {
      // Ignore damaged local maintenance logs.
    }
    try {
      const storedNutrition = localStorage.getItem(NUTRITION_APPLY_LOG_KEY);
      if (storedNutrition) setNutritionLog(JSON.parse(storedNutrition) as NutritionApplyLog);
    } catch {
      // Ignore damaged local maintenance logs.
    }
  }, []);

  async function applyNutritionEstimates() {
    if (!nutritionBatch) return;
    setNutritionRunning(true);
    setNutritionError("");
    setNutritionMessage("");
    const items: NutritionApplyItem[] = [];

    try {
      const liveRecipes = await getSupabaseRecipes();
      const liveById = new Map(liveRecipes.map((recipe) => [recipe.id, recipe]));
      const backupRows = await getRecipeNutritionBackup();
      const backup: NutritionBackup = {
        format: "recipe-library-nutrition-backup-v1",
        generatedAt: new Date().toISOString(),
        rows: backupRows,
      };
      downloadJson(`recipe-library-nutrition-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
      setNutritionProgress({ completed: 0, total: nutritionBatch.items.length, title: "" });

      for (let index = 0; index < nutritionBatch.items.length; index += 1) {
        const item = nutritionBatch.items[index];
        setNutritionProgress({ completed: index, total: nutritionBatch.items.length, title: item.title });
        const recipe = liveById.get(item.recipeId);

        if (!recipe) {
          items.push({ recipeId: item.recipeId, title: item.title, status: "missing", fieldsFilled: [], message: "Recipe not found in the current library." });
          continue;
        }

        const missing = missingNutritionFields(recipe);
        if (!missing.length) {
          items.push({ recipeId: item.recipeId, title: item.title, status: "unchanged", fieldsFilled: [], message: "Already has complete nutrition data." });
          continue;
        }

        const update: Parameters<typeof updateSupabaseRecipeNutrition>[0] = {
          id: recipe.id,
          expectedUpdatedAt: recipe.updatedAt,
        };
        if (missing.includes("calories")) update.calories = item.calories;
        if (missing.includes("protein")) update.protein = item.proteinG;
        if (missing.includes("carbs")) update.carbs = item.carbsG;
        if (missing.includes("fat")) update.fat = item.fatG;
        if (missing.includes("fiber")) update.fiber = item.fiberG;

        try {
          const updated = await updateSupabaseRecipeNutrition(update);
          liveById.set(updated.id, updated);
          items.push({ recipeId: item.recipeId, title: item.title, status: "updated", fieldsFilled: missing, message: item.note });
        } catch (cause) {
          const text = cause instanceof Error ? cause.message : "Nutrition update failed.";
          items.push({
            recipeId: item.recipeId,
            title: item.title,
            status: isOptimisticConflict(text) ? "conflict" : "failed",
            fieldsFilled: [],
            message: text,
          });
        }
      }

      const nextLog: NutritionApplyLog = {
        format: "recipe-library-nutrition-estimate-apply-log-v1",
        generatedAt: new Date().toISOString(),
        batchGeneratedAt: nutritionBatch.generatedAt,
        summary: {
          checked: items.length,
          updated: items.filter((item) => item.status === "updated").length,
          unchanged: items.filter((item) => item.status === "unchanged").length,
          missingRecipes: items.filter((item) => item.status === "missing").length,
          conflicts: items.filter((item) => item.status === "conflict").length,
          failed: items.filter((item) => item.status === "failed").length,
        },
        items,
      };
      setNutritionLog(nextLog);
      localStorage.setItem(NUTRITION_APPLY_LOG_KEY, JSON.stringify(nextLog));
      downloadJson(`recipe-library-nutrition-estimate-apply-log-${new Date().toISOString().slice(0, 10)}.json`, nextLog);
      setNutritionMessage(`${nextLog.summary.updated} recipes filled in with estimated nutrition. AI estimates from ingredients, not lab values.`);
      await refresh();
    } catch (cause) {
      setNutritionError(cause instanceof Error ? cause.message : "The nutrition estimate batch could not be applied.");
    } finally {
      setNutritionRunning(false);
      setNutritionProgress((current) => ({ ...current, completed: current.total, title: "" }));
    }
  }

  async function restoreNutritionBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRestoring(true);
    setNutritionError("");
    try {
      const parsed = JSON.parse(await file.text()) as Partial<NutritionBackup>;
      if (parsed.format !== "recipe-library-nutrition-backup-v1" || !Array.isArray(parsed.rows)) throw new Error("This is not a nutrition backup.");
      setNutritionProgress({ completed: 0, total: parsed.rows.length, title: "Restoring nutrition data" });
      await restoreSupabaseRecipeNutritionBackup(parsed.rows, (completed, total) => setNutritionProgress({ completed, total, title: "Restoring nutrition data" }));
      setNutritionMessage(`${parsed.rows.length} nutrition records restored.`);
      await refresh();
    } catch (cause) {
      setNutritionError(cause instanceof Error ? cause.message : "Nutrition backup could not be restored.");
    } finally {
      setRestoring(false);
    }
  }

  async function applyResearchedLinks() {
    if (!batch) return;
    setRunning(true);
    setError("");
    setMessage("");
    const items: ApplyItem[] = [];

    try {
      const liveRecipes = await getSupabaseRecipes();
      const liveById = new Map(liveRecipes.map((recipe) => [recipe.id, recipe]));
      const backupRows = await getRecipeSourceBackup();
      const backup: SourceBackup = {
        format: "recipe-library-source-backup-v1",
        generatedAt: new Date().toISOString(),
        rows: backupRows,
      };
      downloadJson(`recipe-library-source-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
      setProgress({ completed: 0, total: batch.items.length, title: "" });

      for (let index = 0; index < batch.items.length; index += 1) {
        const item = batch.items[index];
        setProgress({ completed: index, total: batch.items.length, title: item.title });
        const recipe = liveById.get(item.recipeId);

        if (!recipe) {
          items.push({ recipeId: item.recipeId, title: item.title, status: "missing", sourceUrl: item.sourceUrl, message: "Recipe not found in the current library." });
          continue;
        }

        const existing = normalizeSourceUrl(recipe.source.originalUrl);
        const researched = normalizeSourceUrl(item.sourceUrl);
        if (existing && existing === researched) {
          items.push({ recipeId: item.recipeId, title: item.title, status: "unchanged", sourceUrl: item.sourceUrl, message: null });
          continue;
        }
        if (existing && !item.replaceExisting) {
          items.push({ recipeId: item.recipeId, title: item.title, status: "existing_conflict", sourceUrl: item.sourceUrl, message: `Kept existing source: ${recipe.source.originalUrl}` });
          continue;
        }

        try {
          const updated = await updateSupabaseRecipeSource({
            id: recipe.id,
            expectedUpdatedAt: recipe.updatedAt,
            sourceUrl: item.sourceUrl,
            sourceMedium: item.sourceMedium,
            sourceUrlConfidence: item.confidence,
            imageNeedsReview: false,
            ...(item.publication && !recipe.source.publication ? { publication: item.publication } : {}),
          });
          liveById.set(updated.id, updated);
          items.push({ recipeId: item.recipeId, title: item.title, status: "updated", sourceUrl: item.sourceUrl, message: null });
        } catch (cause) {
          const text = cause instanceof Error ? cause.message : "Source link update failed.";
          items.push({
            recipeId: item.recipeId,
            title: item.title,
            status: isOptimisticConflict(text) ? "conflict" : "failed",
            sourceUrl: item.sourceUrl,
            message: text,
          });
        }
      }

      const nextLog: ApplyLog = {
        format: "recipe-library-researched-source-apply-log-v1",
        generatedAt: new Date().toISOString(),
        batchGeneratedAt: batch.generatedAt,
        summary: {
          checked: items.length,
          updated: items.filter((item) => item.status === "updated").length,
          unchanged: items.filter((item) => item.status === "unchanged").length,
          existingConflicts: items.filter((item) => item.status === "existing_conflict").length,
          missingRecipes: items.filter((item) => item.status === "missing").length,
          updateConflicts: items.filter((item) => item.status === "conflict").length,
          failed: items.filter((item) => item.status === "failed").length,
        },
        items,
      };
      setLog(nextLog);
      localStorage.setItem(APPLY_LOG_KEY, JSON.stringify(nextLog));
      downloadJson(`recipe-library-researched-source-apply-log-${new Date().toISOString().slice(0, 10)}.json`, nextLog);
      setMessage(`${nextLog.summary.updated} researched source links applied. No web search was run.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The researched source batch could not be applied.");
    } finally {
      setRunning(false);
      setProgress((current) => ({ ...current, completed: current.total, title: "" }));
    }
  }

  async function restoreSourceBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRestoring(true);
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as Partial<SourceBackup>;
      if (parsed.format !== "recipe-library-source-backup-v1" || !Array.isArray(parsed.rows)) throw new Error("This is not a source backup.");
      setProgress({ completed: 0, total: parsed.rows.length, title: "Restoring source data" });
      await restoreSupabaseRecipeSourceBackup(parsed.rows, (completed, total) => setProgress({ completed, total, title: "Restoring source data" }));
      setMessage(`${parsed.rows.length} source records restored.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Source backup could not be restored.");
    } finally {
      setRestoring(false);
    }
  }

  async function restoreRepairBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRestoring(true);
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as Partial<RepairBackup>;
      if (parsed.format !== "recipe-library-repair-backup-v1" || !Array.isArray(parsed.rows)) throw new Error("This is not a repair backup.");
      setProgress({ completed: 0, total: parsed.rows.length, title: "Restoring recipes" });
      await restoreSupabaseRecipeRepairBackup(parsed.rows, (completed, total) => setProgress({ completed, total, title: "Restoring recipes" }));
      setMessage(`${parsed.rows.length} recipes restored from the repair backup.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Repair backup could not be restored.");
    } finally {
      setRestoring(false);
    }
  }

  const busy = running || restoring;
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const nutritionBusy = nutritionRunning || restoring;
  const nutritionPercent = nutritionProgress.total
    ? Math.round((nutritionProgress.completed / nutritionProgress.total) * 100)
    : 0;

  return (
    <AdminGate>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Maintenance</p>
            <h1>Library maintenance</h1>
            <p>Hidden administrative tools for researched source links, nutrition estimates, backups and the completed repair record.</p>
          </div>
        </header>

        <section className={styles.metrics}>
          <article><span>Recipes</span><strong>{loading ? "—" : stats.total}</strong><small>in the library</small></article>
          <article><span>Source links</span><strong>{loading ? "—" : stats.withLink}</strong><small>already saved</small></article>
          <article><span>Researched batch</span><strong>{loading ? "—" : stats.researched}</strong><small>verified links included</small></article>
          <article><span>After this batch</span><strong>{loading ? "—" : stats.projectedWithLink}</strong><small>recipes with a source</small></article>
          <article><span>Missing nutrition</span><strong>{loading ? "—" : stats.missingNutrition}</strong><small>calories, protein, carbs, fat or fiber</small></article>
          <article><span>Nutrition estimated</span><strong>{loading ? "—" : stats.nutritionEstimated}</strong><small>AI estimates ready to apply</small></article>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelIcon}>{running ? <LoaderCircle className={styles.spin} /> : <FileCheck2 />}</div>
          <div className={styles.panelCopy}>
            <h2>Apply researched source links</h2>
            <p>This is a fixed, manually researched batch. It performs no Google search, makes no external discovery requests and does not attempt image uploads.</p>
          </div>
          <button className="button button--dark" disabled={loading || busy || !batch} onClick={() => void applyResearchedLinks()} type="button">
            <Link2 size={17} /> Apply {batch?.items.length ?? 0} links
          </button>
        </section>

        <div className={`${styles.message} ${styles.warning}`}>
          <AlertTriangle size={19} />
          <span>Images are not included in this batch. The previous image upload failed because Supabase Storage rejected writes under the current RLS policy. No image attempt will be made until storage permissions are fixed separately.</span>
        </div>

        {busy && progress.total > 0 && (
          <section className={styles.progress} aria-live="polite">
            <div><span>{progress.title || "Applying researched links"}</span><strong>{progress.completed} / {progress.total}</strong></div>
            <div className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
          </section>
        )}

        {message && <div className={`${styles.message} ${styles.success}`}><CheckCircle2 size={19} /> <span>{message}</span></div>}
        {error && <div className={`${styles.message} ${styles.danger}`}><AlertTriangle size={19} /> <span>{error}</span></div>}

        {log && (
          <section className={styles.logPanel}>
            <div className={styles.sectionHeading}>
              <div><p className="eyebrow">Latest application</p><h2>Researched source batch log</h2></div>
              <button className="button button--quiet" type="button" onClick={() => downloadJson(`recipe-library-researched-source-apply-log-${new Date().toISOString().slice(0, 10)}.json`, log)}><Download size={17} /> Download log</button>
            </div>
            <div className={styles.logMetrics}>
              <span>{log.summary.updated} updated</span>
              <span>{log.summary.unchanged} already present</span>
              <span>{log.summary.existingConflicts} existing links preserved</span>
              <span>{log.summary.updateConflicts} changed recipes skipped</span>
              <span>{log.summary.failed} failed</span>
            </div>
            {(log.summary.failed > 0 || log.summary.updateConflicts > 0 || log.summary.existingConflicts > 0) && (
              <details className={styles.details}>
                <summary>Show skipped or failed records</summary>
                <ul>{log.items.filter((item) => !["updated", "unchanged"].includes(item.status)).map((item) => <li key={item.recipeId}><strong>{item.title}</strong>: {item.message || item.status}</li>)}</ul>
              </details>
            )}
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.panelIcon}>{nutritionRunning ? <LoaderCircle className={styles.spin} /> : <Apple />}</div>
          <div className={styles.panelCopy}>
            <h2>Apply nutrition estimates</h2>
            <p>AI-estimated calories, protein, carbs, fat and fiber per serving, calculated from each recipe&apos;s ingredient list. These are approximations, not lab-measured values. Only fields that are still empty get filled in — existing values are never overwritten.</p>
          </div>
          <button className="button button--dark" disabled={loading || nutritionBusy || !nutritionBatch} onClick={() => void applyNutritionEstimates()} type="button">
            <Apple size={17} /> Apply {nutritionBatch?.items.length ?? 0} estimates
          </button>
        </section>

        {nutritionBusy && nutritionProgress.total > 0 && (
          <section className={styles.progress} aria-live="polite">
            <div><span>{nutritionProgress.title || "Applying nutrition estimates"}</span><strong>{nutritionProgress.completed} / {nutritionProgress.total}</strong></div>
            <div className={styles.progressTrack}><span style={{ width: `${nutritionPercent}%` }} /></div>
          </section>
        )}

        {nutritionMessage && <div className={`${styles.message} ${styles.success}`}><CheckCircle2 size={19} /> <span>{nutritionMessage}</span></div>}
        {nutritionError && <div className={`${styles.message} ${styles.danger}`}><AlertTriangle size={19} /> <span>{nutritionError}</span></div>}

        {nutritionLog && (
          <section className={styles.logPanel}>
            <div className={styles.sectionHeading}>
              <div><p className="eyebrow">Latest application</p><h2>Nutrition estimate batch log</h2></div>
              <button className="button button--quiet" type="button" onClick={() => downloadJson(`recipe-library-nutrition-estimate-apply-log-${new Date().toISOString().slice(0, 10)}.json`, nutritionLog)}><Download size={17} /> Download log</button>
            </div>
            <div className={styles.logMetrics}>
              <span>{nutritionLog.summary.updated} updated</span>
              <span>{nutritionLog.summary.unchanged} already complete</span>
              <span>{nutritionLog.summary.conflicts} changed recipes skipped</span>
              <span>{nutritionLog.summary.failed} failed</span>
            </div>
            {(nutritionLog.summary.failed > 0 || nutritionLog.summary.conflicts > 0 || nutritionLog.summary.missingRecipes > 0) && (
              <details className={styles.details}>
                <summary>Show skipped or failed records</summary>
                <ul>{nutritionLog.items.filter((item) => !["updated", "unchanged"].includes(item.status)).map((item) => <li key={item.recipeId}><strong>{item.title}</strong>: {item.message || item.status}</li>)}</ul>
              </details>
            )}
          </section>
        )}

        <section className={styles.secondaryGrid}>
          <article className={styles.secondaryPanel}>
            <ShieldCheck />
            <div><h2>Repair batch record</h2><p>{repairStatus.applied} applied · {repairStatus.pending} pending · {repairStatus.conflicts} conflicts.</p></div>
          </article>

          <article className={styles.secondaryPanel}>
            <DatabaseBackup />
            <div>
              <h2>Restore source backup</h2>
              <p>Restore the JSON downloaded before applying a source batch.</p>
              <input ref={sourceRestoreInput} hidden type="file" accept="application/json" onChange={(event) => void restoreSourceBackup(event)} />
              <button className="button button--quiet" disabled={busy} type="button" onClick={() => sourceRestoreInput.current?.click()}><RotateCcw size={17} /> Restore source backup</button>
            </div>
          </article>

          <article className={styles.secondaryPanel}>
            <DatabaseBackup />
            <div>
              <h2>Restore repair backup</h2>
              <p>Restore the backup downloaded before the historical recipe repair.</p>
              <input ref={repairRestoreInput} hidden type="file" accept="application/json" onChange={(event) => void restoreRepairBackup(event)} />
              <button className="button button--quiet" disabled={busy} type="button" onClick={() => repairRestoreInput.current?.click()}><RotateCcw size={17} /> Restore repair backup</button>
            </div>
          </article>

          <article className={styles.secondaryPanel}>
            <DatabaseBackup />
            <div>
              <h2>Restore nutrition backup</h2>
              <p>Restore the JSON downloaded before applying nutrition estimates.</p>
              <input ref={nutritionRestoreInput} hidden type="file" accept="application/json" onChange={(event) => void restoreNutritionBackup(event)} />
              <button className="button button--quiet" disabled={nutritionBusy} type="button" onClick={() => nutritionRestoreInput.current?.click()}><RotateCcw size={17} /> Restore nutrition backup</button>
            </div>
          </article>
        </section>
      </main>
    </AdminGate>
  );
}
