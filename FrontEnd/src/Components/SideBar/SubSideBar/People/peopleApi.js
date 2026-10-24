import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

export const peopleClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

peopleClient.interceptors.request.use(
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

export const peopleApi = {
  getMembers: async (params = {}) => {
    try {
      const response = await peopleClient.get("/people/", { params });
      return response.data || [];
    } catch (err) {
      console.warn("[PeopleApi] Error fetching members:", err);
      return [];
    }
  },

  getMember: async (userId) => {
    const response = await peopleClient.get(`/people/${userId}/`);
    return response.data;
  },

  createMember: async (payload) => {
    const response = await peopleClient.post("/people/", payload);
    return response.data;
  },

  updateMember: async (userId, payload) => {
    const response = await peopleClient.patch(`/people/${userId}/`, payload);
    return response.data;
  },

  deleteMember: async (userId) => {
    const response = await peopleClient.delete(`/people/${userId}/`);
    return response.data;
  },

  getTeams: async () => {
    try {
      const response = await peopleClient.get("/people/teams/");
      return response.data || [];
    } catch (err) {
      console.warn("[PeopleApi] Error fetching teams:", err);
      return [];
    }
  },

  createTeam: async (payload) => {
    const response = await peopleClient.post("/people/teams/", payload);
    return response.data;
  },

  deleteTeam: async (teamId) => {
    const response = await peopleClient.delete(`/people/teams/${teamId}/`);
    return response.data;
  },

  getInvitations: async () => {
    try {
      const response = await peopleClient.get("/people/invitations/");
      return response.data || [];
    } catch (err) {
      console.warn("[PeopleApi] Error fetching invitations:", err);
      return [];
    }
  },

  sendInvitation: async (payload) => {
    const response = await peopleClient.post("/people/invitations/", payload);
    return response.data;
  },

  revokeInvitation: async (email) => {
    const response = await peopleClient.delete(
      `/people/invitations/${encodeURIComponent(email)}/`
    );
    return response.data;
  },

  getStats: async () => {
    try {
      const response = await peopleClient.get("/people/stats/");
      return (
        response.data || {
          totalMembers: 4,
          activeNow: 4,
          totalTeams: 4,
          pendingInvitations: 0,
        }
      );
    } catch {
      return {
        totalMembers: 4,
        activeNow: 4,
        totalTeams: 4,
        pendingInvitations: 0,
      };
    }
  },
};

export default peopleApi;
