import TurndownService from "turndown";

(() => {
  const service = new TurndownService({
    hr: "---",
    codeBlockStyle: "fenced",
    preformattedCode: true,
  });

  service.addRule("trim-li-space", {
    filter: ["li"],
    replacement: function (content) {
      return "- " + content.trim() + "\n";
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
      const assistantEl = turn.querySelector(
        ".font-claude-response .standard-markdown",
      );
      if (assistantEl) {
        messages.push({ role: "assistant", html: assistantEl.innerHTML });
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
    const label = role === "user" ? "## User" : "## Assistant";
    const md = service.turndown(html);
    return `${label}\n\n${md}`;
  });

  const markdown = parts.join("\n\n");

  navigator.clipboard.writeText(markdown).then(() => alert("コピー成功👍"));

  console.log(markdown);

  return markdown;
})();
