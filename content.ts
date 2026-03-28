import TurndownService from "turndown";

(() => {
  const service = new TurndownService();

  function getChatContainer(): string | undefined {
    const host = window.location.hostname;

    if (host === "chatgpt.com") {
      return document.getElementById("main")?.outerHTML;
    }

    if (host === "claude.ai") {
      return document.getElementById("main-content")?.outerHTML;
    }

    return undefined;
  }

  const chat = getChatContainer();

  if (!chat) return "nothing";

  const markdown = service.turndown(chat!);

  navigator.clipboard
    .writeText(markdown as string)
    .then(() => alert("コピー成功👍"));

  console.log(markdown);

  return markdown;
})();
