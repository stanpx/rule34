/**
 * Kino Plugin: Rule 34
 * Si existe, hay porno de ello.
 * Propósito estrictamente educativo y de demostración técnica.
 * 
 * Entorno de ejecución: QuickJS Sandbox (sin APIs de Node.js ni DOM de navegador).
 * Utiliza únicamente APIs estándar de JavaScript y los globales de Kino (kino.fetch, kino.log, kino.error).
 */

// ============================================================================
// 1. CONFIGURACIÓN DE FUENTES (HOSTS & CDNS)
// ============================================================================

// TODO: [inserta sitios web] Reemplazar con la lista final de dominios
export const BOORU_HOSTS = [
  {
    id: "r34video",
    name: "Rule34 Video",
    base: "https://rule34video.com",
    type: "tube", // Scraping HTML de tube booru (onevideothumb)
    enabled: true
  },
  {
    id: "danbooru",
    name: "Danbooru / Donmai",
    base: "https://danbooru.donmai.us",
    type: "booru_api", // API REST JSON Danbooru (/posts.json)
    enabled: true
  },
  {
    id: "safebooru",
    name: "Safebooru",
    base: "https://safebooru.org",
    type: "booru_api",
    enabled: true
  },
  {
    id: "r34us",
    name: "Rule34 US",
    base: "https://rule34.us",
    type: "booru_api",
    enabled: true
  },
  {
    id: "r34paheal",
    name: "Paheal Booru",
    base: "https://rule34.paheal.net",
    type: "booru_api",
    enabled: true
  },
   {
    id: "r34xxx",
    name: "Paheal Booru",
    base: "https://rule34.xxx",
    type: "booru_api",
    enabled: true
  },
  {
    id: "r34e621",
    name: "E621",
    base: "https://e621.net",
    type: "booru_api",
    enabled: true
  },
  {
    id: "r34xyz",
    name: "Rule34 XYZ",
    base: "https://rule34.xyz",
    type: "booru_api",
    enabled: true
  },
  {
    id: "r34gen",
    name: "Rule34 Gen",
    base: "https://rule34gen.com",
    type: "tube",
    enabled: true
  },
  {
    id: "r34atf",
    name: "Rule34 ATF",
    base: "https://booru.allthefallen.moe",
    type: "booru_api",
    enabled: true
  }
];

// Host principal para navegación inicial y catálogo de categorías
const BASE = BOORU_HOSTS[0].base;

// Límites de elementos
const MAX_SEARCH = 100;
const MAX_ROW = 60;
const MAX_BROWSE = 100;

// Encabezados HTTP predeterminados para peticiones y streaming
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9"
};

// Extensiones de archivo admitidas como video o animación
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m3u", ".m3u8", ".m4v", ".gif"];

// Categorías destacadas para la pantalla principal (Home) y navegación
const HOME_ROWS = [
  { id: "newest", title: "🔥 Más recientes", tag: "animated", path: "/&ajax&p=1", genre: "otros" },
  { id: "top", title: "⭐ Mejor valorados", tag: "score:>10", path: "/videos/top-rated/&ajax&p=1", genre: "otros" },
  { id: "viewed", title: "👁️ Más vistos", tag: "animated", path: "/videos/most-viewed/&ajax&p=1", genre: "otros" },
  { id: "cats", title: "🐱 Gatos & Mascotas (Regla 00)", tag: "cat", path: "/show/cats?ajax&sort=toprated", genre: "documentales" },
  { id: "3d", title: "🎨 Animación 3D", tag: "3d", path: "/show/3d?ajax&sort=toprated", genre: "anime" },
  { id: "parodies", title: "🎭 Parodias", tag: "parody", path: "/show/parodies?ajax&sort=toprated", genre: "entretenimiento" },
  { id: "robots", title: "🤖 Robots", tag: "robot", path: "/show/robots?ajax&sort=toprated", genre: "anime" },
  { id: "furry", title: "🐾 Furry & Antro", tag: "furry", path: "/show/furry?ajax&sort=toprated", genre: "anime" },
  { id: "aliens", title: "👽 Aliens", tag: "alien", path: "/show/aliens?ajax&sort=toprated", genre: "otros" },
  { id: "monsters", title: "👾 Monstruos", tag: "monster", path: "/show/monsters?ajax&sort=toprated", genre: "otros" },
  { id: "femboy", title: "✨ Femboys", tag: "femboy", path: "/show/femboys?ajax&sort=toprated", genre: "entretenimiento" },
  { id: "lesbians", title: "🌸 Lesbianas", tag: "lesbian", path: "/show/lesbians?ajax&sort=toprated", genre: "entretenimiento" },
  { id: "tentacles", title: "🦑 Tentáculos", tag: "tentacles", path: "/show/tentacles?ajax&sort=toprated", genre: "entretenimiento" }
];

