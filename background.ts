chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "genaiChatToMarkdown",
    title: "Convert chat to Markdown",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "genaiChatToMarkdown") {
    if (!tab?.id) return;

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
});
