import TurndownService from "turndown";
import { CanvasToRelPath, SrcToRelPath } from "./images";

const DOM_SELECTOR_CHATGPT_CODE_BLOCK_LANG = ".text-token-text-primary";
const DOM_SELECTOR_CHATGPT_CODE_BLOCK_CONTENT = ".cm-content";

export function createTurndownService(): TurndownService {
  const service = new TurndownService({
    // hr tag be converted to --- (default is * * *)
    hr: "---",
    // code block be converted to ``` (default is tab)
    codeBlockStyle: "fenced",
    // holding whitespaces in pre and code tags
    preformattedCode: true,
  });

  service.addRule("table", {
    filter: ["table"],
    replacement: function (_content: string, node: HTMLElement) {
      const trEls = Array.from(node.querySelectorAll("tr"));

      if (trEls.length === 0) return _content;

      const rows = trEls.map((tr) =>
        Array.from(tr.querySelectorAll("th, td")).map((cell) => cell.textContent?.trim().replace(/\|/g, "\\|") ?? ""),
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

  service.addRule("remove-unnecessary-whitespace-in-li", {
    filter: ["li"],
    replacement: function (content) {
      return "- " + content.trim() + "\n";
    },
  });

  service.addRule("chatgpt-code-block", {
    filter: function (node: HTMLElement) {
      return node.nodeName === "PRE" && node.querySelector(DOM_SELECTOR_CHATGPT_CODE_BLOCK_CONTENT) !== null;
    },
    replacement: function (_content: string, node: HTMLElement) {
      const langEl = node.querySelector(DOM_SELECTOR_CHATGPT_CODE_BLOCK_LANG);
      let language = "";
      if (langEl) {
        language = Array.from(langEl.childNodes)
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent?.trim() ?? "")
          .join("")
          .trim();
      }
      language = language || "text";

      const contentEl = node.querySelector(DOM_SELECTOR_CHATGPT_CODE_BLOCK_CONTENT);
      if (!contentEl) return "";

      let code = "";
      for (const child of Array.from(contentEl.childNodes)) {
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

      return "\n\n" + fence + language + "\n" + code + "\n" + fence + "\n\n";
    },
  });

  return service;
}

export function addImageRules(
  service: TurndownService,
  srcToRelPath: SrcToRelPath,
  canvasToRelPath: CanvasToRelPath,
  withImages: boolean,
): void {
  service.addRule("extract-image", {
    filter: "img",
    replacement: function (_content: string, node: HTMLElement) {
      const img = node as HTMLImageElement;
      const src = img.getAttribute("src") || "";
      if (!withImages) {
        const alt = img.getAttribute("alt") || "";
        return `![${alt}](${src})`;
      }
      const relPath = srcToRelPath.get(src);
      if (!relPath) return "";
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
}
