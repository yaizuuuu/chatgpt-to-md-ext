import { HOSTNAME_CHATGPT, HOSTNAME_CLAUDE } from "./constants";

const MIMES = {
  PNG: "image/png",
  JPEG: "image/jpeg",
  GIF: "image/gif",
  WEBP: "image/webp",
  SVG: "image/svg+xml",
  BMP: "image/bmp",
};

const EXTS = {
  PNG: "png",
  JPEG: "jpeg",
  GIF: "gif",
  WEBP: "webp",
  SVG: "svg",
  BMP: "bmp",
};

const mime_to_ext_map: Record<string, string> = {
  [MIMES.PNG]: EXTS.PNG,
  [MIMES.JPEG]: EXTS.JPEG,
  [MIMES.GIF]: EXTS.GIF,
  [MIMES.WEBP]: EXTS.WEBP,
  [MIMES.SVG]: EXTS.SVG,
  [MIMES.BMP]: EXTS.BMP,
};

const IMAGE_FILE_PREFIX = "image";
const IMAGE_FILE_PATH = "images";

// claude
const DOM_SELECTOR_CLAUDE_IMGS = [
  "#main-content [data-test-render-count] [data-testid='user-message'] img",
  "#main-content [data-test-render-count] .font-claude-response img",
];
const DOM_SELECTOR_CLAUDE_CANVASES = [
  "#main-content [data-test-render-count] [data-testid='user-message'] canvas",
  "#main-content [data-test-render-count] .font-claude-response canvas",
];

// chatgpt
const DOM_SELECTOR_CHATGPT_IMGS = ["#main section[data-turn] [data-message-author-role] img"];
const DOM_SELECTOR_CHATGPT_CANVASES = ["#main section[data-turn] [data-message-author-role] canvas"];

type CollectedImage = {
  originalSrc: string;
  dataUrl: string;
  filename: string;
};

export type ImageEntry = {
  filename: string;
  dataUrl: string;
};

export type SrcToRelPath = Map<string, string>;

export type CanvasToRelPath = Map<HTMLCanvasElement, string>;

export type CollectImages = {
  entries: ImageEntry[];
  srcToRelPath: SrcToRelPath;
  canvasToRelPath: CanvasToRelPath;
};

// skip the icon
function isUiIcon(img: HTMLImageElement): boolean {
  if (img.getAttribute("aria-hidden") === "true") return true;
  if (img.closest("button")) return true;

  // https://developer.mozilla.org/ja/docs/Web/API/Element/getBoundingClientRect
  const rect = img.getBoundingClientRect();
  if (rect.width > 0 && rect.width <= 24 && rect.height <= 24) return true;
  if (img.naturalWidth > 0 && img.naturalWidth <= 24 && img.naturalHeight <= 24) return true;

  return false;
}

function mimeToExtension(mime: string): string {
  return mime_to_ext_map[mime] ?? EXTS.PNG;
}

function mimeFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;,]+)/);
  return m ? m[1] : MIMES.PNG;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function extractImageDataUrl(img: HTMLImageElement): Promise<string | null> {
  const src = img.getAttribute("src") || "";

  if (src.startsWith("data:")) return src;

  if (src.startsWith("blob:") || src.startsWith("https://") || src.startsWith("http://")) {
    try {
      const resp = await fetch(src, { mode: "cors" });
      const blob = await resp.blob();
      return await blobToDataUrl(blob);
    } catch {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        return canvas.toDataURL();
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function collectImages(): Promise<CollectImages> {
  const host = window.location.hostname;
  let imgSelectors: string[];
  let canvasSelectors: string[];

  if (host === HOSTNAME_CLAUDE) {
    imgSelectors = DOM_SELECTOR_CLAUDE_IMGS;
    canvasSelectors = DOM_SELECTOR_CLAUDE_CANVASES;
  } else if (host === HOSTNAME_CHATGPT) {
    imgSelectors = DOM_SELECTOR_CHATGPT_IMGS;
    canvasSelectors = DOM_SELECTOR_CHATGPT_CANVASES;
  } else {
    alert("not allowed domain!!");
    throw new Error("not allowed domain!!");
  }

  const srcToRelPath: SrcToRelPath = new Map<string, string>();
  const canvasToRelPath: CanvasToRelPath = new Map<HTMLCanvasElement, string>();
  const collected: CollectedImage[] = [];
  let counter = 1;

  const seenSrcs = new Set<string>();
  for (const selector of imgSelectors) {
    const imgs = document.querySelectorAll<HTMLImageElement>(selector);
    for (const img of Array.from(imgs)) {
      if (isUiIcon(img)) continue;

      const src = img.getAttribute("src") || "";
      if (!src) continue;
      if (seenSrcs.has(src)) continue;
      seenSrcs.add(src);

      const dataUrl = await extractImageDataUrl(img);
      if (!dataUrl) {
        srcToRelPath.set(src, src);
        continue;
      }

      const mime = mimeFromDataUrl(dataUrl);
      const ext = mimeToExtension(mime);
      const filename = `${IMAGE_FILE_PREFIX}-${String(counter).padStart(3, "0")}.${ext}`;
      counter++;

      collected.push({ originalSrc: src, dataUrl, filename });
      srcToRelPath.set(src, `${IMAGE_FILE_PATH}/${filename}`);
    }
  }

  for (const selector of canvasSelectors) {
    const canvases = document.querySelectorAll<HTMLCanvasElement>(selector);
    for (const canvas of Array.from(canvases)) {
      try {
        const dataUrl = canvas.toDataURL(MIMES.PNG);
        const filename = `${IMAGE_FILE_PREFIX}-${String(counter).padStart(3, "0")}.${EXTS.PNG}`;
        counter++;
        collected.push({ originalSrc: "", dataUrl, filename });
        canvasToRelPath.set(canvas, `${IMAGE_FILE_PATH}/${filename}`);
      } catch {
        // tainted canvas は無視
      }
    }
  }

  const entries: ImageEntry[] = collected.map(({ dataUrl, filename }) => ({
    dataUrl,
    filename,
  }));

  return { entries, srcToRelPath, canvasToRelPath };
}
