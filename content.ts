import TurndownService from "turndown";

(() => {
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
        // Codex解説:
        //
        // childNodes には、その要素の直下にある「ノード」が全部入ります。
        // children と違って、テキストノードやコメントノードも含むのがポイントです。
        //
        // 具体例
        // たとえばこのHTMLがあるとします。
        //
        // <div id="sample">
        //   Hello
        //   <span>World</span>
        //   <!-- comment -->
        // </div>
        // #sample.childNodes には、だいたいこんなものが入ります。
        //
        // #text ノード
        //
        // 改行やインデントの空白
        // " Hello\n " みたいな文字列
        // span 要素ノード
        //
        // <span>World</span>
        // #text ノード
        //
        // "\n " みたいな空白
        // #comment ノード
        //
        // <!-- comment -->
        // #text ノード
        //
        // 改行や閉じタグ前の空白
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

      // codex解説:
      // code の中に ``` や ```` のような連続バッククォートがあれば拾います。
      // もしコード内に ``` があるのに、外側も ``` だと、Markdown の囲みが途中で終わってしまいます。
      // それを防ぐために、コード内で見つかったバッククォート列より 1文字多い fence を使います。
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

  // チャット全体は以下の要素のHTMLから取得できる
  // document.getElementById("main-content").outerHTML;
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
      // claudeがtools等を使うと1回のreplyに複数のdivが使われることがあるため、ここはquerySelectorAllとなる
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

  // チャット全体は以下の要素のHTMLから取得できる
  // document.getElementById("main").outerHTML;
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

  const messages = getMessages();

  if (messages.length === 0) return "nothing";

  const parts = messages.map(({ role, html }) => {
    const label = role === "user" ? "## 👤 User" : "## 🤖 Assistant";
    const md = service.turndown(html);
    return `${label}\n\n${md}`;
  });

  const markdown = parts.join("\n\n");

  navigator.clipboard.writeText(markdown).then(() => alert("コピー成功👍"));

  console.log(markdown);

  return markdown;
})();
