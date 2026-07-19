import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";

const TABLE = process.env.RECIPE_TABLE || "recipes";
const BUCKET = "recipe-images";
const PAGE_SIZE = 100;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_HTML_BYTES = 2_000_000;
const DRY_RUN = process.argv.includes("--dry-run");
const URLS_ONLY = process.argv.includes("--urls-only");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});


function isPrivateAddress(address) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized.includes(":")) {
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    );
  }
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertSafeUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("unsafe URL");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".localhost")) {
    throw new Error("local URL blocked");
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("private URL blocked");
  } else {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("private URL blocked");
    }
  }
  return url.toString();
}

function cleanUrl(value) {
  return value.replace(/[\s\u00a0]+$/g, "").replace(/[.,;:!?]+$/g, "").replace(/[)\]}]+$/g, "");
}

function extractUrl(text) {
  if (!text) return "";
  const markdown = text.match(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
  if (markdown) return cleanUrl(markdown[1]);
  const plain = text.match(/https?:\/\/[^\s<>"']+/i);
  return plain ? cleanUrl(plain[0]) : "";
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function metadataImage(html, baseUrl) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const wanted = ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"];
  for (const key of wanted) {
    for (const tag of tags) {
      const tagKey = (attr(tag, "property") || attr(tag, "name")).toLowerCase();
      if (tagKey !== key) continue;
      const content = attr(tag, "content");
      if (content) return new URL(content, baseUrl).toString();
    }
  }
  return "";
}

function extensionFor(contentType) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("avif")) return "avif";
  return "jpg";
}

async function fetchMetadataImage(sourceUrl) {
  const safeSourceUrl = await assertSafeUrl(sourceUrl);
  const response = await fetch(safeSourceUrl, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      "user-agent": "Mozilla/5.0 (compatible; RecipeLibraryBackfill/0.9.1.6)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`source HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_HTML_BYTES) throw new Error("source HTML exceeds 2 MB");
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) throw new Error("source HTML exceeds 2 MB");
  return metadataImage(html, response.url || safeSourceUrl);
}

async function storeImage(imageUrl, sourceUrl, slug) {
  const safeImageUrl = await assertSafeUrl(imageUrl);
  const response = await fetch(safeImageUrl, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (compatible; RecipeLibraryBackfill/0.9.1.6)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`image HTTP ${response.status}`);

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (!contentType.startsWith("image/")) throw new Error("metadata URL is not an image");

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image exceeds 8 MB");

  const hash = createHash("sha256").update(sourceUrl).update(imageUrl).digest("hex").slice(0, 24);
  const safeSlug = (slug || "recipe").replace(/[^a-z0-9-]+/gi, "-").slice(0, 60);
  const path = `sources/${safeSlug}-${hash}.${extensionFor(contentType)}`;

  if (!DRY_RUN) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw error;
  }

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function ensureBucket() {
  if (DRY_RUN || URLS_ONLY) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

async function updateRecipe(id, values) {
  if (DRY_RUN) return;
  const { error } = await supabase.from(TABLE).update(values).eq("id", id);
  if (error) throw error;
}

await ensureBucket();

const totals = {
  read: 0,
  urlsRecovered: 0,
  imagesStored: 0,
  imageFailures: 0,
  unchanged: 0,
};

for (let from = 0; ; from += PAGE_SIZE) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,slug,title,source_url,raw_source_text,cover_image")
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw error;
  if (!data?.length) break;

  for (const row of data) {
    totals.read += 1;
    let sourceUrl = row.source_url?.trim() || "";
    const changes = {};

    if (!sourceUrl) {
      sourceUrl = extractUrl(row.raw_source_text || "");
      if (sourceUrl) {
        changes.source_url = sourceUrl;
        changes.source_url_confidence = "exact_raw_text";
        totals.urlsRecovered += 1;
      }
    }

    if (!URLS_ONLY && sourceUrl && !row.cover_image) {
      try {
        const externalImage = await fetchMetadataImage(sourceUrl);
        if (!externalImage) throw new Error("no public image metadata");
        changes.cover_image = await storeImage(externalImage, sourceUrl, row.slug || row.title);
        changes.image_source = "source_metadata";
        changes.image_needs_review = false;
        totals.imagesStored += 1;
      } catch (error) {
        changes.image_source = "source_metadata_failed";
        changes.image_needs_review = true;
        totals.imageFailures += 1;
        console.warn(`Image skipped: ${row.title}: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (Object.keys(changes).length) {
      await updateRecipe(row.id, changes);
      console.log(`${DRY_RUN ? "Would update" : "Updated"}: ${row.title}`);
    } else {
      totals.unchanged += 1;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (data.length < PAGE_SIZE) break;
}

console.log("\nRecipe source backfill complete");
console.table(totals);
if (DRY_RUN) console.log("Dry run only: no database or storage changes were made.");
