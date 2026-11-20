import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

export const goalsClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 8000,
});

goalsClient.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("token") || localStorage.getItem("token")
      : null;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const normalizeOwner = (owner) => {
  if (!owner) return null;
  if (typeof owner === "object") {
    const name =
      owner.name || owner.username || owner.email || owner.id || owner.userId || owner.user_id;
    if (!name) return null;
    const displayName = String(name);
    return {
      name: displayName,
      initials: owner.initials || displayName.slice(0, 2).toUpperCase(),
      role: owner.role || "",
      ...(owner.email ? { email: owner.email } : {}),
      ...(owner.id != null ? { id: owner.id } : {}),
      ...(owner.username ? { username: owner.username } : {}),
      ...(owner.userId != null ? { userId: owner.userId } : {}),
      ...(owner.user_id != null ? { user_id: owner.user_id } : {}),
    };
  }
  if (typeof owner === "string") {
    return { name: owner, initials: owner.slice(0, 2).toUpperCase(), role: "" };
  }
  return null;
};

export const normalizeGoal = (raw) => {
  if (!raw) return null;
  const id = String(raw.id || raw._id || raw.pk || "");
  const timePeriod = raw.timePeriod || raw.time_period || "";
  const team = raw.team || raw.accountable_team || "";
  const status = raw.status || "";
  const progress = Math.min(100, Math.max(0, Number(raw.progress) || 0));
  const dueDate = raw.dueDate || raw.due_date || "";
  const statusSummary = raw.statusSummary || raw.status_summary || "";
  return {
    ...raw,
    id,
    name: raw.name || "",
    status,
    progress,
    timePeriod,
    time_period: timePeriod,
    team,
    accountable_team: team,
    owner: normalizeOwner(raw.owner),
    dueDate,
    due_date: dueDate,
    statusSummary,
    status_summary: statusSummary,
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    parent: raw.parent || null,
  };
};

const listFrom = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

export const goalsApi = {
  async getGoals(params = {}) {
    const response = await goalsClient.get("/goals/", { params });
    return listFrom(response.data).map(normalizeGoal).filter(Boolean);
  },

  async createGoal(goalData) {
    const team = goalData.team || goalData.accountable_team || "";
    const timePeriod = goalData.timePeriod || goalData.time_period || "";
    const dueDate = goalData.dueDate || goalData.due_date || "";
    const statusSummary = goalData.statusSummary || goalData.status_summary || "";
    const response = await goalsClient.post("/goals/", {
      ...goalData,
      team,
      accountable_team: team,
      timePeriod,
      time_period: timePeriod,
      dueDate,
      due_date: dueDate,
      statusSummary,
      status_summary: statusSummary,
      comments: Array.isArray(goalData.comments) ? goalData.comments : [],
    });
    return normalizeGoal(response.data);
  },

  async updateGoal(id, goalData) {
    const team = goalData.team || goalData.accountable_team || "";
    const timePeriod = goalData.timePeriod || goalData.time_period || "";
    const dueDate = goalData.dueDate || goalData.due_date || "";
    const statusSummary = goalData.statusSummary || goalData.status_summary || "";
    const response = await goalsClient.patch(`/goals/${id}/`, {
      ...goalData,
      team,
      accountable_team: team,
      timePeriod,
      time_period: timePeriod,
      dueDate,
      due_date: dueDate,
      statusSummary,
      status_summary: statusSummary,
    });
    return normalizeGoal(response.data);
  },

  async deleteGoal(id) {
    await goalsClient.delete(`/goals/${id}/`);
    return true;
  },

  async getStrategyMap() {
    const response = await goalsClient.get("/strategy-map/");
    return response.data;
  },

  async createPillar(pillarData) {
    const response = await goalsClient.post("/strategy-map/", pillarData);
    return response.data;
  },

  async getTeamGoals() {
    const response = await goalsClient.get("/team-goals/");
    return response.data;
  },

  async createTeamGoal(goalData) {
    const response = await goalsClient.post("/team-goals/", goalData);
    return response.data;
  },

  async updateTeamGoal(id, goalData) {
    const response = await goalsClient.patch(
      `/team-goals/${encodeURIComponent(id)}/`,
      goalData
    );
    return response.data;
  },
};
