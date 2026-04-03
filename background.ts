import { MESSAGE_TYPE } from "./src/constants";
import { handleSaveWithImages, type SaveChatWithImagesMessage } from "./src/download";

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
        // TODO: argsを使ったやり方に変更
        func: () => {
          (window as unknown as Record<string, unknown>).__exportMode = "withImages";
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

chrome.runtime.onMessage.addListener((message: SaveChatWithImagesMessage, _sender, sendResponse) => {
  if (message.type !== MESSAGE_TYPE.SAVE_CHAT_WITH_IMAGES) return false;

  handleSaveWithImages(message).then(() => sendResponse({ ok: true }));
  return true; // keep channel open for async response
});
