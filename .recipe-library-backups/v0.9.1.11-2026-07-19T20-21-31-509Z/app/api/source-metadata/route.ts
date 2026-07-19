import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { normalizeSourceUrl } from "@/lib/recipePasteParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 2_000_000;
const MAX_REDIRECTS = 4;

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");

  if (normalized.includes(":")) {
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
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

async function assertSafeUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public http and https URLs can be inspected.");
  }
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed.");

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local URLs cannot be inspected.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("Private-network URLs cannot be inspected.");
  } else {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length || resolved.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("The URL resolves to a private network.");
    }
  }

  return url;
}

async function fetchWithSafeRedirects(value: string) {
  let current = await assertSafeUrl(value);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "accept-language": "en-US,en;q=0.9,es;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The source returned an invalid redirect.");
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    return { response, finalUrl: current };
  }

  throw new Error("The source redirected too many times.");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function getAttribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(`${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function metaContent(html: string, keys: string[]) {
  const expected = new Set(keys.map((key) => key.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (getAttribute(tag, "property") || getAttribute(tag, "name")).toLowerCase();
    if (!expected.has(key)) continue;
    const content = getAttribute(tag, "content");
    if (content) return content;
  }
  return "";
}

function canonicalLink(html: string) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (getAttribute(tag, "rel").toLowerCase() !== "canonical") continue;
    const href = getAttribute(tag, "href");
    if (href) return href;
  }
  return "";
}

type RecipeMetadata = {
  title: string;
  author: string;
  siteName: string;
  imageUrl: string;
};

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string") return record.url;
    if (typeof record.contentUrl === "string") return record.contentUrl;
  }
  return "";
}

function authorName(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(authorName).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return typeof record.name === "string" ? record.name : "";
  }
  return "";
}

function recipeFromJsonLd(html: string): RecipeMetadata {
  const empty = { title: "", author: "", siteName: "", imageUrl: "" };
  const scripts =
    html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  function visit(value: unknown): RecipeMetadata | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (!value || typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    const rawType = record["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    if (types.some((type) => typeof type === "string" && type.toLowerCase() === "recipe")) {
      const publisher = record.publisher;
      return {
        title: typeof record.name === "string" ? record.name : "",
        author: authorName(record.author),
        siteName: authorName(publisher),
        imageUrl: firstString(record.image),
      };
    }

    if (Array.isArray(record["@graph"])) return visit(record["@graph"]);
    return null;
  }

  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const found = visit(JSON.parse(body));
      if (found) return found;
    } catch {
      // Broken JSON-LD should not prevent Open Graph fallback.
    }
  }

  return empty;
}

export async function POST(request: Request) {
  let requestedUrl = "";

  try {
    const body = (await request.json()) as { url?: unknown };
    requestedUrl = typeof body.url === "string" ? normalizeSourceUrl(body.url) : "";
    if (!requestedUrl) {
      return Response.json({ warning: "Add a source URL first." }, { status: 400 });
    }

    const { response, finalUrl } = await fetchWithSafeRedirects(requestedUrl);
    if (!response.ok) {
      throw new Error(`The source returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("The source URL is not a web page.");
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error("The source page is too large to inspect.");

    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new Error("The source page is too large to inspect.");
    }

    const jsonLd = recipeFromJsonLd(html);
    const canonical = canonicalLink(html);
    const sourceUrl = normalizeSourceUrl(
      canonical ? new URL(canonical, finalUrl).toString() : finalUrl.toString(),
    );
    const rawImage =
      jsonLd.imageUrl ||
      metaContent(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);

    return Response.json({
      sourceUrl,
      title: jsonLd.title || metaContent(html, ["og:title", "twitter:title"]) || null,
      siteName: jsonLd.siteName || metaContent(html, ["og:site_name", "application-name"]) || null,
      author: jsonLd.author || metaContent(html, ["author", "article:author"]) || null,
      imageUrl: rawImage ? new URL(rawImage, finalUrl).toString() : null,
      warning: rawImage ? null : "The page did not expose a public cover image.",
    });
  } catch (error) {
    return Response.json({
      sourceUrl: requestedUrl || null,
      title: null,
      siteName: null,
      author: null,
      imageUrl: null,
      warning: error instanceof Error ? error.message : "The source page could not be inspected.",
    });
  }
}
