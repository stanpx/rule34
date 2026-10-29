/**
 * Kino Plugin: Kino-Rule-34
 * Agregador de contenido multimedia (video) desde plataformas tipo Booru.
 * Propósito estrictamente educativo y de demostración técnica.
 * Entorno de ejecución: QuickJS Sandbox (sin Node.js ni DOM).
 */

// TODO: [inserta sitios web] Reemplazar con la lista final de dominios
export const BOORU_HOSTS = [
  "danbooru.org",
  "xbooru.com",
  "booru.allthefallen.moe",
  "e621.net",
  "booru.org",
  "gynoid.booru.org",
  "danbooru.org",
  "video.rule34.us",
  "rule34video.com",
  "rule34.xxx",
  "https://api-cdn-us-mp4.rule34.xxx/"
];

// Encabezados estándar para solicitudes de datos y streaming
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*"
};

// Extensiones de archivo clasificadas como video
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m3u", ".m3u8", ".m4v"];

/**
 * Registro de mensajes en la consola o log de Kino (kino.log si está disponible)
 */
function logInfo(...args) {
  if (typeof kino !== "undefined" && typeof kino.log === "function") {
    kino.log(...args);
  } else if (typeof console !== "undefined" && typeof console.log === "function") {
    console.log(...args);
  }
}

/**
 * Sanitiza identificadores para cumplir con la especificación de Kino (^[A-Za-z0-9._~-]{1,100}$)
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
 * Convierte URLs relativas o esquemas "//" en URLs completas válidas (https://...)
 */
function resolveFullUrl(pathOrUrl, baseHost) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("//")) {
    return `https:${pathOrUrl}`;
  }
  const cleanHost = baseHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `https://${cleanHost}${cleanPath}`;
}

/**
 * Comprueba si un recurso corresponde a un video admitido
 */
function isVideoUrl(url, extHint = "") {
  if (!url && !extHint) return false;
  const lowerUrl = (url || "").toLowerCase().split("?")[0];
  const lowerExt = (extHint || "").toLowerCase().replace(/^\./, "");

  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(lowerExt)) {
    return true;
  }
  return VIDEO_EXTENSIONS.some((ext) => lowerUrl.endsWith(ext));
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
 * Realiza una petición HTTP GET en QuickJS (kino.fetch) o fetch estándar
 */
async function httpGetJson(url, extraHeaders = {}) {
  const headers = Object.assign({}, DEFAULT_HEADERS, extraHeaders);

  if (typeof kino !== "undefined" && typeof kino.fetch === "function") {
    const res = await kino.fetch(url, {
      method: "GET",
      headers: headers
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al solicitar ${url}`);
    }
    return res.json();
  }

  // Fallback seguro para pruebas fuera de Kino (ej. suites de test en Node)
  const testFetch = globalThis["fetch"];
  if (typeof testFetch === "function") {
    const res = await testFetch(url, {
      method: "GET",
      headers: headers
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al solicitar ${url}`);
    }
    return await res.json();
  }

  throw new Error("No hay cliente HTTP disponible en el entorno actual");
}

/**
 * Normaliza un post recibido desde una API Booru al formato KinoItem
 */
function normalizePost(raw, host) {
  if (!raw || typeof raw !== "object") return null;

  const postId = raw.id || raw.post_id || raw.uuid || raw.hash;
  if (!postId) return null;

  // 1. Extraer URL del video (compatible con múltiples estilos de API)
  let videoUrl = raw.file_url || raw.url || raw.video_url || raw.direct_url;

  // Estilo Danbooru (media_asset / variants)
  if (!videoUrl && raw.media_asset && Array.isArray(raw.media_asset.variants)) {
    const original = raw.media_asset.variants.find((v) => v.type === "original" || v.type === "sample");
    if (original && original.url) videoUrl = original.url;
  }
  if (!videoUrl && raw.file && typeof raw.file === "object") {
    videoUrl = raw.file.url;
  }

  const fileExt = raw.file_ext || raw.ext || "";
  const resolvedVideoUrl = resolveFullUrl(videoUrl, host);

  // Filtrar si no es un archivo de video
  if (!resolvedVideoUrl || !isVideoUrl(resolvedVideoUrl, fileExt)) {
    return null;
  }

  // 2. Extraer Miniatura (preview)
  let thumbUrl = raw.preview_file_url || raw.preview_url || raw.thumbnail || raw.sample_url || raw.preview || "";
  if (!thumbUrl && raw.preview && typeof raw.preview === "object") {
    thumbUrl = raw.preview.url;
  }
  const resolvedThumb = resolveFullUrl(thumbUrl, host);

  // 3. Extraer Etiquetas y Título
  let tags = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags;
  } else if (typeof raw.tag_string === "string") {
    tags = raw.tag_string.split(/\s+/).filter(Boolean);
  } else if (typeof raw.tags === "string") {
    tags = raw.tags.split(/\s+/).filter(Boolean);
  }

  let title = raw.title || raw.name || raw.filename || "";
  if (!title && tags.length > 0) {
    title = tags.slice(0, 3).map((t) => t.replace(/_/g, " ")).join(" - ");
  }
  if (!title) {
    title = `Video #${postId}`;
  }

  const safeHost = host.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const uniqueId = sanitizeId(`${safeHost}_${postId}`);

  // Empaquetar datos de resolución en el ref
  const ref = JSON.stringify({
    host: host,
    id: String(postId),
    title: title,
    url: resolvedVideoUrl,
    mime: getMimeType(resolvedVideoUrl),
    thumbnail: resolvedThumb || null
  });

  return {
    id: uniqueId,
    ref: ref,
    title: title.slice(0, 100),
    kind: "movie",
    poster: resolvedThumb || undefined,
    backdrop: resolvedThumb || undefined,
    overview: tags.length > 0 ? tags.join(", ").slice(0, 400) : "VideoBooru agregador",
    genres: tags.slice(0, 5).map((g) => g.slice(0, 30)),
    adult: true // Habilitado con apiVersion 6 para control parental
  };
}

