import { createTurndownService, addImageRules } from "./src/turndown-rules";
import { getMessages } from "./src/messages";
import { collectImages, CollectImages, ImageEntry } from "./src/images";
import { ROLE, ROLE_ICON } from "./src/constants";
import { SaveChatWithImagesMessage } from "./src/download";

(async () => {
  const service = createTurndownService();

  // exportMode判定
  const exportMode = (window as unknown as Record<string, unknown>)["__exportMode"];
  const withImages = exportMode === "withImages";

  let collected: CollectImages | undefined;
  if (withImages) {
    // exportModeフラグをリセット（二重実行対策）
    (window as unknown as Record<string, unknown>)["__exportMode"] = undefined;

    // 画像収集（withImages時のみ）
    collected = await collectImages();
    addImageRules(service, collected.srcToRelPath, collected.canvasToRelPath);
  }

  // メッセージ取得・Markdown変換
  const messages = getMessages();

  if (messages.length === 0) return "nothing";

  const parts = messages.map(({ role, html }) => {
    const label =
      role === ROLE.USER
        ? `## ${ROLE_ICON.USER} ${ROLE.USER}`
        : `## ${ROLE_ICON.ASSISTANT} ${ROLE.ASSISTANT}`;
    const md = service.turndown(html);
    return `${label}\n\n${md}`;
  });

  const markdown = parts.join("\n\n");

  await navigator.clipboard.writeText(markdown);

  if (withImages && collected) {
    const chatTitle = document.title || "chat";
    const msg: SaveChatWithImagesMessage = {
      type: "SAVE_CHAT_WITH_IMAGES",
      markdown,
      images: collected.entries,
      chatTitle,
    };
    chrome.runtime.sendMessage(msg);
    alert(`コピー成功👍\n画像${collected.entries.length}枚をダウンロードフォルダに保存します`);
  } else {
    alert("コピー成功👍");
  }

  console.log(markdown);

  return markdown;
})();
