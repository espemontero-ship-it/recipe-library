"use client";

import {
  ArrowLeft,
  ClipboardPaste,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { RecipeEditor } from "@/components/RecipeEditor";
import { parseIngredientLine } from "@/lib/ingredientParser";
import {
  createRecipeFromInput,
  slugifyRecipeTitle,
  type Recipe,
} from "@/lib/recipeModel";
import {
  extractPasteContextFromHtml,
  normalizeSourceUrl,
  parseRecipe,
  type PasteContext,
} from "@/lib/recipePasteParser";
import { createSupabaseRecipeFromRecipe } from "@/lib/supabaseRecipes";
import styles from "./paste.module.css";

const SAMPLE_RECIPE = `Lemon yoghurt chicken
By Example Cook
4 servings
45 minutes

Ingredients
600 g chicken breast, diced
200 g Greek yoghurt 0%
1 tbsp olive oil
1 lemon, zest and juice
2 garlic cloves, grated
Salt and black pepper, to taste

Preparation
Step 1
Mix the yoghurt, lemon, garlic, salt and pepper. Coat the chicken and rest for 20 minutes.

Step 2
Cook the chicken until golden and fully cooked. Serve immediately.`;

function numeric(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function draftFromParser(raw: string, parsed: ReturnType<typeof parseRecipe>): Recipe {
  const now = new Date().toISOString();
  const recipe = createRecipeFromInput({
    title: parsed.title,
    summary: parsed.summary,
    author: parsed.author,
    publication: parsed.publication,
    sourceType: parsed.sourceType,
    originalUrl: parsed.sourceUrl,
    servings: parsed.servings,
    time: parsed.time,
    prepMinutes: numeric(parsed.prepMinutes),
    cookMinutes: numeric(parsed.cookMinutes),
    restingMinutes: numeric(parsed.restingMinutes),
    marinatingMinutes: numeric(parsed.marinatingMinutes),
    totalMinutes: numeric(parsed.totalMinutes),
    ingredientSections: [
      {
        id: `ingredient_section_${crypto.randomUUID()}`,
        title: null,
        items: parsed.ingredients.map(parseIngredientLine),
      },
    ],
    methodSections: [
      {
        id: `method_section_${crypto.randomUUID()}`,
        title: null,
        steps: parsed.method.map((step) => ({
          id: `step_${crypto.randomUUID()}`,
          title: step.title || null,
          body: step.body,
          durationMinutes: null,
          temperatureC: null,
        })),
      },
    ],
    servingSuggestion: parsed.servingSuggestion,
    publicNotes: parsed.publicNotes,
    mainIngredients: parsed.mainIngredients,
    dish: parsed.dish,
    formats: parsed.formats,
    mealTypes: parsed.mealTypes,
    methods: parsed.methods,
    cuisines: parsed.cuisines,
    collections: parsed.collections,
    rawSourceText: raw,
    image: parsed.imageUrl,
  });

  return {
    ...recipe,
    id: crypto.randomUUID(),
    slug: slugifyRecipeTitle(parsed.title) || `recipe-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
}

function PasteRecipePageContent() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [pasteContext, setPasteContext] = useState<PasteContext>({});
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    const uri = event.clipboardData
      .getData("text/uri-list")
      .split(/\r?\n/)
      .find((line) => /^https?:\/\//i.test(line.trim()));
    const htmlContext = extractPasteContextFromHtml(html);

    setPasteContext((current) => ({
      sourceUrl:
        htmlContext.sourceUrl ||
        (uri ? normalizeSourceUrl(uri) : "") ||
        current.sourceUrl,
      imageUrl: htmlContext.imageUrl || current.imageUrl,
    }));
  }

  async function parsePastedRecipe() {
    if (!raw.trim()) {
      setError("Paste the recipe text first.");
      return;
    }

    setParsing(true);
    setError("");
    try {
      let parsed = parseRecipe(raw, pasteContext);

      if (parsed.sourceUrl) {
        try {
          const response = await fetch("/api/source-metadata", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: parsed.sourceUrl }),
          });
          const metadata = (await response.json()) as {
            sourceUrl?: string | null;
            author?: string | null;
            siteName?: string | null;
            imageUrl?: string | null;
          };
          parsed = {
            ...parsed,
            sourceUrl: metadata.sourceUrl || parsed.sourceUrl,
            author: parsed.author || metadata.author || "",
            publication: parsed.publication || metadata.siteName || "",
            imageUrl: parsed.imageUrl || metadata.imageUrl || "",
            imageStatus: parsed.imageUrl || metadata.imageUrl ? "found_source" : "missing",
          };
        } catch {
          // The recipe remains fully editable if the source blocks metadata lookup.
        }
      }

      setDraft(draftFromParser(raw, parsed));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The recipe could not be parsed.");
    } finally {
      setParsing(false);
    }
  }

  if (draft) {
    return (
      <RecipeEditor
        initialRecipe={draft}
        mode="review"
        onCancel={() => setDraft(null)}
        onSave={async (recipe) => {
          const saved = await createSupabaseRecipeFromRecipe(recipe);
          router.push(`/recipes/${saved.slug}`);
          router.refresh();
        }}
      />
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link className={styles.backLink} href="/browse">
          <ArrowLeft aria-hidden="true" size={16} /> Back to recipes
        </Link>
        <span className={styles.version}>Import and review</span>
      </div>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>Add recipe</p>
        <h1>Paste first. Correct everything before saving.</h1>
        <p>
          The parser extracts the recipe, then opens the same complete editor used later from the recipe page.
          Recipe ingredients are parsed for editing and shopping. Add manual macros per serving when you have them.
        </p>
      </section>

      <div className={styles.pasteLayout}>
        <section className={styles.pastePanel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.stepLabel}>Step 1</span>
              <h2>Paste the complete recipe</h2>
            </div>
            <ClipboardPaste aria-hidden="true" size={26} />
          </div>

          <textarea
            onChange={(event) => setRaw(event.target.value)}
            onPaste={handlePaste}
            placeholder="Paste the recipe text and its URL here…"
            value={raw}
          />

          {error && <p className={styles.errorMessage}>{error}</p>}

          <div className={styles.pasteActions}>
            <button className={styles.sampleButton} onClick={() => setRaw(SAMPLE_RECIPE)} type="button">
              Use sample
            </button>
            <button
              className={styles.primaryButton}
              disabled={parsing || !raw.trim()}
              onClick={() => void parsePastedRecipe()}
              type="button"
            >
              {parsing ? <Loader2 aria-hidden="true" size={17} /> : <Sparkles aria-hidden="true" size={17} />}
              {parsing ? "Parsing…" : "Parse and review"}
            </button>
          </div>
        </section>

        <aside className={styles.helpPanel}>
          <span className={styles.stepLabel}>Step 2</span>
          <h2>Review every field</h2>
          <p>The review screen lets you correct:</p>
          <ul>
            <li>title, source, times, image and classifications;</li>
            <li>ingredient quantity, unit, food and notes;</li>
            <li>manual calories, protein, carbohydrates, fat and fiber per serving;</li>
            <li>method sections and individual steps.</li>
          </ul>
          <p>You can save without macros and add them later from Edit recipe.</p>
        </aside>
      </div>
    </main>
  );
}

export default function PasteRecipePage() {
  return (
    <AdminGate>
      <PasteRecipePageContent />
    </AdminGate>
  );
}
