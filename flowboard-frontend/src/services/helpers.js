export function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

export function isTokenActive(token) {
  if (!token) return false;

  const payload = decodeJwt(token);
  if (!payload?.exp) return true;

  return payload.exp * 1000 > Date.now();
}

export function unwrapItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function unwrapSingleItem(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) return payload[0] || null;
  if (Array.isArray(payload.content)) return payload.content[0] || null;
  if (Array.isArray(payload.items)) return payload.items[0] || null;
  return payload;
}

export function getWorkspaceId(workspace) {
  return workspace?.workspaceId ?? workspace?.id ?? null;
}

export function getBoardId(board) {
  return board?.boardId ?? board?.id ?? null;
}

export function getListId(list) {
  return list?.listId ?? list?.id ?? null;
}

export function getCardId(card) {
  return card?.cardId ?? card?.id ?? null;
}

export function groupCardsByList(lists, cards) {
  return lists.map((list) => {
    const listId = getListId(list);

    return {
      ...list,
      cards: cards
        .filter((card) => card.listId === listId)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
    };
  });
}

export function formatDate(date) {
  if (!date) return "No due date";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}
