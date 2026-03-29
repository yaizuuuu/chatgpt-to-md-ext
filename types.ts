export type ImageEntry = {
  filename: string;
  dataUrl: string;
};

export type SaveChatWithImagesMessage = {
  type: "SAVE_CHAT_WITH_IMAGES";
  markdown: string;
  images: ImageEntry[];
  chatTitle: string;
};
