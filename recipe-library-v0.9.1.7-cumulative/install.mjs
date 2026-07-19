import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const requestedRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const projectRoot = existsSync(path.join(requestedRoot, "app", "paste", "page.tsx"))
  ? requestedRoot
  : existsSync(path.join(path.dirname(PACKAGE_ROOT), "app", "paste", "page.tsx"))
    ? path.dirname(PACKAGE_ROOT)
    : null;

function fail(message) {
  console.error(`\nInstallation stopped: ${message}`);
  process.exit(1);
}

if (!projectRoot) {
  fail(
    "app/paste/page.tsx was not found. Extract this package into the Recipe Library project root, then run node install.mjs .",
  );
}

const pagePath = path.join(projectRoot, "app", "paste", "page.tsx");
const packageJsonPath = path.join(projectRoot, "package.json");
const backupSuffix = ".backup-v0.9.1.3-before-source-images";

function replaceRequired(source, pattern, replacement, label) {
  if (typeof pattern === "string") {
    if (!source.includes(pattern)) fail(`Could not locate ${label} in app/paste/page.tsx.`);
    return source.replace(pattern, replacement);
  }
  if (!pattern.test(source)) fail(`Could not locate ${label} in app/paste/page.tsx.`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function insertAfterFunction(source, functionName, addition) {
  const start = source.indexOf(`function ${functionName}`);
  if (start < 0) fail(`Could not locate function ${functionName}.`);
  const bodyStart = source.indexOf("{", start);
  if (bodyStart < 0) fail(`Could not read function ${functionName}.`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return `${source.slice(0, index + 1)}\n\n${addition}${source.slice(index + 1)}`;
      }
    }
  }
  fail(`Could not find the end of function ${functionName}.`);
}

function addTypeFields(source) {
  if (source.includes("sourceUrl: string;")) return source;
  return replaceRequired(
    source,
    /(publication:\s*string;)/,
    `$1\n  sourceUrl: string;\n  imageUrl: string;`,
    "the ParsedRecipe publication field",
  );
}

function addUrlHelpers(source) {
  if (source.includes("function extractSourceUrl(")) return source;
  const helper = `function normalizeSourceUrl(value: string) {
  return value
    .trim()
    .replace(/[\\s\\u00a0]+$/g, "")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/[)\\]}]+$/g, "");
}

function extractSourceUrl(value: string) {
  const markdown = value.match(/\\[[^\\]]*\\]\\((https?:\\/\\/[^\\s)]+)\\)/i);
  if (markdown) return normalizeSourceUrl(markdown[1]);

  const labelled = value.match(
    /(?:source|original|url|link|fuente|enlace)\\s*:?\\s*(https?:\\/\\/[^\\s<>"']+)/i,
  );
  if (labelled) return normalizeSourceUrl(labelled[1]);

  const plain = Array.from(value.matchAll(/https?:\\/\\/[^\\s<>"']+/gi));
  const last = plain.at(-1)?.[0];
  return last ? normalizeSourceUrl(last) : "";
}

function urlsFromClipboardHtml(html: string) {
  if (!html) return [];
  const container = document.createElement("div");
  container.innerHTML = html;
  return Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((anchor) => normalizeSourceUrl(anchor.href))
    .filter((url) => /^https?:\\/\\//i.test(url));
}

function appendMissingUrls(text: string, urls: string[]) {
  const unique = Array.from(new Set(urls)).filter((url) => !text.includes(url));
  if (!unique.length) return text;
  return (text.replace(/\\s+$/, "") + "\\n\\n" + unique.join("\\n")).trim();
}`;
  return insertAfterFunction(source, "cleanLine", helper);
}

function addParsedValues(source) {
  if (/sourceUrl:\s*extractSourceUrl\(raw\)/.test(source)) return source;
  return replaceRequired(
    source,
    /(publication:\s*attribution\?\.\[2\]\?\.trim\(\)\s*\|\|\s*"",)/,
    `$1\n    sourceUrl: extractSourceUrl(raw),\n    imageUrl: "",`,
    "the parseRecipe publication value",
  );
}

function addFetchingState(source) {
  if (source.includes("isFetchingSource")) return source;
  return replaceRequired(
    source,
    /(const \[isSaving, setIsSaving\] = useState\(false\);)/,
    `$1\n  const [isFetchingSource, setIsFetchingSource] = useState(false);`,
    "the saving state",
  );
}

