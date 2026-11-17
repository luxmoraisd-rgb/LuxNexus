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
  async getOptions() {
    const response = await client.get("/reporting/eod-options/");
    return response.data;
  },
  async createReport(report) {
    const response = await client.post("/reporting/eod-reports/", report);
    return response.data;
  },
  async addSampleReports() {
    const response = await client.post("/reporting/eod-reports/sample-data/");
    return response.data;
  },
  async updateReport(id, changes) {
    const response = await client.patch(`/reporting/eod-reports/${encodeURIComponent(id)}/`, changes);
    return response.data;
  },
  async deleteReport(id) {
    await client.delete(`/reporting/eod-reports/${encodeURIComponent(id)}/`);
  },
  async importReports(rows) {
    const response = await client.post("/reporting/eod-reports/import/", { rows });
    return response.data;
  },
  async previewSpreadsheet(file) {
    const form = new FormData();
    form.append("file", file);
    const response = await client.post("/reporting/eod-reports/preview-import/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
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
