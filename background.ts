import type { SaveChatWithImagesMessage } from "./types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "genaiChatToMarkdown",
    title: "Convert chat to Markdown",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "genaiChatToMarkdownWithImages",
    title: "Export chat with images",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === "genaiChatToMarkdown") {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ["dist/content.js"],
      },
      (results) => {
        const markdown = results?.[0]?.result;
        console.log("MARKDOWN:\n===\n", markdown);
      },
    );
  }

  if (info.menuItemId === "genaiChatToMarkdownWithImages") {
    // exportMode を window に設定してから content.js を inject
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          (window as unknown as Record<string, unknown>)["__exportMode"] =
            "withImages";
        },
      },
      () => {
        if (!tab.id) return;
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["dist/content.js"],
        });
      },
    );
  }
});

chrome.runtime.onMessage.addListener(
  (message: SaveChatWithImagesMessage, _sender, sendResponse) => {
    if (message.type !== "SAVE_CHAT_WITH_IMAGES") return false;

    handleSaveWithImages(message).then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async response
  },
);

async function handleSaveWithImages(
  message: SaveChatWithImagesMessage,
): Promise<void> {
  const folderName = sanitizeFolderName(message.chatTitle);
  const baseDir = `GenAI-Chat-Export/${folderName}`;

  // 画像ファイルを順番にダウンロード
  for (const img of message.images) {
    await downloadFile(img.dataUrl, `${baseDir}/images/${img.filename}`);
  }

  // Markdownファイルをダウンロード
  const mdDataUrl =
    "data:text/markdown;base64," +
    btoa(unescape(encodeURIComponent(message.markdown)));
  await downloadFile(mdDataUrl, `${baseDir}/chat.md`);
}

function downloadFile(url: string, filename: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url, filename, conflictAction: "uniquify" },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      },
    );
  });
}

function sanitizeFolderName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 50)
      .replace(/^_+|_+$/g, "") || "chat"
  );
}