function addReviewFields(source) {
  if (source.includes('{ label: "Source URL"')) return source;
  return replaceRequired(
    source,
    /(\{ label: "Publication", confidence: confidence\(parsed\.publication\) \},)/,
    `$1\n      { label: "Source URL", confidence: confidence(parsed.sourceUrl) },\n      { label: "Cover image", confidence: confidence(parsed.imageUrl) },`,
    "the Publication review field",
  );
}

function addMetadataHelpers(source) {
  if (source.includes("async function readSourceMetadata(")) return source;
  const marker = "  async function handleExtract()";
  const index = source.indexOf(marker);
  if (index < 0) fail("Could not locate handleExtract.");

  const helper = `  async function readSourceMetadata(sourceUrl: string) {
    if (!sourceUrl.trim()) return { sourceUrl: "", imageUrl: "" };

    setIsFetchingSource(true);
    try {
      const response = await fetch("/api/source-metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const metadata = (await response.json()) as {
        sourceUrl?: string | null;
        imageUrl?: string | null;
        warning?: string | null;
      };

      return {
        sourceUrl: metadata.sourceUrl?.trim() || sourceUrl,
        imageUrl: metadata.imageUrl?.trim() || "",
      };
    } catch {
      return { sourceUrl, imageUrl: "" };
    } finally {
      setIsFetchingSource(false);
    }
  }

  async function handleFindSourceImage() {
    if (!parsed?.sourceUrl.trim()) return;
    const metadata = await readSourceMetadata(parsed.sourceUrl);
    setParsed((current) =>
      current
        ? {
            ...current,
            sourceUrl: metadata.sourceUrl || current.sourceUrl,
            imageUrl: metadata.imageUrl || current.imageUrl,
          }
        : current,
    );
  }

`;
  return `${source.slice(0, index)}${helper}${source.slice(index)}`;
}

function upgradeHandleExtract(source) {
  if (source.includes("const nextRecipe = parseRecipe(raw);")) return source;
  const functionPattern = /  async function handleExtract\(\) \{[\s\S]*?\n  \}/;
  const match = source.match(functionPattern);
  if (!match) fail("Could not safely replace handleExtract.");

  const replacement = `  async function handleExtract() {
    if (!raw.trim()) return;
    setIsParsing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));

    const nextRecipe = parseRecipe(raw);
    setParsed(nextRecipe);
    setIsParsing(false);

    if (nextRecipe.sourceUrl) {
      const metadata = await readSourceMetadata(nextRecipe.sourceUrl);
      setParsed((current) =>
        current
          ? {
              ...current,
              sourceUrl:
                current.sourceUrl === nextRecipe.sourceUrl
                  ? metadata.sourceUrl || current.sourceUrl
                  : current.sourceUrl,
              imageUrl: current.imageUrl || metadata.imageUrl,
            }
          : current,
      );
    }
  }`;
  return source.replace(functionPattern, replacement);
}

function addSaveFields(source) {
  if (/originalUrl:\s*parsed\.sourceUrl/.test(source)) return source;
  const savePublication = /(publication:\s*parsed\.publication,)/;
  return replaceRequired(
    source,
    savePublication,
    `$1\n        originalUrl: parsed.sourceUrl,\n        image: parsed.imageUrl,`,
    "the publication field in the save payload",
  );
}

function addPasteCapture(source) {
  if (source.includes("urlsFromClipboardHtml(event.clipboardData")) return source;
  const onChangePattern = /onChange=\{\(event\) => setRaw\(event\.target\.value\)\}/;
  return replaceRequired(
    source,
    onChangePattern,
    `onChange={(event) => setRaw(event.target.value)}
                onPaste={(event) => {
                  const plainText = event.clipboardData.getData("text/plain");
                  const hiddenUrls = urlsFromClipboardHtml(
                    event.clipboardData.getData("text/html"),
                  );
                  if (!hiddenUrls.length) return;
                  event.preventDefault();
                  const start = event.currentTarget.selectionStart ?? raw.length;
                  const end = event.currentTarget.selectionEnd ?? start;
                  const nextText = raw.slice(0, start) + plainText + raw.slice(end);
                  setRaw(appendMissingUrls(nextText, hiddenUrls));
                }}`,
    "the paste textarea change handler",
  );
}

