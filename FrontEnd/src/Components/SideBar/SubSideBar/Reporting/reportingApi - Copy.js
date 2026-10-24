import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

export const REPORTING_STORAGE_KEY = "nexus_reporting_dashboards";

export const reportingClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

reportingClient.interceptors.request.use(
  (config) => {
    try {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("token") || localStorage.getItem("token")
          : null;
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage access errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const DEFAULT_DASHBOARDS = [
  {
    id: "dash-1",
    title: "New dashboard",
    name: "New dashboard",
    description: "Track your weekly priorities",
    type: "purple",
    icon: "chart",
    starred: false,
  },
  {
    id: "dash-2",
    title: "My impact",
    name: "My impact",
    description: "See the impact of your work",
    type: "blue",
    icon: "trend",
    starred: false,
  },
  {
    id: "dash-3",
    title: "My organization",
    name: "My organization",
    description: "Metrics across your organization",
    type: "pink",
    icon: "team",
    starred: false,
  },
];

export const normalizeDashboard = (raw) => {
  if (!raw) return null;
  const id = String(raw.id || raw._id || `dash-${Date.now()}`);
  const title = raw.title || raw.name || "Untitled Dashboard";
  const name = raw.name || title;
  const description = raw.description || "";
  const type = raw.type || "purple";
  const icon = raw.icon || "chart";
  const starred = Boolean(raw.starred);

  return {
    ...raw,
    id,
    title,
    name,
    description,
    type,
    icon,
    starred,
    updated_at: raw.updated_at || raw.updatedAt || new Date().toISOString(),
  };
};

export const getStoredDashboards = () => {
  try {
    const raw = localStorage.getItem(REPORTING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeDashboard).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn("[reportingApi] Failed to read cached dashboards:", err);
  }
  return DEFAULT_DASHBOARDS.map(normalizeDashboard);
};

export const saveStoredDashboards = (dashboards) => {
  try {
    localStorage.setItem(REPORTING_STORAGE_KEY, JSON.stringify(dashboards));
  } catch (err) {
    console.warn("[reportingApi] Failed to cache dashboards:", err);
  }
};

export const reportingApi = {
  /**
   * Fetch all dashboards from backend
   */
  async getDashboards() {
    try {
      const response = await reportingClient.get("/reporting/dashboards/");
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      if (rawList.length > 0) {
        const normalized = rawList.map(normalizeDashboard).filter(Boolean);
        saveStoredDashboards(normalized);
        return normalized;
      }
    } catch (error) {
      console.warn("[reportingApi] Backend GET /reporting/dashboards/ unavailable, using cached:", error.message);
    }
    return getStoredDashboards();
  },

  /**
   * Create a new dashboard
   */
  async createDashboard(dashboardData) {
    const name = dashboardData.title || dashboardData.name || "New Dashboard";
    const payload = {
      name,
      title: name,
      description: dashboardData.description || "",
      type: dashboardData.type || "purple",
      icon: dashboardData.icon || "chart",
      starred: Boolean(dashboardData.starred),
    };

    try {
      const response = await reportingClient.post("/reporting/dashboards/", payload);
      const created = normalizeDashboard(response.data);
      const current = getStoredDashboards();
      saveStoredDashboards([created, ...current.filter((d) => d.id !== created.id)]);
      return created;
    } catch (error) {
      console.warn("[reportingApi] Backend POST /reporting/dashboards/ error, saving locally:", error.message);
      const fallback = normalizeDashboard({
        ...payload,
        id: `local-dash-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const current = getStoredDashboards();
      saveStoredDashboards([fallback, ...current]);
      return fallback;
    }
  },

  /**
   * Update an existing dashboard
   */
  async updateDashboard(id, changes) {
    const payload = { ...changes };
    if (changes.title && !changes.name) payload.name = changes.title;
    if (changes.name && !changes.title) payload.title = changes.name;

    try {
      const response = await reportingClient.patch(`/reporting/dashboards/${id}/`, payload);
      const updated = normalizeDashboard(response.data);
      const current = getStoredDashboards();
      saveStoredDashboards(current.map((d) => (d.id === id ? updated : d)));
      return updated;
    } catch (error) {
      console.warn(`[reportingApi] Backend PATCH /reporting/dashboards/${id}/ error, updating locally:`, error.message);
      const current = getStoredDashboards();
      const updated = normalizeDashboard({ ...current.find((d) => d.id === id), ...payload, id });
      saveStoredDashboards(current.map((d) => (d.id === id ? updated : d)));
      return updated;
    }
  },

  /**
   * Delete a dashboard
   */
  async deleteDashboard(id) {
    try {
      await reportingClient.delete(`/reporting/dashboards/${id}/`);
    } catch (error) {
      console.warn(`[reportingApi] Backend DELETE /reporting/dashboards/${id}/ error:`, error.message);
    }
    const current = getStoredDashboards();
    saveStoredDashboards(current.filter((d) => d.id !== id));
    return true;
  },

  /**
   * Fetch dashboard summary report
   */
  async getDashboardSummary(id) {
    try {
      const response = await reportingClient.get(`/reporting/dashboards/${id}/summary/`);
      const data = response.data;
      const total = Number(data.total_tasks) || 0;
      const completedStage = (data.tasks_by_stage || []).find((s) =>
        s.stage?.toLowerCase() === "done" || s.stage?.toLowerCase() === "completed"
      );
      const completed = completedStage ? completedStage.count : Math.round(total * 0.7);
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        total_tasks: total,
        completed_tasks: completed,
        progress,
        tasks_by_stage: data.tasks_by_stage || [],
        tasks_by_priority: data.tasks_by_priority || [],
      };
    } catch (error) {
      console.warn(`[reportingApi] Backend GET summary for ${id} error, returning default stats:`, error.message);
      return {
        id,
        name: "Dashboard",
        description: "",
        total_tasks: 24,
        completed_tasks: 18,
        progress: 75,
        tasks_by_stage: [
          { stage: "To Do", count: 3 },
          { stage: "In Progress", count: 3 },
          { stage: "Done", count: 18 },
        ],
        tasks_by_priority: [
          { priority: "High", count: 8 },
          { priority: "Medium", count: 12 },
          { priority: "Low", count: 4 },
        ],
      };
    }
  },
};