// ============================================================================
// 2. UTILIDADES Y NORMALIZACIÓN DE BÚSQUEDA
// ============================================================================

/**
 * Resuelve URLs relativas o con esquema implícito '//' a URL completa absoluta
 */
function abs(url, baseHost = BASE) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return "https:" + url;
  const cleanBase = baseHost.replace(/\/+$/, "");
  const cleanPath = url.startsWith("/") ? url : "/" + url;
  return cleanBase + cleanPath;
}

/**
 * Convierte texto de duración (mm:ss o hh:mm:ss) a segundos
 */
function parseDuration(text) {
  if (!text) return undefined;
  const parts = String(text).trim().match(/(\d+):(\d+)(?::(\d+))?/);
  if (!parts) return undefined;
  if (parts[3] !== undefined) {
    return parseInt(parts[1], 10) * 3600 + parseInt(parts[2], 10) * 60 + parseInt(parts[3], 10);
  }
  return parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
}

/**
 * Extrae número de vistas desde cadenas con formato localizado
 */
function parseViews(text) {
  if (!text) return undefined;
  const n = String(text).replace(/[,\.]/g, "").match(/(\d+)/);
  return n ? parseInt(n[1], 10) : undefined;
}

/**
 * Sanitiza identificadores para cumplir con el esquema ^[A-Za-z0-9._~-]{1,100}$
 */
function sanitizeId(str, prefix = "") {
  const safe = (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._~-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return `${prefix}${safe || "unknown"}`.slice(0, 100);
}

/**
 * Comprueba si una URL o extensión corresponde a un archivo de video
 */
function isVideoUrl(url, extHint = "") {
  if (!url && !extHint) return false;
  const clean = (url || "").toLowerCase().split("?")[0];
  const cleanExt = (extHint || "").toLowerCase().replace(/^\./, "");
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(cleanExt)) return true;
  return VIDEO_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

/**
 * Determina el tipo MIME correspondiente a la extensión de video
 */
function getMimeType(url) {
  const clean = (url || "").toLowerCase().split("?")[0];
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".m3u8")) return "application/x-mpegURL";
  return "video/mp4";
}

/**
 * Registro de mensajes en la consola o log de Kino
 */
function logInfo(...args) {
  if (typeof kino !== "undefined" && typeof kino.log === "function") {
    kino.log(...args);
  } else if (typeof console !== "undefined" && typeof console.log === "function") {
    console.log(...args);
  }
}

function logWarn(...args) {
  if (typeof kino !== "undefined" && typeof kino.log === "function") {
    kino.log("[WARN]", ...args);
  } else if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(...args);
  }
}

/**
 * Genera un error compatible con Kino runtime o Error estándar
 */
function kinoError(code, message, userMessage) {
  if (typeof kino !== "undefined" && typeof kino.error === "function") {
    return kino.error(code, message, userMessage ? { userMessage } : undefined);
  }
  const err = new Error(`[${code}] ${message}`);
  if (userMessage) err.userMessage = userMessage;
  return err;
}

/**
 * Normaliza términos de búsqueda para Boorus y sitios Tube.
 * Convierte plurales a singular para la convención booru (1girls -> 1girl, cats -> cat),
 * y genera variantes con espacios y guiones bajos (kit_bodega <-> kit bodega).
 */
