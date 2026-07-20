"use client";

import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Upload,
  Wrench,
} from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import {
  snapshotRecipe,
  snapshotsMatch,
  type CompleteRepairPlan,
  type CompleteRepairPlanItem,
} from "@/lib/recipeRepairBatch";
import {
  applySupabaseRecipeRepair,
  getRecipeRepairBackup,
  getSupabaseRecipes,
  restoreSupabaseRecipeRepairBackup,
  type RecipeRepairBackupRow,
} from "@/lib/supabaseRecipes";
import styles from "./recipeRepairBatch.module.css";

const PLAN_URL = "/completeRepairPlan.json";

type BatchState = {
  applicable: CompleteRepairPlanItem[];
  alreadyApplied: CompleteRepairPlanItem[];
  conflicts: CompleteRepairPlanItem[];
  missing: CompleteRepairPlanItem[];
};

type RepairBackup = {
  format: "recipe-library-repair-backup-v1";
  generatedAt: string;
  planGeneratedAt: string;
  rows: RecipeRepairBackupRow[];
};

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function emptyBatchState(): BatchState {
  return { applicable: [], alreadyApplied: [], conflicts: [], missing: [] };
}

export default function RecipeRepairBatchPage() {
  const [plan, setPlan] = useState<CompleteRepairPlan | null>(null);
  const [batch, setBatch] = useState<BatchState>(emptyBatchState);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<Array<{ title: string; message: string }>>([]);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const readyPlanItems = useMemo(
    () => plan?.items.filter((item) => item.status === "ready" && item.changedFields.length > 0) ?? [],
    [plan],
  );

  const inspectLiveLibrary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const recipes = await getSupabaseRecipes();
      const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
      const next = emptyBatchState();

      readyPlanItems.forEach((item) => {
        const recipe = byId.get(item.recipeId);
        if (!recipe) {
          next.missing.push(item);
          return;
        }
        const live = snapshotRecipe(recipe);
        if (snapshotsMatch(live, item.selected)) {
          next.alreadyApplied.push(item);
        } else if (snapshotsMatch(live, item.expectedSnapshot)) {
          next.applicable.push(item);
        } else {
          next.conflicts.push(item);
        }
      });

      setBatch(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The repair batch could not be checked.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [readyPlanItems]);

  useEffect(() => {
    let active = true;
    async function loadPlan() {
      setLoading(true);
      try {
        const response = await fetch(PLAN_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("The complete repair plan could not be loaded.");
        const loaded = (await response.json()) as CompleteRepairPlan;
        if (loaded.format !== "recipe-library-complete-repair-plan-v1") {
          throw new Error("The bundled repair plan has an invalid format.");
        }
        if (active) setPlan(loaded);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "The repair plan could not be loaded.");
          setLoading(false);
        }
      }
    }
    void loadPlan();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (plan) void inspectLiveLibrary();
  }, [plan, inspectLiveLibrary]);

  async function applyBatch() {
    if (!plan) return;
    setRunning(true);
    setError("");
    setMessage("");
    setFailures([]);

    try {
      const checked = await inspectLiveLibrary();
      if (!checked) return;
      if (!checked.applicable.length) {
        setMessage(
          checked.alreadyApplied.length
            ? "The complete repair batch is already applied."
            : "There are no conflict-free repairs to apply.",
        );
        return;
      }

      const backupRows = await getRecipeRepairBackup(
        checked.applicable.map((item) => item.recipeId),
      );
      const backup: RepairBackup = {
        format: "recipe-library-repair-backup-v1",
        generatedAt: new Date().toISOString(),
        planGeneratedAt: plan.generatedAt,
        rows: backupRows,
      };
      downloadJson(
        `recipe-library-backup-before-v0.15.0-${new Date().toISOString().slice(0, 10)}.json`,
        backup,
      );

      setProgress({ completed: 0, total: checked.applicable.length });
      const failed: Array<{ title: string; message: string }> = [];
      let completed = 0;

      for (const item of checked.applicable) {
        try {
          await applySupabaseRecipeRepair(item);
        } catch (cause) {
          failed.push({
            title: item.title,
            message: cause instanceof Error ? cause.message : "Unknown update error",
          });
        }
        completed += 1;
        setProgress({ completed, total: checked.applicable.length });
      }

      setFailures(failed);
      await inspectLiveLibrary();
      setMessage(
        failed.length
          ? `${checked.applicable.length - failed.length} recipes repaired; ${failed.length} failed and were left unchanged.`
          : `${checked.applicable.length} recipes repaired. A rollback backup was downloaded automatically.`,
      );
    } finally {
      setRunning(false);
    }
  }

  async function restoreBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setRestoring(true);
    setError("");
    setMessage("");
    try {
      const parsed = JSON.parse(await file.text()) as Partial<RepairBackup>;
      if (parsed.format !== "recipe-library-repair-backup-v1" || !Array.isArray(parsed.rows)) {
        throw new Error("This is not a Recipe Library repair backup.");
      }
      setProgress({ completed: 0, total: parsed.rows.length });
      await restoreSupabaseRecipeRepairBackup(parsed.rows, (completed, total) => {
        setProgress({ completed, total });
      });
      await inspectLiveLibrary();
      setMessage(`${parsed.rows.length} recipes restored from the selected backup.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The backup could not be restored.");
    } finally {
      setRestoring(false);
    }
  }

  const busy = running || restoring;
  const progressPercent = progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <AdminGate>
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Complete library repair</p>
            <h1>One batch. No recipe-by-recipe review.</h1>
            <p>
              The prepared batch repairs every conflict-free recipe, preserves the recipes that were
              already correct, downloads a rollback backup first and skips anything changed since the audit.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className="button button--quiet"
              disabled={busy}
              onClick={() => plan && downloadJson("recipe-library-complete-repair-plan-v0.15.0.json", plan)}
              type="button"
            >
              <Download aria-hidden="true" size={16} /> Download plan
            </button>
            <input
              accept="application/json,.json"
              onChange={restoreBackupFile}
              ref={restoreInputRef}
              style={{ display: "none" }}
              type="file"
            />
            <button
              className="button button--quiet"
              disabled={busy}
              onClick={() => restoreInputRef.current?.click()}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} /> Restore backup
            </button>
          </div>
        </header>

        <section className={styles.metrics}>
          <article><span>Library</span><strong>{plan?.summary.totalRecipes ?? "—"}</strong><small>recipes checked</small></article>
          <article><span>Already correct</span><strong>{plan ? plan.summary.alreadyHealthy + plan.summary.skippedNoChange : "—"}</strong><small>left untouched</small></article>
          <article><span>Prepared repairs</span><strong>{readyPlanItems.length}</strong><small>validated changes</small></article>
          <article><span>Ready now</span><strong>{loading ? "—" : batch.applicable.length}</strong><small>snapshot matches</small></article>
        </section>

        <section className={styles.controlPanel}>
          <div className={styles.controlIcon}>
            {loading ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : <Wrench aria-hidden="true" />}
          </div>
          <div className={styles.controlCopy}>
            <h2>{loading ? "Checking the live library…" : "Complete repair batch is prepared"}</h2>
            <p>
              {loading
                ? "Comparing the current recipes with the audited snapshots."
                : `${batch.applicable.length} can be repaired now, ${batch.alreadyApplied.length} are already repaired, and ${batch.conflicts.length + batch.missing.length} will be skipped safely.`}
            </p>
          </div>
          <button
            className="button button--dark"
            disabled={loading || busy || batch.applicable.length === 0}
            onClick={() => void applyBatch()}
            type="button"
          >
            {running ? <LoaderCircle className={styles.spin} aria-hidden="true" size={17} /> : <ShieldCheck aria-hidden="true" size={17} />}
            {running ? "Applying repairs…" : `Apply ${batch.applicable.length} repairs`}
          </button>
        </section>

        {busy && progress.total > 0 && (
          <section className={styles.progress} aria-live="polite">
            <div><span>{restoring ? "Restoring backup" : "Repairing recipes"}</span><strong>{progress.completed} / {progress.total}</strong></div>
            <div className={styles.progressTrack}><span style={{ width: `${progressPercent}%` }} /></div>
          </section>
        )}

        {message && <div className={`${styles.message} ${styles.success}`}><CheckCircle2 aria-hidden="true" size={18} /> {message}</div>}
        {error && <div className={`${styles.message} ${styles.danger}`}><AlertTriangle aria-hidden="true" size={18} /> {error}</div>}

        {!loading && (batch.conflicts.length > 0 || batch.missing.length > 0) && (
          <details className={styles.conflicts}>
            <summary>
              <AlertTriangle aria-hidden="true" size={17} />
              {batch.conflicts.length + batch.missing.length} recipes will be skipped because their live data no longer matches the audit
            </summary>
            <ul>
              {[...batch.conflicts, ...batch.missing].map((item) => <li key={item.recipeId}>{item.title}</li>)}
            </ul>
          </details>
        )}

        {failures.length > 0 && (
          <details className={styles.conflicts} open>
            <summary><AlertTriangle aria-hidden="true" size={17} /> {failures.length} update failures</summary>
            <ul>{failures.map((failure) => <li key={failure.title}><strong>{failure.title}</strong>: {failure.message}</li>)}</ul>
          </details>
        )}

        <section className={styles.guarantees}>
          <article><DatabaseBackup aria-hidden="true" /><div><h3>Backup first</h3><p>The original database rows download before the first update.</p></div></article>
          <article><ShieldCheck aria-hidden="true" /><div><h3>Conflict protection</h3><p>A recipe changed after the audit is skipped, never overwritten.</p></div></article>
          <article><Upload aria-hidden="true" /><div><h3>Rollback included</h3><p>The downloaded backup can be restored from this same screen.</p></div></article>
        </section>
      </main>
    </AdminGate>
  );
}
