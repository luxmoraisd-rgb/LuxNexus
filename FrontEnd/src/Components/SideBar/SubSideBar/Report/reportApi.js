import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const reportApi = {
  async getReports(params, signal) {
    const response = await client.get("/reporting/eod-reports/", { params, signal });
    return response.data;
  },
  async exportReport(params) {
    const response = await client.get("/reporting/eod-reports/export/", {
      params,
      responseType: "blob",
    });
    const disposition = response.headers["content-disposition"] || "";
    const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || "report.docx";
    return { blob: response.data, filename };
  },
  async getOptions(projectId) {
    const response = await client.get("/reporting/eod-options/", {
      params: projectId ? { project_id: projectId } : undefined,
    });
    return response.data;
  },
  async createReport(report) {
    const response = await client.post("/reporting/eod-reports/", report);
    return response.data;
  },
  async updateReport(id, changes) {
    const response = await client.patch(`/reporting/eod-reports/${encodeURIComponent(id)}/`, changes);
    return response.data;
  },
  async deleteReport(id) {
    await client.delete(`/reporting/eod-reports/${encodeURIComponent(id)}/`);
  },
};

export const getApiError = (error) => {
  const data = error?.response?.data;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : String(messages)}`)
      .join("; ");
  }
  return error?.message || "The report request failed.";
};
