import TurndownService from "turndown";

(() => {
  const service = new TurndownService();

  const chat = document.getElementById("main")?.outerHTML;

  if (!chat) return "nothing";

  const markdown = service.turndown(chat!);

  navigator.clipboard
    .writeText(markdown as string)
    .then(() => alert("コピー成功👍"));

  console.log(markdown);

  return markdown;
})();