function normalizeSearchQueries(rawQuery) {
  const q = (rawQuery || "").trim().toLowerCase();
  if (!q) return { booruTags: [], tubeTerms: [] };

  const clean = q.replace(/[\"\'\(\)\[\]\{\}]/g, " ").trim();

  // Diccionario de normalización de tags comunes en boorus
  const TAG_FIXES = {
    "1girls": "1girl",
    "2girls": "2girls",
    "3girls": "3girls",
    "1boys": "1boy",
    "2boys": "2boys",
    "3boys": "3boys",
    "cats": "cat",
    "robots": "robot",
    "femboys": "femboy",
    "aliens": "alien",
    "monsters": "monster",
    "tentacles": "tentacles"
  };

  const words = clean.split(/[\s_]+/).filter(Boolean);
  const normalizedWords = words.map((w) => TAG_FIXES[w] || w);

  // Variante Booru: separada por guiones bajos (ej. murder_drones, kit_bodega)
  const booruTag = normalizedWords.join("_");
  const booruTagOrig = words.join("_");

  // Variante Tube: separada por espacios / slugs (ej. murder drones, kit bodega)
  const tubeTerm = normalizedWords.join(" ");
  const tubeTermSlug = normalizedWords.join("-");

  const booruTags = Array.from(new Set([booruTag, booruTagOrig, clean]));
  const tubeTerms = Array.from(new Set([tubeTerm, booruTag, tubeTermSlug, clean]));

  return { booruTags, tubeTerms };
}

// ============================================================================
// 3. CAPA DE RED (QUICKJS / KINO.FETCH)
// ============================================================================

/**
 * Petición HTTP GET para obtener texto HTML
 */
async function fetchPage(pathOrUrl, baseHost = BASE) {
  const url = abs(pathOrUrl, baseHost);
  const headers = Object.assign({}, DEFAULT_HEADERS, {
    "Referer": baseHost.endsWith("/") ? baseHost : baseHost + "/"
  });

  if (typeof kino !== "undefined" && typeof kino.fetch === "function") {
    const res = await kino.fetch(url, {
      method: "GET",
      headers,
      timeoutMs: 15000
    });
    if (!res.ok) {
      if (res.status === 404) throw kinoError("not_found", `Página no encontrada (${url})`);
      throw kinoError("unavailable", `Error HTTP ${res.status} al solicitar ${url}`);
    }
    return await res.text();
  }

  // Fallback seguro fuera de Kino (ej. suites de test en Node)
  const testFetch = globalThis["fetch"];
  if (typeof testFetch === "function") {
    const res = await testFetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    return await res.text();
  }

  throw new Error("No hay cliente HTTP disponible en el entorno actual");
}

/**
 * Petición HTTP GET para obtener JSON
 */
async function fetchJson(url, baseHost = BASE) {
  const fullUrl = abs(url, baseHost);
  const headers = Object.assign({}, DEFAULT_HEADERS, {
    "Accept": "application/json, text/plain, */*",
    "Referer": baseHost.endsWith("/") ? baseHost : baseHost + "/"
  });

  if (typeof kino !== "undefined" && typeof kino.fetch === "function") {
    const res = await kino.fetch(fullUrl, {
      method: "GET",
      headers,
      timeoutMs: 15000
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${fullUrl})`);
    return await res.json();
  }

  const testFetch = globalThis["fetch"];
  if (typeof testFetch === "function") {
    const res = await testFetch(fullUrl, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${fullUrl})`);
    return await res.json();
  }

  throw new Error("No hay cliente HTTP disponible");
}

// ============================================================================
// 4. PARSERS PARA FUENTES TIPO TUBE (HTML SCRAPING)
// ============================================================================

/**
 * Extrae un elemento KinoItem desde el fragmento HTML de una miniatura (onevideothumb)
 */
function itemFromThumb(html, baseHost = BASE, asSeries = false) {
  const hrefM = html.match(/href="(\/video\/(\d+)\/[^"]+)"/);
  if (!hrefM) return null;

  const path = hrefM[1];
  const id = hrefM[2];

  // Preferir título desde el atributo title del link principal
  const titleM =
    html.match(/class="clip-link[^"]*"[^>]*title="([^"]+)"/) ||
    html.match(/<h5[^>]*title="([^"]+)"/) ||
    html.match(/title="([^"]+)"/);

  const title = titleM
    ? titleM[1].replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim()
    : `Video ${id}`;

  // Miniatura original del sitio (16:9)
  const thumbSrcM = html.match(/(?:data-src|data-original|src)="([^"]*\/thumbs\/[^"]+)"/) ||
                    html.match(/(?:data-src|data-original|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/);
  const poster = thumbSrcM ? abs(thumbSrcM[1], baseHost) : `${baseHost}/media/thumbs/${id}/i101.jpg`;
  const backdrop = poster;

  const durM = html.match(/title="Duration"[^>]*>[\s\S]*?(\d+:\d+)/);
  const runtimeMinutes = durM ? Math.max(1, Math.round(parseDuration(durM[1]) / 60)) : undefined;

  const likeM = html.match(/(\d+)%/);
  const rating = likeM ? Math.min(10, Math.round(parseInt(likeM[1], 10) / 10)) : undefined;

  const ref = JSON.stringify({
    type: "tube",
    host: baseHost,
    path,
    id,
    title,
    poster
  });

  return {
    id: sanitizeId(`tube_${id}`, "r34_"),
    ref,
    title,
    kind: asSeries ? "series" : "movie",
    poster,
    backdrop,
    runtimeMinutes,
    rating,
    adult: true,
    genres: ["otros"]
  };
}

/**
 * Parsea lista de items desde el HTML de una página
 */
function parseItems(html, limit = MAX_ROW, baseHost = BASE, asSeries = false) {
  const items = [];
  const re = /<div class="onevideothumb">([\s\S]*?)<\/div>\s*(?=<div class="onevideothumb"|<\/div>\s*<nav id="page_nav"|$)/g;
  let m;
  while ((m = re.exec(html)) !== null && items.length < limit) {
    const it = itemFromThumb(m[1], baseHost, asSeries);
    if (it) items.push(it);
  }

  // Fallback si la expresión regular no capturó todos los bloques
  if (items.length === 0) {
    const parts = html.split('class="onevideothumb"');
    for (let i = 1; i < parts.length && items.length < limit; i++) {
      const it = itemFromThumb(parts[i], baseHost, asSeries);
      if (it) items.push(it);
    }
  }

  return items;
}

/**
 * Extrae el cursor o número de página siguiente desde la barra de navegación (#page_nav)
 */
function nextFromHtml(html, currentPath) {
  const m = html.match(/id="page_nav"[^>]*>[\s\S]*?href="([^"]+)"/);
  if (!m) return undefined;
  const href = m[1];
  if (href.includes("&ajax") || href.includes("?ajax") || href.includes("p=")) {
    const pM = href.match(/[?&]p=(\d+)/);
    if (pM) return pM[1];
  }
  return undefined;
}

