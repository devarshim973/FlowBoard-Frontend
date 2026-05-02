import { decodeJwt } from "./helpers";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function extractErrorMessage(body) {
  if (typeof body === "string") {
    if (body.includes("Workspace service not available")) {
      return "Workspace service is not reachable from another backend service. Restart workspace-service and board-service.";
    }
    if (body.includes("User service not available")) {
      return "Auth/user service is not reachable from another backend service. Restart auth-service and the dependent service.";
    }
    return body || "Request failed";
  }

  if (body && typeof body === "object") {
    if (body.message) return body.message;
    if (body.error) return body.error;
    const values = Object.values(body).filter(Boolean);
    if (values.length) return values.join(" | ");
  }

  return "Request failed";
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(extractErrorMessage(body));
  }

  return body;
}

export async function apiRequest(path, options = {}) {
  const { token, userId, role, headers = {}, body, query } = options;
  const requestUrl = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const url = new URL(requestUrl, window.location.origin);
  const resolvedRole = role || (token ? decodeJwt(token).role : "");

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  const requestHeaders = {
    ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userId ? { "X-User-Id": String(userId) } : {}),
    ...(resolvedRole ? { "X-User-Role": resolvedRole } : {}),
    ...headers
  };

  let response;

  try {
    response = await fetch(url.toString(), {
      method: options.method || "GET",
      headers: requestHeaders,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Request failed for ${path}. Check that the matching backend service is running.`);
    }

    throw error;
  }

  return parseResponse(response);
}

export const authApi = {
  signup(payload) {
    return apiRequest("/api/v1/auth/signup", { method: "POST", body: payload });
  },
  sendSignupOtp(email) {
    return apiRequest("/api/v1/auth/signup/send-otp", { method: "POST", query: { email } });
  },
  registerAdmin(payload) {
    return apiRequest("/api/v1/auth/register-admin", { method: "POST", body: payload });
  },
  login(payload) {
    return apiRequest("/api/v1/auth/login", { method: "POST", body: payload });
  },
  sendOtp(email) {
    return apiRequest("/api/v1/auth/sendotp", { method: "POST", query: { email } });
  },
  resetPassword(payload) {
    return apiRequest("/api/v1/auth/forget", { method: "POST", body: payload });
  }
};

export const paymentApi = {
  createOrder(token, userId) {
    return apiRequest("/api/v1/payments/order", { method: "POST", token, userId });
  },
  verify(payload, token, userId) {
    return apiRequest("/api/v1/payments/verify", { method: "POST", token, userId, body: payload });
  },
  getStatus(token, userId) {
    return apiRequest("/api/v1/payments/status", { token, userId });
  }
};

export const userApi = {
  getById(targetUserId, token, userId) {
    return apiRequest(`/api/v1/user/id/${targetUserId}`, { token, userId });
  }
};

export const adminApi = {
  getUsers(token, userId) {
    return apiRequest("/api/v1/admin/user/all", { token, userId });
  },
  deleteUser(targetUserId, token, userId) {
    return apiRequest(`/api/v1/admin/${targetUserId}`, { method: "DELETE", token, userId });
  },
  disableUser(targetUserId, token, userId) {
    return apiRequest(`/api/v1/admin/disable/${targetUserId}`, { method: "PUT", token, userId });
  },
  enableUser(targetUserId, token, userId) {
    return apiRequest(`/api/v1/admin/enable/${targetUserId}`, { method: "PUT", token, userId });
  },
  getWorkspaces(token, userId) {
    return apiRequest("/api/v1/admin/workspaces", { token, userId });
  },
  deleteWorkspace(workspaceId, token, userId) {
    return apiRequest(`/api/v1/admin/workspaces/${workspaceId}`, { method: "DELETE", token, userId });
  },
  getBoards(token, userId) {
    return apiRequest("/api/v1/admin/boards", { token, userId });
  },
  deleteBoard(boardId, token, userId) {
    return apiRequest(`/api/v1/admin/boards/${boardId}`, { method: "DELETE", token, userId });
  }
};

export const workspaceApi = {
  getMine(token, userId) {
    return apiRequest("/api/v1/workspaces/me", { token, userId });
  },
  create(payload, token, userId) {
    return apiRequest("/api/v1/workspaces/create", { method: "POST", token, userId, body: payload });
  },
  update(workspaceId, payload, token, userId) {
    return apiRequest(`/api/v1/workspaces/update/${workspaceId}`, { method: "PUT", token, userId, body: payload });
  },
  delete(workspaceId, token, userId) {
    return apiRequest(`/api/v1/workspaces/delete/${workspaceId}`, { method: "DELETE", token, userId });
  }
};

export const boardApi = {
  getPrivate(workspaceId, token, userId) {
    return apiRequest(`/api/v1/boards/workspace/${workspaceId}/private`, { token, userId });
  },
  getById(boardId, token, userId) {
    return apiRequest(`/api/v1/boards/get/${boardId}`, { token, userId });
  },
  create(payload, token, userId) {
    return apiRequest("/api/v1/boards/create", { method: "POST", token, userId, body: payload });
  },
  update(boardId, payload, token, userId) {
    return apiRequest(`/api/v1/boards/update/${boardId}`, { method: "PUT", token, userId, body: payload });
  },
  delete(boardId, token, userId) {
    return apiRequest(`/api/v1/boards/delete/${boardId}`, { method: "DELETE", token, userId });
  }
};

export const listApi = {
  getByBoard(boardId, token, userId) {
    return apiRequest(`/api/v1/lists/board/${boardId}`, { token, userId });
  },
  create(payload, token, userId) {
    return apiRequest("/api/v1/lists/create", { method: "POST", token, userId, body: payload });
  },
  update(listId, payload, token, userId) {
    return apiRequest(`/api/v1/lists/update/${listId}`, { method: "PUT", token, userId, body: payload });
  },
  delete(listId, token, userId) {
    return apiRequest(`/api/v1/lists/delete/${listId}`, { method: "DELETE", token, userId });
  }
};

export const cardApi = {
  getByBoard(boardId, token, userId) {
    return apiRequest(`/api/v1/cards/get/board/${boardId}`, { token, userId });
  },
  create(payload, token, userId) {
    return apiRequest("/api/v1/cards/create", { method: "POST", token, userId, body: payload });
  },
  updateStatus(cardId, status, token, userId) {
    return apiRequest(`/api/v1/cards/${cardId}/status`, { method: "PUT", token, userId, query: { status } });
  },
  update(cardId, payload, token, userId) {
    return apiRequest(`/api/v1/cards/update/${cardId}`, { method: "PUT", token, userId, body: payload });
  },
  delete(cardId, token, userId) {
    return apiRequest(`/api/v1/cards/delete/${cardId}`, { method: "DELETE", token, userId });
  },
  move(cardId, listId, position, token, userId) {
    return apiRequest(`/api/v1/cards/${cardId}/move`, { method: "PUT", token, userId, query: { targetListId: listId, position } });
  }
};

export const commentApi = {
  getByCard(cardId, token, userId) {
    return apiRequest(`/api/v1/comments/card/${cardId}`, { token, userId });
  }
};

export const notificationApi = {
  getByRecipient(recipientId, token, userId) {
    return apiRequest(`/api/v1/notifications/recipient/${recipientId}`, { token, userId });
  },
  unreadCount(recipientId, token, userId) {
    return apiRequest(`/api/v1/notifications/recipient/unread-count/${recipientId}`, { token, userId });
  },
  markAllRead(recipientId, token, userId) {
    return apiRequest(`/api/v1/notifications/readAll/${recipientId}`, { method: "PUT", token, userId });
  }
};
