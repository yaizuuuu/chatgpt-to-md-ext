import TurndownService from "turndown";
import type { ImageEntry, SaveChatWithImagesMessage } from "./types";

(async () => {
  const service = new TurndownService({
    hr: "---",
    codeBlockStyle: "fenced",
    preformattedCode: true,
  });

  service.addRule("table", {
    filter: ["table"],
    replacement: function (_content: string, node: HTMLElement) {
      const trEls = Array.from(node.querySelectorAll("tr"));
      if (trEls.length === 0) return _content;

      const rows = trEls.map((tr) =>
        Array.from(tr.querySelectorAll("th, td")).map(
          (cell) => cell.textContent?.trim().replace(/\|/g, "\\|") ?? "",
        ),
      );

      const firstTr = node.querySelector("tr");
      const hasHeader = firstTr ? firstTr.querySelector("th") !== null : false;

      const headerRow = rows[0];
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const toRow = (cells: string[]) => "| " + cells.join(" | ") + " |";
      const separator = "| " + headerRow.map(() => "---").join(" | ") + " |";

      const lines = [toRow(headerRow), separator, ...dataRows.map(toRow)];
      return "\n\n" + lines.join("\n") + "\n\n";
    },
  });

  service.addRule("trim-li-space", {
    filter: ["li"],
    replacement: function (content) {
      return "- " + content.trim() + "\n";
    },
  });

  service.addRule("chatgpt-code-block", {
    filter: function (node: HTMLElement) {
      return (
        node.nodeName === "PRE" && node.querySelector(".cm-content") !== null
      );
    },
    replacement: function (_content: string, node: HTMLElement) {
      const langEl = node.querySelector(".text-token-text-primary");
      let language = "";
      if (langEl) {
        language = Array.from(langEl.childNodes)
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent?.trim() ?? "")
          .join("")
          .trim();
      }

      const cmContent = node.querySelector(".cm-content");
      if (!cmContent) return "";

      let code = "";
      for (const child of Array.from(cmContent.childNodes)) {
        if (child.nodeName === "BR") {
          code += "\n";
        } else {
          code += child.textContent ?? "";
        }
      }
      code = code.replace(/\n$/, "");

      let fenceSize = 3;
      const fenceRegex = /^`{3,}/gm;
      let match;
      while ((match = fenceRegex.exec(code))) {
        if (match[0].length >= fenceSize) fenceSize = match[0].length + 1;
      }
      const fence = "`".repeat(fenceSize);

      return (
        "\n\n" +
        fence +
        (language !== "" ? language : "text") +
        "\n" +
        code +
        "\n" +
        fence +
        "\n\n"
      );
    },
  });

  type Message = { role: "user" | "assistant"; html: string };

  function getClaudeMessages(): Message[] {
    const messages: Message[] = [];
    const turns = document.querySelectorAll(
      "#main-content [data-test-render-count]",
    );
    turns.forEach((turn) => {
      const userEl = turn.querySelector("[data-testid='user-message']");
      if (userEl) {
        messages.push({ role: "user", html: userEl.innerHTML });
        return;
      }
      const assistantEls = turn.querySelectorAll(
        ".font-claude-response .standard-markdown",
      );
      if (assistantEls.length > 0) {
        const html = Array.from(assistantEls)
          .map((el) => el.innerHTML)
          .join("");
        messages.push({ role: "assistant", html });
      }
    });
    return messages;
  }

  function getChatGPTMessages(): Message[] {
    const messages: Message[] = [];
    const turns = document.querySelectorAll("#main section[data-turn]");
    turns.forEach((turn) => {
      const role = turn.getAttribute("data-turn") as "user" | "assistant";
      const contentEl = turn.querySelector("[data-message-author-role]");
      if (contentEl) {
        messages.push({ role, html: contentEl.innerHTML });
      }
    });
    return messages;
  }

  function getMessages(): Message[] {
    const host = window.location.hostname;
    if (host === "claude.ai") return getClaudeMessages();
    if (host === "chatgpt.com") return getChatGPTMessages();
    return [];
  }

  // ---- 画像収集 ----

  function isUiIcon(img: HTMLImageElement): boolean {
    // aria-hidden な画像はUIアイコン
    if (img.getAttribute("aria-hidden") === "true") return true;
    // button の中の画像はUIアイコン
    if (img.closest("button")) return true;
    // 24px以下の小さな画像はアイコン扱い
    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.width <= 24 && rect.height <= 24) return true;
    if (
      img.naturalWidth > 0 &&
      img.naturalWidth <= 24 &&
      img.naturalHeight <= 24
    )
      return true;
    return false;
  }

  function mimeToExtension(mime: string): string {
    const map: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/bmp": "bmp",
    };
    return map[mime] ?? "png";
  }

  function mimeFromDataUrl(dataUrl: string): string {
    const m = dataUrl.match(/^data:([^;,]+)/);
    return m ? m[1] : "image/png";
  }

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function extractImageDataUrl(
    img: HTMLImageElement,
  ): Promise<string | null> {
    const src = img.getAttribute("src") || "";

    // data URL はそのまま返す
    if (src.startsWith("data:")) return src;

    // blob: / https: は fetch で取得
    if (src.startsWith("blob:") || src.startsWith("https://") || src.startsWith("http://")) {
      try {
        const resp = await fetch(src, { mode: "cors" });
        const blob = await resp.blob();
        return await blobToDataUrl(blob);
      } catch {
        // CORS失敗時はcanvas経由で試みる
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 1;
          canvas.height = img.naturalHeight || img.height || 1;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          return canvas.toDataURL();
        } catch {
          // 取得できなかった場合は元のURLを返す（Markdownには元URLを残す）
          return null;
        }
      }
    }

    return null;
  }

  type CollectedImage = {
    originalSrc: string;
    dataUrl: string;
    filename: string;
  };

  async function collectImages(): Promise<{
    entries: ImageEntry[];
    srcToRelPath: Map<string, string>;
    canvasToRelPath: Map<HTMLCanvasElement, string>;
  }> {
    const host = window.location.hostname;
    let imgSelectors: string[];
    let canvasSelectors: string[];

    if (host === "claude.ai") {
      imgSelectors = [
        "#main-content [data-test-render-count] [data-testid='user-message'] img",
        "#main-content [data-test-render-count] .font-claude-response img",
      ];
      canvasSelectors = [
        "#main-content [data-test-render-count] [data-testid='user-message'] canvas",
        "#main-content [data-test-render-count] .font-claude-response canvas",
      ];
    } else {
      // chatgpt.com
      imgSelectors = [
        "#main section[data-turn] [data-message-author-role] img",
      ];
      canvasSelectors = [
        "#main section[data-turn] [data-message-author-role] canvas",
      ];
    }

    const srcToRelPath = new Map<string, string>();
    const canvasToRelPath = new Map<HTMLCanvasElement, string>();
    const collected: CollectedImage[] = [];
    let counter = 1;

    // <img> 収集
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
          // 取得できなかった場合は元URLをそのまま使う
          srcToRelPath.set(src, src);
          continue;
        }

        const mime = mimeFromDataUrl(dataUrl);
        const ext = mimeToExtension(mime);
        const filename = `image-${String(counter).padStart(3, "0")}.${ext}`;
        counter++;

        collected.push({ originalSrc: src, dataUrl, filename });
        srcToRelPath.set(src, `images/${filename}`);
      }
    }

    // <canvas> 収集
    for (const selector of canvasSelectors) {
      const canvases = document.querySelectorAll<HTMLCanvasElement>(selector);
      for (const canvas of Array.from(canvases)) {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          const filename = `image-${String(counter).padStart(3, "0")}.png`;
          counter++;
          collected.push({ originalSrc: "", dataUrl, filename });
          canvasToRelPath.set(canvas, `images/${filename}`);
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

  // ---- exportMode判定 ----
  const exportMode =
    (window as unknown as Record<string, unknown>)["__exportMode"];
  const withImages = exportMode === "withImages";

  // exportMode フラグをリセット（二重実行対策）
  if (withImages) {
    (window as unknown as Record<string, unknown>)["__exportMode"] = undefined;
  }

  // ---- 画像ルールをTurndownServiceに追加（withImages時のみ有効化） ----
  let srcToRelPath = new Map<string, string>();
  let canvasToRelPath = new Map<HTMLCanvasElement, string>();
  let imageEntries: ImageEntry[] = [];

  if (withImages) {
    const result = await collectImages();
    srcToRelPath = result.srcToRelPath;
    canvasToRelPath = result.canvasToRelPath;
    imageEntries = result.entries;
  }

  service.addRule("extract-image", {
    filter: "img",
    replacement: function (_content: string, node: HTMLElement) {
      const img = node as HTMLImageElement;
      const src = img.getAttribute("src") || "";
      if (!withImages) {
        // 通常モードはデフォルト動作（alt + src そのまま）
        const alt = img.getAttribute("alt") || "";
        return `![${alt}](${src})`;
      }
      const relPath = srcToRelPath.get(src);
      if (!relPath) return ""; // UIアイコン等（収集対象外）
      const alt = img.getAttribute("alt") || "";
      return `![${alt}](${relPath})`;
    },
  });

  service.addRule("canvas-image", {
    filter: "canvas",
    replacement: function (_content: string, node: HTMLElement) {
      if (!withImages) return "";
      const relPath = canvasToRelPath.get(node as HTMLCanvasElement);
      if (!relPath) return "";
      return `![canvas](${relPath})`;
    },
  });

  // ---- メッセージ取得・Markdown変換 ----
  const messages = getMessages();

  if (messages.length === 0) return "nothing";

  const parts = messages.map(({ role, html }) => {
    const label = role === "user" ? "## 👤 User" : "## 🤖 Assistant";
    const md = service.turndown(html);
    return `${label}\n\n${md}`;
  });

  const markdown = parts.join("\n\n");

  await navigator.clipboard.writeText(markdown);

  if (withImages) {
    const chatTitle = document.title || "chat";
    const msg: SaveChatWithImagesMessage = {
      type: "SAVE_CHAT_WITH_IMAGES",
      markdown,
      images: imageEntries,
      chatTitle,
    };
    chrome.runtime.sendMessage(msg);
    alert(`コピー成功👍\n画像${imageEntries.length}枚をダウンロードフォルダに保存します`);
  } else {
    alert("コピー成功👍");
  }

  console.log(markdown);

  return markdown;
})();