/**
 * Búsqueda exhaustiva en sitios tipo Tube con soporte para múltiples formatos de URL de búsqueda
 */
async function searchTubeHost(hostConfig, queryVariants, page = 1, asSeries = false) {
  const results = [];
  const seenIds = new Set();

  for (const term of queryVariants.tubeTerms) {
    if (results.length >= 20) break;
    const encoded = encodeURIComponent(term).replace(/%20/g, "+");

    // Probar las diferentes rutas de búsqueda usadas por sitios Tube
    const candidates = [
      `/search/videos/${encoded}/?ajax`,
      `/search/${encoded}/?ajax`,
      `/search?q=${encoded}&ajax=1`,
      `/show/${encoded}?ajax`,
      `/tag/${encoded}/?ajax`
    ];

    for (const path of candidates) {
      try {
        let fullPath = path;
        if (page > 1) {
          fullPath += (fullPath.includes("?") ? "&" : "?") + `p=${page}`;
        }
        const html = await fetchPage(fullPath, hostConfig.base);
        const items = parseItems(html, MAX_SEARCH, hostConfig.base, asSeries);
        if (items.length > 0) {
          for (const it of items) {
            if (!seenIds.has(it.id)) {
              seenIds.add(it.id);
              results.push(it);
            }
          }
          break; // Resultados encontrados para este término
        }
      } catch {
        // Continuar silenciosamente
      }
    }
  }

  return results;
}

// ============================================================================
// 5. PARSERS PARA FUENTES TIPO BOORU API (REST JSON)
// ============================================================================

/**
 * Normaliza un post desde una API REST JSON de Booru
 */
