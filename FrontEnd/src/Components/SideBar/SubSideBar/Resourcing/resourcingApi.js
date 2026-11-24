import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

export const RESOURCING_CHARTS_KEY = "nexus_resourcing_charts";
export const RESOURCING_PROJECTS_KEY = "nexus_resourcing_projects";

export const getTodayDate = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (Number(value.slice(0, 4)) < 1) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const validateProjectDates = (startDate, endDate, required = true) => {
  const errors = {};
  const today = getTodayDate();
  const validStartDate = isValidDate(startDate);
  const validEndDate = isValidDate(endDate);

  if (!startDate) {
    if (required) errors.start_date = "Start date is required.";
  } else if (!validStartDate) {
    errors.start_date = "Enter a valid start date.";
  } else if (startDate < today) {
    errors.start_date = "Start date cannot be earlier than today.";
  }

  if (!endDate) {
    if (required) errors.end_date = "End date is required.";
  } else if (!validEndDate) {
    errors.end_date = "Enter a valid end date.";
  } else if (validStartDate && endDate < startDate) {
    errors.end_date = "End date must be on or after the start date.";
  }

  return errors;
};

export const resourcingClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 8000,
});

resourcingClient.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("token") || localStorage.getItem("token")
      : null;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const normalizeProject = (raw) => {
  if (!raw) return null;
  return {
    ...raw,
    id: String(raw.id || raw._id || ""),
    name: raw.name || "",
    start_date: raw.start_date || "",
    end_date: raw.end_date || "",
    allocations: Array.isArray(raw.allocations) ? raw.allocations : [],
  };
};

export const getStoredCharts = () => {
  try {
    const raw = localStorage.getItem(RESOURCING_CHARTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn("[resourcingApi] Failed to read cached chart preferences:", error);
  }
  return [];
};

export const getSavedCharts = getStoredCharts;

export const saveStoredCharts = (charts) => {
  try {
    localStorage.setItem(RESOURCING_CHARTS_KEY, JSON.stringify(charts));
  } catch (error) {
    console.warn("[resourcingApi] Failed to save chart preferences:", error);
  }
};

const responseList = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

export const resourcingApi = {
  async getProjects() {
    const response = await resourcingClient.get("/resourcing/projects/");
    return responseList(response.data).map(normalizeProject).filter(Boolean);
  },

  async createProject(projectData) {
    const payload = {
      name: projectData.name,
      start_date: projectData.start_date || projectData.startDate,
      end_date: projectData.end_date || projectData.endDate,
    };
    const dateErrors = validateProjectDates(payload.start_date, payload.end_date);
    if (Object.keys(dateErrors).length > 0) {
      const error = new Error("Please correct the project dates.");
      error.fieldErrors = dateErrors;
      throw error;
    }
    const response = await resourcingClient.post("/resourcing/projects/", payload);
    return normalizeProject(response.data);
  },

  async updateProject(id, projectData) {
    const payload = {
      name: projectData.name,
      start_date: projectData.start_date || projectData.startDate,
      end_date: projectData.end_date || projectData.endDate,
    };
    const response = await resourcingClient.put(`/resourcing/projects/${id}/`, payload);
    return normalizeProject(response.data);
  },

  async deleteProject(id) {
    await resourcingClient.delete(`/resourcing/projects/${id}/`);
    return true;
  },

  async getCapacity(params = {}) {
    const response = await resourcingClient.get("/resourcing/capacity/", { params });
    return responseList(response.data).map(normalizeProject).filter(Boolean);
  },

  async getAllocations() {
    const response = await resourcingClient.get("/resourcing/allocations/");
    return responseList(response.data);
  },

  async createAllocation(allocationData) {
    const response = await resourcingClient.post("/resourcing/allocations/", allocationData);
    return response.data;
  },

  async deleteAllocation(id) {
    await resourcingClient.delete(`/resourcing/allocations/${id}/`);
    return true;
  },

  getSavedCharts,
  saveStoredCharts,
};
