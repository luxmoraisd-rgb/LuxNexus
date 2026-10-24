import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

export const PROJECTS_CACHE_KEY = "nexus_workspace_projects";

export const projectsClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

projectsClient.interceptors.request.use(
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
      // Ignore storage errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getCachedProjects = () => {
  try {
    const raw = localStorage.getItem(PROJECTS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("Unable to read cached projects:", err);
  }
  return [];
};

export const setCachedProjects = (projects) => {
  try {
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn("Unable to cache projects:", err);
  }
};

export const fetchProjects = async (params = {}) => {
  try {
    const response = await projectsClient.get("/projects/", { params });
    if (Array.isArray(response.data)) {
      setCachedProjects(response.data);
      return response.data;
    }
  } catch (error) {
    console.warn("Projects API fetch failed, falling back to cache:", error?.message);
    const cached = getCachedProjects();
    if (cached.length > 0) return cached;
  }
  return [];
};

export const fetchProjectStats = async () => {
  try {
    const response = await projectsClient.get("/projects/stats/");
    return response.data;
  } catch (error) {
    console.warn("Projects stats fetch failed:", error?.message);
    return null;
  }
};

export const createProject = async (projectData) => {
  try {
    const response = await projectsClient.post("/projects/", projectData);
    const newProj = response.data;
    const current = getCachedProjects();
    setCachedProjects([newProj, ...current.filter((p) => p.id !== newProj.id)]);
    return newProj;
  } catch (error) {
    console.error("Create project API error:", error?.response?.data || error?.message);
    // Optimistic fallback
    const offlineProject = {
      ...projectData,
      id: "proj-" + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const current = getCachedProjects();
    setCachedProjects([offlineProject, ...current]);
    return offlineProject;
  }
};

export const updateProject = async (projectId, updates) => {
  try {
    const response = await projectsClient.patch(`/projects/${projectId}/`, updates);
    const updated = response.data;
    const current = getCachedProjects();
    setCachedProjects(current.map((p) => (p.id === projectId ? { ...p, ...updated } : p)));
    return updated;
  } catch (error) {
    console.error("Update project API error:", error?.message);
    const current = getCachedProjects();
    const local = current.map((p) => (p.id === projectId ? { ...p, ...updates } : p));
    setCachedProjects(local);
    return updates;
  }
};

export const deleteProject = async (projectId) => {
  try {
    await projectsClient.delete(`/projects/${projectId}/`);
  } catch (error) {
    console.warn("Delete project API error:", error?.message);
  }
  const current = getCachedProjects();
  setCachedProjects(current.filter((p) => p.id !== projectId));
  return true;
};

export const setActiveWorkspaceProject = async (projectId) => {
  try {
    const response = await projectsClient.post(`/projects/${projectId}/set_active/`);
    const updated = response.data;
    const current = getCachedProjects();
    setCachedProjects(
      current.map((p) => ({
        ...p,
        is_default_workspace: p.id === projectId,
        isDefaultWorkspace: p.id === projectId,
      }))
    );
    return updated;
  } catch (error) {
    console.warn("Set active workspace API error:", error?.message);
    const current = getCachedProjects();
    setCachedProjects(
      current.map((p) => ({
        ...p,
        is_default_workspace: p.id === projectId,
        isDefaultWorkspace: p.id === projectId,
      }))
    );
    return { id: projectId, is_default_workspace: true };
  }
};
