import { ROLE, HOSTNAME_CHATGPT, HOSTNAME_CLAUDE } from "./constants";

// chatgpt
const DOM_SELECTOR_CHATGPT_TURNS = "#main section[data-turn]";
const DOM_ATTR_CHATGPT_ROLE = "data-turn";
const DOM_SELECTOR_CHATGPT_TURN_CONTENT = "[data-message-author-role]";

// claude
const DOM_SELECTOR_CLAUDE_TURNS = "#main-content [data-test-render-count]";
const DOM_SELECTOR_CLAUDE_USER_TURN = "[data-testid='user-message']";
const DOM_SELECTOR_CLAUDE_ASSISTANT_TURN = ".font-claude-response .standard-markdown";

export type RoleValue = (typeof ROLE)[keyof typeof ROLE];

export type Message = {
  role: RoleValue;
  html: string;
};

export function getClaudeMessages(): Message[] {
  const messages: Message[] = [];

  const turns = document.querySelectorAll(DOM_SELECTOR_CLAUDE_TURNS);
  turns.forEach((turn) => {
    const userEl = turn.querySelector(DOM_SELECTOR_CLAUDE_USER_TURN);
    if (userEl) {
      messages.push({ role: ROLE.USER, html: userEl.innerHTML });
      return;
    }

    const assistantEls = turn.querySelectorAll(DOM_SELECTOR_CLAUDE_ASSISTANT_TURN);
    if (assistantEls.length > 0) {
      const html = Array.from(assistantEls)
        .map((el) => el.innerHTML)
        .join("");
      messages.push({ role: ROLE.ASSISTANT, html });
    }
  });

  return messages;
}

export function getChatGPTMessages(): Message[] {
  const messages: Message[] = [];

  const turns = document.querySelectorAll(DOM_SELECTOR_CHATGPT_TURNS);
  turns.forEach((turn) => {
    const role = turn.getAttribute(DOM_ATTR_CHATGPT_ROLE) as RoleValue;
    const contentEl = turn.querySelector(DOM_SELECTOR_CHATGPT_TURN_CONTENT);
    if (contentEl) {
      messages.push({ role, html: contentEl.innerHTML });
    }
  });

  return messages;
}

export function getMessages(): Message[] {
  const host = window.location.hostname;
  if (host === HOSTNAME_CLAUDE) return getClaudeMessages();
  if (host === HOSTNAME_CHATGPT) return getChatGPTMessages();
  return [];
}
