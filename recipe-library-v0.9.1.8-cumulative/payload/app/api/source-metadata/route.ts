import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 2_000_000;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_REDIRECTS = 4;
const IMAGE_BUCKET = "recipe-images";

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

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Only http and https source URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("Source URLs cannot contain credentials.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local source URLs are not allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("Private network URLs are not allowed.");
  } else {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length || resolved.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("The source URL resolves to a private network.");
    }
  }

  return url;
}

async function fetchWithSafeRedirects(value: string, accept: string) {
  let current = await assertSafeUrl(value);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        accept,
        "user-agent":
          "Mozilla/5.0 (compatible; RecipeLibrary/0.9.1.8; +https://github.com/espemontero-ship-it/recipe-library)",
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
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const key = (getAttribute(tag, "property") || getAttribute(tag, "name")).toLowerCase();
    if (!expected.has(key)) continue;
    const content = getAttribute(tag, "content");
    if (content) return content;
  }

  return "";
}

function imageFromJsonLd(html: string): string {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  function visit(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return "";
    }
    if (typeof value !== "object") return "";

    const record = value as Record<string, unknown>;
    const type = record["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((item) => typeof item === "string" && item.toLowerCase() === "recipe")) {
      const image = record.image;
      if (typeof image === "string") return image;
      if (Array.isArray(image)) {
        const first = image.find((item) => typeof item === "string");
        if (typeof first === "string") return first;
        const object = image.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
        if (object && typeof object.url === "string") return object.url;
      }
      if (image && typeof image === "object" && typeof (image as Record<string, unknown>).url === "string") {
        return (image as Record<string, string>).url;
      }
    }

    for (const nested of Object.values(record)) {
      const found = visit(nested);
      if (found) return found;
    }
    return "";
  }

  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const found = visit(JSON.parse(body));
      if (found) return found;
    } catch {
      // Invalid JSON-LD is common; Open Graph remains the primary fallback.
    }
  }

  return "";
}

function extensionFor(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("avif")) return "avif";
  return "jpg";
}

async function storeImage(imageUrl: string, sourceUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const { response, finalUrl } = await fetchWithSafeRedirects(imageUrl, "image/avif,image/webp,image/*,*/*;q=0.5");
  if (!response.ok) throw new Error(`The source image returned HTTP ${response.status}.`);

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (!contentType.startsWith("image/")) throw new Error("The source image is not an image file.");

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error("The source image is larger than 8 MB.");

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("The source image is larger than 8 MB.");

  const hash = createHash("sha256").update(sourceUrl).update(finalUrl.toString()).digest("hex").slice(0, 32);
  const path = `sources/${hash}.${extensionFor(contentType)}`;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw error;

  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function POST(request: Request) {
  let sourceUrl = "";

  try {
    const body = (await request.json()) as { url?: unknown };
    sourceUrl = typeof body.url === "string" ? body.url.trim() : "";
    if (!sourceUrl) {
      return Response.json({ imageUrl: null, warning: "A source URL is required." }, { status: 400 });
    }

    const { response, finalUrl } = await fetchWithSafeRedirects(
      sourceUrl,
      "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    );
    if (!response.ok) throw new Error(`The source returned HTTP ${response.status}.`);

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("The source URL does not point to an HTML page.");
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error("The source page is too large to inspect.");

    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new Error("The source page is too large to inspect.");
    }

    const rawImage =
      metaContent(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ||
      imageFromJsonLd(html);
    const title = metaContent(html, ["og:title", "twitter:title"]);

    if (!rawImage) {
      return Response.json({
        sourceUrl: finalUrl.toString(),
        title: title || null,
        imageUrl: null,
        imageSource: null,
        warning: "No public source image was exposed by this page.",
      });
    }

    const externalImage = new URL(rawImage, finalUrl).toString();
    let storedImage: string | null = null;
    let warning: string | null = null;

    try {
      storedImage = await storeImage(externalImage, finalUrl.toString());
    } catch (error) {
      warning = error instanceof Error ? error.message : "The image could not be stored locally.";
    }

    return Response.json({
      sourceUrl: finalUrl.toString(),
      title: title || null,
      imageUrl: storedImage || externalImage,
      imageSource: storedImage ? "supabase" : "external",
      warning,
    });
  } catch (error) {
    return Response.json({
      sourceUrl: sourceUrl || null,
      imageUrl: null,
      imageSource: null,
      warning: error instanceof Error ? error.message : "The source metadata could not be read.",
    });
  }
}
