import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

export const projectsClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 8000,
});

projectsClient.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("token") || localStorage.getItem("token")
      : null;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const fetchProjects = async (params = {}) => {
  const response = await projectsClient.get("/projects/", { params });
  if (!Array.isArray(response.data)) {
    throw new Error("The project response did not contain a list.");
  }
  return response.data;
};

export const fetchProject = async (projectId) => {
  const response = await projectsClient.get(`/projects/${projectId}/`);
  return response.data;
};

export const fetchProjectStats = async () => {
  const response = await projectsClient.get("/projects/stats/");
  return response.data;
};

export const createProject = async (projectData) => {
  const response = await projectsClient.post("/projects/", projectData);
  return response.data;
};

export const updateProject = async (projectId, updates) => {
  const response = await projectsClient.patch(`/projects/${projectId}/`, updates);
  return response.data;
};

export const deleteProject = async (projectId) => {
  await projectsClient.delete(`/projects/${projectId}/`);
  return true;
};

export const setActiveWorkspaceProject = async (projectId) => {
  const response = await projectsClient.post(`/projects/${projectId}/set_active/`);
  return response.data;
};
