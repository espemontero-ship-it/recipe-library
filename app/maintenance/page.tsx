"use client";

import {
  AlertTriangle,
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
  getRecipeSourceBackup,
  getSupabaseRecipes,
  restoreSupabaseRecipeRepairBackup,
  restoreSupabaseRecipeSourceBackup,
  updateSupabaseRecipeSource,
  type RecipeRepairBackupRow,
  type RecipeSourceBackupRow,
} from "@/lib/supabaseRecipes";
import styles from "./maintenance.module.css";

const APPLY_LOG_KEY = "recipe-library-researched-source-apply-log-v1";
const BATCH_URL = "/researchedSourceBatch.json";
const PLAN_URL = "/completeRepairPlan.json";

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

  const stats = useMemo(() => {
    const withLink = recipes.filter((recipe) => Boolean(recipe.source.originalUrl)).length;
    const applicable = batch
      ? batch.items.filter((item) => {
          const recipe = recipes.find((candidate) => candidate.id === item.recipeId);
          return recipe && !recipe.source.originalUrl;
        }).length
      : 0;
    const projectedWithLink = Math.min(recipes.length, withLink + applicable);
    return {
      total: recipes.length,
      withLink,
      researched: batch?.items.length ?? 0,
      projectedWithLink,
      stillMissing: Math.max(0, recipes.length - projectedWithLink),
      withImage: recipes.filter((recipe) => Boolean(recipe.media.heroImage)).length,
    };
  }, [batch, recipes]);

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
  }, []);

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

  return (
    <AdminGate>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Maintenance</p>
            <h1>Library maintenance</h1>
            <p>Hidden administrative tools for researched source links, backups and the completed repair record.</p>
          </div>
        </header>

        <section className={styles.metrics}>
          <article><span>Recipes</span><strong>{loading ? "—" : stats.total}</strong><small>in the library</small></article>
          <article><span>Source links</span><strong>{loading ? "—" : stats.withLink}</strong><small>already saved</small></article>
          <article><span>Researched batch</span><strong>{loading ? "—" : stats.researched}</strong><small>verified links included</small></article>
          <article><span>After this batch</span><strong>{loading ? "—" : stats.projectedWithLink}</strong><small>recipes with a source</small></article>
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
        </section>
      </main>
    </AdminGate>
  );
}