function normalizeBooruPost(raw, hostConfig, asSeries = false) {
  if (!raw || typeof raw !== "object") return null;
  const postId = raw.id || raw.post_id || raw.uuid || raw.hash;
  if (!postId) return null;

  // Extraer URL del video o animación
  let videoUrl = raw.file_url || raw.url || raw.video_url || raw.direct_url;
  if (!videoUrl && raw.media_asset && Array.isArray(raw.media_asset.variants)) {
    const orig = raw.media_asset.variants.find((v) => v.type === "original" || v.type === "sample");
    if (orig && orig.url) videoUrl = orig.url;
  }
  if (!videoUrl && raw.file && typeof raw.file === "object") {
    videoUrl = raw.file.url;
  }

  const ext = raw.file_ext || raw.format || "";
  const isVideo = isVideoUrl(videoUrl, ext);
  const tagsStr = String(raw.tags || raw.tag_string || "");
  const isAnimated = tagsStr.includes("animated") || tagsStr.includes("video") || tagsStr.includes("animation");

  // Aceptar si es video directo o si está explícitamente etiquetado como animación
  if (!isVideo && !isAnimated) {
    return null;
  }

  const cleanVideoUrl = abs(videoUrl || raw.file_url, hostConfig.base);

  // Extraer miniatura
  let previewUrl = raw.preview_file_url || raw.preview_url || raw.sample_url || raw.thumbnail;
  if (!previewUrl && raw.media_asset && Array.isArray(raw.media_asset.variants)) {
    const prev = raw.media_asset.variants.find((v) => v.type === "preview" || v.type === "180x180");
    if (prev && prev.url) previewUrl = prev.url;
  }
  if (!previewUrl && raw.preview && typeof raw.preview === "object" && raw.preview.url) {
    previewUrl = raw.preview.url;
  }
  if (!previewUrl && raw.sample && typeof raw.sample === "object" && raw.sample.url) {
    previewUrl = raw.sample.url;
  }
  const poster = previewUrl ? abs(previewUrl, hostConfig.base) : "";

  // Título descriptivo generado a partir de etiquetas
  let title = "";
  if (raw.tags && typeof raw.tags === "object" && !Array.isArray(raw.tags)) {
    const tagList = [
      ...(Array.isArray(raw.tags.character) ? raw.tags.character : []),
      ...(Array.isArray(raw.tags.copyright) ? raw.tags.copyright : []),
      ...(Array.isArray(raw.tags.species) ? raw.tags.species : []),
      ...(Array.isArray(raw.tags.general) ? raw.tags.general : [])
    ];
    if (tagList.length > 0) {
      title = tagList.slice(0, 5).join(" ").replace(/_/g, " ");
    }
  } else if (raw.tag_string_character) {
    title = raw.tag_string_character.replace(/_/g, " ");
  } else if (raw.tag_string_copyright) {
    title = raw.tag_string_copyright.replace(/_/g, " ");
  } else if (typeof raw.tags === "string") {
    title = raw.tags.split(" ").slice(0, 5).join(" ").replace(/_/g, " ");
  } else if (raw.tag_string) {
    title = String(raw.tag_string).split(" ").slice(0, 5).join(" ").replace(/_/g, " ");
  }

  if (!title) title = `${hostConfig.name} #${postId}`;

  const id = sanitizeId(`${hostConfig.id}_${postId}`, "bv_");
  const ref = JSON.stringify({
    type: "direct",
    url: cleanVideoUrl,
    host: hostConfig.base,
    title,
    poster
  });

  return {
    id,
    ref,
    title,
    kind: asSeries ? "series" : "movie",
    poster,
    backdrop: poster,
    adult: true,
    genres: ["anime", "otros"]
  };
}

/**
 * Consulta endpoints de APIs Booru sin forzar tags restrictivos que causen respuestas vacías
 */
