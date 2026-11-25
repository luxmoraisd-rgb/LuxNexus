import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  timeout: 8000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const portfoliosApi = {
  async getPortfolios(params = {}) {
    const response = await client.get("/portfolios/", { params });
    return response.data;
  },

  async createPortfolio(payload) {
    const response = await client.post("/portfolios/", payload);
    return response.data;
  },

  async updatePortfolio(id, payload) {
    const response = await client.put(`/portfolios/${id}/`, payload);
    return response.data;
  },

  async deletePortfolio(id) {
    await client.delete(`/portfolios/${id}/`);
    return true;
  },
};
