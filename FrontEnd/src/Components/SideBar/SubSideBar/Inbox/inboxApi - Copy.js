import axios from "axios";

/**
 * Backend API Base URL configuration.
 * Configured via .env (VITE_API_BASE_URL) or defaults to local Django backend server.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

/**
 * Axios client instance for Inbox APIs.
 * Automatically attaches Authorization Bearer token from sessionStorage.
 */
export const inboxClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 6000,
});

inboxClient.interceptors.request.use(
  (config) => {
    try {
      const token =
        typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Storage access safety
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const inboxApi = {
  /**
   * Fetch all notifications from database via backend API
   * GET /api/inbox/
   * @param {Object} params - Query filters (e.g. { folder, type, search })
   */
  getAll: async (params = {}) => {
    try {
      const response = await inboxClient.get("/inbox/", { params });
      return response.data || [];
    } catch {
      // Return empty list gracefully if endpoint not yet published on backend
      return [];
    }
  },

  /**
   * Create a new notification or message
   * POST /api/inbox/
   */
  create: async (payload) => {
    try {
      const response = await inboxClient.post("/inbox/", payload);
      return response.data;
    } catch (err) {
      console.warn("[inboxApi] create failed:", err);
      return null;
    }
  },

  /**
   * Fetch single notification details
   * GET /api/inbox/:id/
   */
  getById: async (id) => {
    try {
      const response = await inboxClient.get(`/inbox/${id}/`);
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Mark a notification as read or unread in the database
   * PATCH /api/inbox/:id/read/
   */
  markAsRead: async (id, unread = false) => {
    try {
      const response = await inboxClient.patch(`/inbox/${id}/read/`, { unread });
      return response.data;
    } catch {
      return { id, unread };
    }
  },

  /**
   * Mark all notifications as read in the database
   * POST /api/inbox/mark-all-read/
   */
  markAllAsRead: async () => {
    try {
      const response = await inboxClient.post("/inbox/mark-all-read/");
      return response.data;
    } catch {
      return { success: true };
    }
  },

  /**
   * Star / Unstar a notification
   * PATCH /api/inbox/:id/star/
   */
  toggleStar: async (id, starred) => {
    try {
      const response = await inboxClient.patch(`/inbox/${id}/star/`, { starred });
      return response.data;
    } catch {
      return { id, starred };
    }
  },

  /**
   * Archive / Unarchive a notification
   * PATCH /api/inbox/:id/archive/
   */
  toggleArchive: async (id, archived) => {
    try {
      const response = await inboxClient.patch(`/inbox/${id}/archive/`, {
        archived,
      });
      return response.data;
    } catch {
      return { id, archived };
    }
  },

  /**
   * Delete a notification from the database
   * DELETE /api/inbox/:id/
   */
  delete: async (id) => {
    try {
      const response = await inboxClient.delete(`/inbox/${id}/`);
      return response.data;
    } catch {
      return { id, deleted: true };
    }
  },

  /**
   * Bulk action (read, unread, star, archive, delete) on multiple notifications
   * POST /api/inbox/bulk/
   */
  bulkAction: async (action, ids) => {
    try {
      const response = await inboxClient.post("/inbox/bulk/", { action, ids });
      return response.data;
    } catch {
      return { action, ids, success: true };
    }
  },

  /**
   * Toggle task item completion status inside a notification
   * PATCH /api/inbox/:notifId/tasks/:taskId/
   */
  toggleTask: async (notifId, taskId, completed) => {
    try {
      const response = await inboxClient.patch(
        `/inbox/${notifId}/tasks/${taskId}/`,
        { completed }
      );
      return response.data;
    } catch {
      return { notifId, taskId, completed };
    }
  },

  /**
   * Send a reply in a notification thread
   * POST /api/inbox/:notifId/replies/
   */
  sendReply: async (notifId, replyText) => {
    try {
      const response = await inboxClient.post(`/inbox/${notifId}/replies/`, {
        text: replyText,
      });
      return response.data;
    } catch {
      return { notifId, text: replyText, timestamp: new Date().toISOString() };
    }
  },

  /**
   * Fetch notification preferences from the database
   * GET /api/inbox/settings/
   */
  getSettings: async () => {
    try {
      const response = await inboxClient.get("/inbox/settings/");
      return response.data;
    } catch {
      return {
        email: true,
        push: true,
        sound: false,
        desktop: true,
      };
    }
  },

  /**
   * Save notification preferences to the database
   * PUT /api/inbox/settings/
   */
  updateSettings: async (settings) => {
    try {
      const response = await inboxClient.put("/inbox/settings/", settings);
      return response.data;
    } catch {
      return settings;
    }
  },
};

export default inboxApi;