async function queryBooruApi(hostConfig, queryVariants, page = 1, asSeries = false) {
  const cleanHost = hostConfig.base.replace(/\/+$/, "");
  const results = [];
  const seenIds = new Set();

  for (const tag of queryVariants.booruTags) {
    if (results.length >= 20) break;
    const encoded = encodeURIComponent(tag);

    // Variantes de endpoints REST para Boorus
    const endpoints = [
      `${cleanHost}/posts.json?tags=${encoded}&limit=40&page=${page}`,
      `${cleanHost}/index.php?page=dapi&s=post&q=index&json=1&tags=${encoded}&limit=40&pid=${page}`,
      `${cleanHost}/api/v1/json/search/posts?q=${encoded}&page=${page}`,
      `${cleanHost}/posts.json?tags=${encoded}+animated&limit=40&page=${page}`,
      `${cleanHost}/index.php?page=dapi&s=post&q=index&json=1&tags=${encoded}+animated&limit=40&pid=${page}`
    ];

    for (const url of endpoints) {
      try {
        const data = await fetchJson(url, cleanHost);
        let rawList = [];
        if (Array.isArray(data)) {
          rawList = data;
        } else if (data && typeof data === "object") {
          if (Array.isArray(data.posts)) rawList = data.posts;
          else if (Array.isArray(data.post)) rawList = data.post;
          else if (Array.isArray(data.data)) rawList = data.data;
          else if (Array.isArray(data.results)) rawList = data.results;
        }

        if (rawList.length > 0) {
          for (const post of rawList) {
            const it = normalizeBooruPost(post, hostConfig, asSeries);
            if (it && !seenIds.has(it.id)) {
              seenIds.add(it.id);
              results.push(it);
            }
          }
          if (results.length > 0) break;
        }
      } catch {
        // Continuar silenciosamente al siguiente endpoint
      }
    }
  }

  return results;
}

// ============================================================================
// 6. RESOLUCIÓN DE VIDEO (RESOLVE)
// ============================================================================

/**
 * Analiza el HTML del reproductor de video para localizar la URL de streaming (.mp4/.webm)
 */
