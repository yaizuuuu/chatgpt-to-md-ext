import type { ImageEntry } from "./images";

export type SaveChatWithImagesMessage = {
  type: "SAVE_CHAT_WITH_IMAGES";
  markdown: string;
  images: ImageEntry[];
  chatTitle: string;
};

export async function handleSaveWithImages(message: SaveChatWithImagesMessage): Promise<void> {
  const folderName = sanitizeFolderName(message.chatTitle);
  const baseDir = `GenAI-Chat-Export/${folderName}`;

  for (const img of message.images) {
    await downloadFile(img.dataUrl, `${baseDir}/images/${img.filename}`);
  }

  const bytes = new TextEncoder().encode(message.markdown);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const mdDataUrl = "data:text/markdown;base64," + btoa(binary);

  await downloadFile(mdDataUrl, `${baseDir}/chat.md`);
}

export function downloadFile(url: string, filename: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, conflictAction: "uniquify" }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(downloadId);
      }
    });
  });
}

export function sanitizeFolderName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 50)
      .replace(/^_+|_+$/g, "") || "chat"
  );
}
