import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

export const RESOURCING_CHARTS_KEY = "nexus_resourcing_charts";
export const RESOURCING_PROJECTS_KEY = "nexus_resourcing_projects";

export const resourcingClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

resourcingClient.interceptors.request.use(
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

export const DEFAULT_CHARTS = [
  {
    id: "incomplete-tasks",
    title: "Incomplete tasks by project",
    type: "bar",
    colors: ["#08cfa3", "#19cfae", "#63e6be", "#5bd9c0"],
  },
  {
    id: "projects-status",
    title: "Projects by status",
    type: "donut",
    colors: ["#18d68c", "#ffcb05", "#ef476f"],
  },
];

export const DEFAULT_PROJECTS = [
  {
    id: "proj-1",
    name: "Nexus Core Platform v2",
    start_date: "2026-01-01",
    end_date: "2026-06-30",
    allocations: [
      {
        id: "alloc-1",
        user: "u-1",
        user_details: { username: "Jagadeep", email: "jagadeep@nexusapp.io" },
        month: "2026-03-01",
        hours: "160.00",
      },
      {
        id: "alloc-2",
        user: "u-2",
        user_details: { username: "Sarah Chen", email: "sarah@nexusapp.io" },
        month: "2026-03-01",
        hours: "120.00",
      },
    ],
  },
  {
    id: "proj-2",
    name: "Mobile App Experience",
    start_date: "2026-02-15",
    end_date: "2026-08-31",
    allocations: [
      {
        id: "alloc-3",
        user: "u-3",
        user_details: { username: "Alex Rivera", email: "alex@nexusapp.io" },
        month: "2026-03-01",
        hours: "140.00",
      },
    ],
  },
  {
    id: "proj-3",
    name: "Enterprise Infrastructure Scale",
    start_date: "2026-03-01",
    end_date: "2026-11-30",
    allocations: [
      {
        id: "alloc-4",
        user: "u-4",
        user_details: { username: "Michael Chang", email: "michael@nexusapp.io" },
        month: "2026-03-01",
        hours: "150.00",
      },
    ],
  },
];

export const normalizeProject = (raw) => {
  if (!raw) return null;
  const id = String(raw.id || raw._id || `proj-${Date.now()}`);
  return {
    ...raw,
    id,
    name: raw.name || "Untitled Project",
    start_date: raw.start_date || new Date().toISOString().split("T")[0],
    end_date: raw.end_date || new Date().toISOString().split("T")[0],
    allocations: Array.isArray(raw.allocations) ? raw.allocations : [],
  };
};

export const getStoredCharts = () => {
  try {
    const raw = localStorage.getItem(RESOURCING_CHARTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[resourcingApi] Failed to read cached charts:", err);
  }
  return DEFAULT_CHARTS;
};

export const getSavedCharts = getStoredCharts;

export const saveStoredCharts = (charts) => {
  try {
    localStorage.setItem(RESOURCING_CHARTS_KEY, JSON.stringify(charts));
  } catch (err) {
    console.warn("[resourcingApi] Failed to cache charts:", err);
  }
};

export const getStoredProjects = () => {
  try {
    const raw = localStorage.getItem(RESOURCING_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeProject).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn("[resourcingApi] Failed to read cached projects:", err);
  }
  return DEFAULT_PROJECTS.map(normalizeProject);
};

export const saveStoredProjects = (projects) => {
  try {
    localStorage.setItem(RESOURCING_PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn("[resourcingApi] Failed to cache projects:", err);
  }
};

export const resourcingApi = {
  /**
   * Fetch all resourcing projects
   */
  async getProjects() {
    try {
      const response = await resourcingClient.get("/resourcing/projects/");
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      if (rawList.length > 0) {
        const normalized = rawList.map(normalizeProject).filter(Boolean);
        saveStoredProjects(normalized);
        return normalized;
      }
    } catch (error) {
      console.warn("[resourcingApi] Backend GET /resourcing/projects/ error:", error.message);
    }
    return getStoredProjects();
  },

  /**
   * Create a new project
   */
  async createProject(projectData) {
    const payload = {
      name: projectData.name,
      start_date: projectData.start_date || projectData.startDate,
      end_date: projectData.end_date || projectData.endDate,
    };

    try {
      const response = await resourcingClient.post("/resourcing/projects/", payload);
      const created = normalizeProject(response.data);
      const current = getStoredProjects();
      saveStoredProjects([created, ...current.filter((p) => p.id !== created.id)]);
      return created;
    } catch (error) {
      console.warn("[resourcingApi] Backend POST /resourcing/projects/ error, saving locally:", error.message);
      const fallback = normalizeProject({
        ...payload,
        id: `local-proj-${Date.now()}`,
        allocations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const current = getStoredProjects();
      saveStoredProjects([fallback, ...current]);
      return fallback;
    }
  },

  /**
   * Update a project
   */
  async updateProject(id, projectData) {
    const payload = {
      name: projectData.name,
      start_date: projectData.start_date || projectData.startDate,
      end_date: projectData.end_date || projectData.endDate,
    };

    try {
      const response = await resourcingClient.put(`/resourcing/projects/${id}/`, payload);
      const updated = normalizeProject(response.data);
      const current = getStoredProjects();
      saveStoredProjects(current.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (error) {
      console.warn(`[resourcingApi] Backend PUT /resourcing/projects/${id}/ error, saving locally:`, error.message);
      const current = getStoredProjects();
      const updated = normalizeProject({ ...current.find((p) => p.id === id), ...payload, id });
      saveStoredProjects(current.map((p) => (p.id === id ? updated : p)));
      return updated;
    }
  },

  /**
   * Delete a project
   */
  async deleteProject(id) {
    try {
      await resourcingClient.delete(`/resourcing/projects/${id}/`);
    } catch (error) {
      console.warn(`[resourcingApi] Backend DELETE /resourcing/projects/${id}/ error:`, error.message);
    }
    const current = getStoredProjects();
    saveStoredProjects(current.filter((p) => p.id !== id));
    return true;
  },

  /**
   * Fetch capacity planning projects with allocations
   */
  async getCapacity(params = {}) {
    try {
      const response = await resourcingClient.get("/resourcing/capacity/", { params });
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      if (rawList.length > 0) {
        return rawList.map(normalizeProject).filter(Boolean);
      }
    } catch (error) {
      console.warn("[resourcingApi] Backend GET /resourcing/capacity/ error:", error.message);
    }
    return getStoredProjects();
  },

  /**
   * Fetch all resource allocations
   */
  async getAllocations() {
    try {
      const response = await resourcingClient.get("/resourcing/allocations/");
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn("[resourcingApi] Backend GET /resourcing/allocations/ error:", error.message);
      return [];
    }
  },

  /**
   * Create an allocation
   */
  async createAllocation(allocationData) {
    try {
      const response = await resourcingClient.post("/resourcing/allocations/", allocationData);
      return response.data;
    } catch (error) {
      console.warn("[resourcingApi] Backend POST /resourcing/allocations/ error:", error.message);
      return {
        id: `local-alloc-${Date.now()}`,
        ...allocationData,
      };
    }
  },

  /**
   * Delete an allocation
   */
  async deleteAllocation(id) {
    try {
      await resourcingClient.delete(`/resourcing/allocations/${id}/`);
      return true;
    } catch (error) {
      console.warn(`[resourcingApi] Backend DELETE allocation ${id} error:`, error.message);
      return false;
    }
  },

  /**
   * Chart preferences
   */
  getSavedCharts,
  saveStoredCharts,
};