/**
 * Consulta un host booru mediante endpoints REST comunes
 */
async function queryBooruHost(host, query) {
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const searchTerm = encodeURIComponent(query ? query.trim() : "");

  // Lista de patrones de API habituales en motores Booru
  const endpoints = [
    // 1. Endpoint REST genérico solicitado en la especificación
    `https://${cleanHost}/api/v1/json/search/posts?q=video+${searchTerm}`,
    // 2. Endpoint REST Danbooru / Moebooru
    `https://${cleanHost}/posts.json?tags=video+${searchTerm}&limit=30`,
    // 3. Endpoint Gelbooru DAPI JSON
    `https://${cleanHost}/index.php?page=dapi&s=post&q=index&json=1&tags=video+${searchTerm}&limit=30`
  ];

  for (const url of endpoints) {
    try {
      const data = await httpGetJson(url);
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
        const items = [];
        for (const post of rawList) {
          const item = normalizePost(post, cleanHost);
          if (item) items.push(item);
        }
        if (items.length > 0) {
          return items;
        }
      }
    } catch (err) {
      logInfo(`[VideoBooru] Host ${cleanHost} no respondió en ${url}: ${err?.message || err}`);
    }
  }

  return [];
}

/**
 * Función obligatoria search: busca videos en todos los boorus configurados
 */
export async function search(query) {
  let rawQ = "";
  if (typeof query === "string") {
    rawQ = query;
  } else if (query && typeof query === "object") {
    rawQ = query.q || query.query || "";
  }

  const q = (rawQ || "").trim();
  if (!q) {
    return [];
  }

  const results = [];
  const seenIds = new Set();

  // Consultar todos los hosts concurrentemente sin bloquear en fallos
  const promises = BOORU_HOSTS.map(async (host) => {
    try {
      return await queryBooruHost(host, q);
    } catch (err) {
      logInfo(`[VideoBooru] Error no controlado en host ${host}: ${err?.message || err}`);
      return [];
    }
  });

  const settled = await Promise.allSettled(promises);
  for (const res of settled) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      for (const item of res.value) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    }
  }

  return results;
}

/**
 * Función home: fila de destacados / videos recientes
 */
export async function home() {
  const recentItems = [];
  const seenIds = new Set();

  const promises = BOORU_HOSTS.map(async (host) => {
    try {
      // Consulta sin término específico para obtener los últimos aportes
      return await queryBooruHost(host, "");
    } catch (err) {
      logInfo(`[VideoBooru] Error en home para host ${host}: ${err?.message || err}`);
      return [];
    }
  });

  const settled = await Promise.allSettled(promises);
  for (const res of settled) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      for (const item of res.value) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          recentItems.push(item);
        }
      }
    }
  }

  if (recentItems.length === 0) {
    return [];
  }

  return [
    {
      id: "booru_recientes",
      title: "Videos Recientes",
      items: recentItems.slice(0, 50)
    }
  ];
}

/**
 * Función obligatoria resolve: devuelve el stream ejecutable en Kino
 */
export async function resolve(itemOrRef) {
  let targetUrl = "";
  let targetMime = "video/mp4";
  let hostReferer = "";

  if (typeof itemOrRef === "string") {
    try {
      const parsed = JSON.parse(itemOrRef);
      targetUrl = parsed.url || parsed.video || "";
      targetMime = parsed.mime || getMimeType(targetUrl);
      if (parsed.host) {
        hostReferer = `https://${parsed.host}/`;
      }
    } catch {
      targetUrl = itemOrRef;
      targetMime = getMimeType(targetUrl);
    }
  } else if (itemOrRef && typeof itemOrRef === "object") {
    if (itemOrRef.ref) {
      try {
        const parsed = typeof itemOrRef.ref === "string" ? JSON.parse(itemOrRef.ref) : itemOrRef.ref;
        targetUrl = parsed.url || parsed.video || "";
        targetMime = parsed.mime || getMimeType(targetUrl);
        if (parsed.host) hostReferer = `https://${parsed.host}/`;
      } catch {
        targetUrl = itemOrRef.ref;
      }
    }
    if (!targetUrl) {
      targetUrl = itemOrRef.url || itemOrRef.video || "";
      targetMime = itemOrRef.mime || getMimeType(targetUrl);
    }
  }

  if (!targetUrl || typeof targetUrl !== "string") {
    if (typeof kino !== "undefined" && typeof kino.error === "function") {
      throw kino.error("not_found", "No se encontró enlace directo de video.", {
        userMessage: "El elemento seleccionado no contiene una URL de reproducción directa."
      });
    }
    throw new Error("No se encontró enlace directo de video");
  }

  const streamHeaders = Object.assign({}, DEFAULT_HEADERS);
  if (hostReferer) {
    streamHeaders["Referer"] = hostReferer;
  }

  return {
    url: targetUrl,
    mime: targetMime,
    headers: streamHeaders
  };
}