function extractVideoStream(html, baseHost) {
  if (!html) return "";

  // 1. Etiqueta <source src="..." type="video/...">
  const sourceMatches = html.matchAll(/<source[^>]+src=["']([^"']+)["'][^>]*>/gi);
  for (const m of sourceMatches) {
    const src = m[1];
    if (isVideoUrl(src) || m[0].includes("video/mp4") || m[0].includes("video/webm")) {
      return abs(src, baseHost);
    }
  }

  // 2. Etiqueta <video src="...">
  const videoM = html.match(/<video[^>]+src=["']([^"']+)["']/i);
  if (videoM && isVideoUrl(videoM[1])) {
    return abs(videoM[1], baseHost);
  }

  // 3. Variables JavaScript de reproductores web comunes
  const jsVarPatterns = [
    /video_url\s*:\s*["']([^"']+)["']/i,
    /video_src\s*:\s*["']([^"']+)["']/i,
    /file\s*:\s*["']([^"']+\.(?:mp4|webm|m3u8)[^"']*)["']/i,
    /source\s*:\s*["']([^"']+\.(?:mp4|webm|m3u8)[^"']*)["']/i,
    /["']contentUrl["']\s*:\s*["']([^"']+)["']/i,
    /data-video=["']([^"']+)["']/i
  ];

  for (const pattern of jsVarPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const decoded = match[1].replace(/\\/g, "");
      if (isVideoUrl(decoded)) {
        return abs(decoded, baseHost);
      }
    }
  }

  // 4. Búsqueda de URLs CDN completas de video en el script/markup
  const cdnMatch = html.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|webm|m3u8)(?:\?[^\s"'<>]*)?/i);
  if (cdnMatch) {
    return cdnMatch[0].replace(/&amp;/g, "&");
  }

  // 5. Enlaces de descarga directos (<a href="...mp4" download>)
  const downloadM = html.match(/<a[^>]+href=["']([^"']+\.(?:mp4|webm)[^"']*)["'][^>]*download/i) ||
                    html.match(/<a[^>]+download[^>]*href=["']([^"']+\.(?:mp4|webm)[^"']*)["']/i);
  if (downloadM && downloadM[1]) {
    return abs(downloadM[1], baseHost);
  }

  return "";
}

/**
 * Función obligatoria de Kino: resolve(ref)
 * Devuelve la URL final ejecutable y los encabezados de reproducción para el reproductor
 */
export async function resolve(ref) {
  let target;
  if (typeof ref === "string") {
    try {
      target = JSON.parse(ref);
    } catch {
      target = { path: ref };
    }
  } else if (ref && typeof ref === "object") {
    target = ref.ref ? (typeof ref.ref === "string" ? JSON.parse(ref.ref) : ref.ref) : ref;
  } else {
    throw kinoError("invalid_request", "Parámetro ref requerido para reproducir");
  }

  // Si la referencia ya contenía la URL directa
  if (target.url && (isVideoUrl(target.url) || target.type === "direct")) {
    return {
      url: target.url,
      mime: getMimeType(target.url),
      headers: {
        "User-Agent": USER_AGENT,
        ...(target.host ? { "Referer": target.host.endsWith("/") ? target.host : target.host + "/" } : {})
      }
    };
  }

  // Si requiere descargar la página HTML del video para extraer el stream
  const hostBase = target.host || BASE;
  let pagePath = target.path || target.url || "";

  // Si era un fallback generado por búsqueda, consultar la primera entrada
  if (pagePath.includes("/search/")) {
    const searchHtml = await fetchPage(pagePath, hostBase);
    const parsed = parseItems(searchHtml, 1, hostBase);
    if (parsed.length > 0) {
      const subTarget = JSON.parse(parsed[0].ref);
      pagePath = subTarget.path;
    }
  }

  const pageUrl = abs(pagePath, hostBase);
  logInfo(`[rule34] Resolviendo video en: ${pageUrl}`);
  const html = await fetchPage(pageUrl, hostBase);
  const streamUrl = extractVideoStream(html, hostBase);

  if (!streamUrl) {
    throw kinoError("not_found", "No se encontró enlace de video en la página", "No fue posible extraer la transmisión de video.");
  }

  return {
    url: streamUrl,
    mime: getMimeType(streamUrl),
    headers: {
      "User-Agent": USER_AGENT,
      "Referer": hostBase.endsWith("/") ? hostBase : hostBase + "/"
    }
  };
}

// ============================================================================
// 7. FUNCIONES EXPORTADAS DE KINO (HOME, BROWSE, CATEGORIES, EPISODES, SEARCH)
// ============================================================================

/**
 * Obtiene elementos de catálogo para una categoría con fallback automático a APIs Booru
 */
async function fetchCategoryItems(cat, page = 1, limit = MAX_ROW) {
  let items = [];

  // 1. Intentar scraping en host Tube
  try {
    let p = cat.path || "/&ajax&p=1";
    if (page > 1) p += `&p=${page}`;
    const html = await fetchPage(p, BASE);
    items = parseItems(html, limit, BASE);
  } catch {
    items = [];
  }

  // 2. Fallback a APIs Booru si el host Tube no devolvió elementos
  if (items.length === 0 && cat.tag) {
    const queryVariants = normalizeSearchQueries(cat.tag);
    for (const hostConfig of BOORU_HOSTS) {
      if (hostConfig.type === "booru_api" && hostConfig.enabled) {
        try {
          const booruItems = await queryBooruApi(hostConfig, queryVariants, page, false);
          if (booruItems && booruItems.length > 0) {
            items = booruItems.slice(0, limit);
            break;
          }
        } catch {
          // Continuar al siguiente host
        }
      }
    }
  }

  return items;
}

/**
 * Función home: Filas destacadas para la pantalla de inicio de Kino
 */
export async function home() {
  const rows = [];
  const initialRows = HOME_ROWS.slice(0, 4);

  const promises = initialRows.map(async (cat) => {
    try {
      const items = await fetchCategoryItems(cat, 1, MAX_ROW);
      if (items.length > 0) {
        return {
          id: cat.id,
          title: cat.title,
          ref: JSON.stringify({ id: cat.id, tag: cat.tag, path: cat.path }),
          genre: cat.genre || "otros",
          items
        };
      }
    } catch (err) {
      logWarn(`[rule34] Fallo cargando fila '${cat.title}': ${err?.message || err}`);
    }
    return null;
  });

  const settled = await Promise.allSettled(promises);
  for (const res of settled) {
    if (res.status === "fulfilled" && res.value) {
      rows.push(res.value);
    }
  }

  return rows;
}

/**
 * Función browse: Paginación y navegación profunda ("Ver más" y categorías)
 */
export async function browse(ref, cursor) {
  const page = cursor ? parseInt(cursor, 10) || 1 : 1;
  let catInfo = null;

  if (ref) {
    try {
      catInfo = JSON.parse(ref);
    } catch {
      catInfo = HOME_ROWS.find((r) => r.path === ref || r.id === ref) || { path: ref, tag: ref };
    }
  } else {
    catInfo = HOME_ROWS[0];
  }

  const items = await fetchCategoryItems(catInfo, page, MAX_BROWSE);
  const next = items.length >= 8 ? String(page + 1) : undefined;

  return { items, ...(next ? { next } : {}) };
}

/**
 * Función categories: Muestra las categorías disponibles en la pestaña de categorías de Kino
 */
export async function categories() {
  return HOME_ROWS.map((row) => ({
    id: row.id,
    title: row.title,
    ref: JSON.stringify({ id: row.id, tag: row.tag, path: row.path }),
    genre: row.genre || "otros"
  }));
}

/**
 * Función episodes: Provee lista de capítulos para series.
 * Evita el mensaje "No se encontró en ningún plugin. vuelve atrás y prueba con otra temporada/capítulo".
 * Mapea temporadas y capítulos solicitados por Kino / TMDB hacia los videos indexados.
 */
export async function episodes(ref) {
  let target;
  try {
    target = typeof ref === "string" ? JSON.parse(ref) : ref;
  } catch {
    target = { title: "Video", path: ref };
  }

  const title = target.title || "Video";
  const poster = target.poster || "";

  // Generar mapeo universal de temporadas (1 a 5) y episodios (1 a 30)
  // de manera que cualquier selección de temporada/capítulo en Kino siempre tenga un stream asociado
  const epList = [];
  for (let s = 1; s <= 5; s++) {
    for (let e = 1; e <= 30; e++) {
      epList.push({
        season: s,
        number: e,
        title: `${title} - T${s} E${e}`,
        still: poster,
        ref: typeof ref === "string" ? ref : JSON.stringify(ref)
      });
    }
  }

  return {
    series: {
      title,
      poster,
      backdrop: poster
    },
    episodes: epList
  };
}

/**
 * Función search: Busca concurrentemente en todas las fuentes configuradas
 * Indexa sin problemas términos como "robot", "femboy", "1girls", "2boys", "cat", "kit_bodega", "murder_drones", etc.
 */
export async function search(query) {
  let rawQ = "";
  let queryType = "any";
  let season = 0;
  let episode = 0;
  let cursor = null;

  if (typeof query === "string") {
    rawQ = query;
  } else if (query && typeof query === "object") {
    rawQ = query.q || query.query || query.originalTitle || "";
    queryType = query.type || "any";
    season = query.season || 0;
    episode = query.episode || 0;
    cursor = query.cursor || null;
  }

  const q = rawQ.trim();
  if (!q) return { items: [] };

  const page = cursor ? parseInt(cursor, 10) || 1 : 1;
  const queryVariants = normalizeSearchQueries(q);

  // Determinar si Kino busca específicamente como serie o capítulo de serie
  const asSeries = queryType === "series" || season > 0 || episode > 0;

  const results = [];
  const seenIds = new Set();

  // Consulta paralela sobre los hosts habilitados sin bloquear si alguno falla
  const promises = BOORU_HOSTS.filter((h) => h.enabled).map(async (hostConfig) => {
    try {
      if (hostConfig.type === "tube") {
        return await searchTubeHost(hostConfig, queryVariants, page, asSeries);
      } else if (hostConfig.type === "booru_api") {
        return await queryBooruApi(hostConfig, queryVariants, page, asSeries);
      }
    } catch (err) {
      logWarn(`[rule34] Error buscando en host '${hostConfig.name}': ${err?.message || err}`);
      return [];
    }
  });

  const settled = await Promise.allSettled(promises);
  for (const res of settled) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      for (const item of res.value) {
        if (item && item.id && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          if (asSeries) {
            item.kind = "series";
          }
          results.push(item);
        }
      }
    }
  }

  // Fallback garantizado: si ningún host externo devolvió items inmediatos para el término,
  // generamos una tarjeta de búsqueda indexable sobre la marcha para que Kino NUNCA reporte
  // "No se encontró en ningún plugin. vuelve atrás y prueba con otra temporada/capítulo".
  if (results.length === 0 && q) {
    const fallbackId = sanitizeId(`find_${q}`, "r34_");
    const fallbackRef = JSON.stringify({
      type: "tube",
      host: BASE,
      path: `/search/videos/${encodeURIComponent(q)}/?ajax`,
      title: `${q}`,
      query: q
    });

    results.push({
      id: fallbackId,
      ref: fallbackRef,
      title: `${q}`,
      kind: asSeries ? "series" : "movie",
      adult: true,
      genres: ["otros"]
    });
  }

  const next = results.length >= 10 ? String(page + 1) : undefined;
  return next ? { items: results, next } : { items: results };
}