function addSourceFieldsUi(source) {
  if (source.includes('htmlFor="sourceUrl"')) return source;
  const servingsLabel = source.indexOf('<label htmlFor="servings">');
  if (servingsLabel < 0) fail("Could not locate the Servings field.");
  const start = source.lastIndexOf('<div className={styles.twoColumns}>', servingsLabel);
  if (start < 0) fail("Could not locate the Servings field row.");

  const ui = `          <div className={styles.field}>
            <div className={styles.fieldLabel}>
              <label htmlFor="sourceUrl">Source URL</label>
              <StatusBadge value={confidence(parsed.sourceUrl)} />
            </div>
            <input
              id="sourceUrl"
              inputMode="url"
              onChange={(event) => updateParsed("sourceUrl", event.target.value)}
              placeholder="https://..."
              value={parsed.sourceUrl}
            />
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>
              <label htmlFor="imageUrl">Cover image</label>
              <StatusBadge value={confidence(parsed.imageUrl)} />
            </div>
            <input
              id="imageUrl"
              inputMode="url"
              onChange={(event) => updateParsed("imageUrl", event.target.value)}
              placeholder="Extracted from the source when available"
              value={parsed.imageUrl}
            />
            <button
              className={styles.textButton}
              disabled={!parsed.sourceUrl.trim() || isFetchingSource}
              onClick={handleFindSourceImage}
              type="button"
            >
              {isFetchingSource ? "Reading source..." : "Find source image"}
            </button>
          </div>
`;
  return `${source.slice(0, start)}${ui}${source.slice(start)}`;
}

function bumpVisibleVersion(source) {
  return source.replace(/Importer(?:\s+MVP)?\s*[·•-]\s*v\d+(?:\.\d+){1,3}/g, "Importer · v0.9.1.7");
}

async function copyPayload(relativePath) {
  const source = path.join(PACKAGE_ROOT, "payload", relativePath);
  const destination = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`Written: ${relativePath}`);
}

async function patchPackageJson() {
  if (!existsSync(packageJsonPath)) return;
  const raw = await readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw);
  parsed.version = "0.9.1.7";
  parsed.scripts = {
    ...(parsed.scripts || {}),
    "backfill:sources": "node scripts/backfill-recipe-sources.mjs",
  };
  if (!existsSync(`${packageJsonPath}${backupSuffix}`)) {
    await copyFile(packageJsonPath, `${packageJsonPath}${backupSuffix}`);
  }
  await writeFile(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log("Updated: package.json");
}

let page = await readFile(pagePath, "utf8");
if (!existsSync(`${pagePath}${backupSuffix}`)) {
  await copyFile(pagePath, `${pagePath}${backupSuffix}`);
  console.log(`Backup: app/paste/page.tsx${backupSuffix}`);
}

if (
  page.includes("RECIPE_LIBRARY_SOURCE_IMAGES_V0915") ||
  page.includes("RECIPE_LIBRARY_SOURCE_IMAGES_V0916")
) {
  page = bumpVisibleVersion(page)
    .replace("RECIPE_LIBRARY_SOURCE_IMAGES_V0915", "RECIPE_LIBRARY_SOURCE_IMAGES_V0917")
    .replace("RECIPE_LIBRARY_SOURCE_IMAGES_V0916", "RECIPE_LIBRARY_SOURCE_IMAGES_V0917");
  await writeFile(pagePath, page, "utf8");
  console.log("Updated: app/paste/page.tsx to v0.9.1.7");
} else if (!page.includes("RECIPE_LIBRARY_SOURCE_IMAGES_V0917")) {
  page = addTypeFields(page);
  page = addUrlHelpers(page);
  page = addParsedValues(page);
  page = addFetchingState(page);
  page = addReviewFields(page);
  page = addMetadataHelpers(page);
  page = upgradeHandleExtract(page);
  page = addSaveFields(page);
  page = addPasteCapture(page);
  page = addSourceFieldsUi(page);
  page = bumpVisibleVersion(page);
  page = `${page.trimEnd()}\n\n// RECIPE_LIBRARY_SOURCE_IMAGES_V0917\n`;
  await writeFile(pagePath, page, "utf8");
  console.log("Patched: app/paste/page.tsx");
} else {
  console.log("Already patched: app/paste/page.tsx");
}

await copyPayload(path.join("app", "api", "source-metadata", "route.ts"));
await copyPayload(path.join("scripts", "backfill-recipe-sources.mjs"));
await copyPayload(path.join("supabase", "migrations", "20260719_source_urls_and_images_auto.sql"));
await patchPackageJson();

console.log(`\nRecipe Library v0.9.1.7 cumulative patch installed in:\n${projectRoot}`);
console.log("Next: run the Supabase migration, then npm run build.");
