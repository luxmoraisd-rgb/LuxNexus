import axios from "axios";
import { API_BASE_URL } from "../MyTasks/Backlog/backlogApi";

export const GOALS_STORAGE_KEY = "nexus_goals_data";

export const goalsClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

goalsClient.interceptors.request.use(
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

export const DEFAULT_GOALS = [
  {
    id: "g-1",
    name: "Enhance Product Quality & Platform Reliability",
    status: "on track",
    progress: 75,
    timePeriod: "Q1 FY26",
    team: "Engineering",
    owner: { name: "Jagadeep", initials: "Ja", role: "Developer" },
    dueDate: "Mar 31, 2026",
    statusSummary: "Core features implemented and automated test coverage reached 85%.",
    comments: [
      {
        id: "c-1",
        author: "Sarah Chen",
        authorInitials: "SC",
        text: "Great progress on the sprint goal deliverables!",
        createdAt: "2 days ago",
      },
    ],
  },
  {
    id: "g-2",
    name: "Scale System Architecture to 100k DAU",
    status: "at risk",
    progress: 40,
    timePeriod: "Q2 FY26",
    team: "Engineering",
    owner: { name: "Sarah Chen", initials: "SC", role: "Engineering Lead" },
    dueDate: "Jun 30, 2026",
    statusSummary: "Database query optimization is lagging slightly behind schedule.",
    comments: [],
  },
  {
    id: "g-3",
    name: "Redesign User Onboarding & First-Run Experience",
    status: "on track",
    progress: 85,
    timePeriod: "Q1 FY26",
    team: "Design",
    owner: { name: "Alex Rivera", initials: "AR", role: "Design Lead" },
    dueDate: "Apr 15, 2026",
    statusSummary: "Figma design system approved; frontend implementation underway.",
    comments: [],
  },
  {
    id: "g-4",
    name: "Achieve SOC-2 Type II Compliance",
    status: "off track",
    progress: 20,
    timePeriod: "Q3 FY26",
    team: "Operations",
    owner: { name: "Michael Chang", initials: "MC", role: "Operations" },
    dueDate: "Sep 30, 2026",
    statusSummary: "Pending external audit vendor confirmation.",
    comments: [],
  },
  {
    id: "g-5",
    name: "Increase Enterprise Customer Retention by 15%",
    status: "achieved",
    progress: 100,
    timePeriod: "Full Year 2026",
    team: "Product",
    owner: { name: "Sarah Chen", initials: "SC", role: "Engineering Lead" },
    dueDate: "Dec 31, 2026",
    statusSummary: "Target achieved ahead of schedule with key account renewals.",
    comments: [],
  },
];

export const normalizeOwner = (owner) => {
  if (!owner) return null;
  if (typeof owner === "object" && owner.name) {
    return {
      name: owner.name,
      initials: owner.initials || owner.name.slice(0, 2).toUpperCase(),
      role: owner.role || "Team Member",
    };
  }
  if (typeof owner === "string") {
    return {
      name: owner,
      initials: owner.slice(0, 2).toUpperCase(),
      role: "Team Member",
    };
  }
  return null;
};

export const normalizeGoal = (raw) => {
  if (!raw) return null;
  const id = String(raw.id || raw._id || raw.pk || `goal-${Date.now()}`);
  const timePeriod = raw.timePeriod || raw.time_period || "";
  const team = raw.team || raw.accountable_team || "";
  const status = raw.status || "on track";
  const progress = Math.min(100, Math.max(0, Number(raw.progress) || 0));
  const dueDate = raw.dueDate || raw.due_date || "";
  const statusSummary = raw.statusSummary || raw.status_summary || "";
  const comments = Array.isArray(raw.comments) ? raw.comments : [];
  const owner = normalizeOwner(raw.owner);

  return {
    ...raw,
    id,
    name: raw.name || "Untitled goal",
    status,
    progress,
    timePeriod,
    time_period: timePeriod,
    team,
    accountable_team: team,
    owner,
    dueDate,
    due_date: dueDate,
    statusSummary,
    status_summary: statusSummary,
    comments,
    parent: raw.parent || null,
  };
};

export const getStoredGoals = () => {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeGoal).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn("[goalsApi] Failed to read cached goals:", err);
  }
  return DEFAULT_GOALS.map(normalizeGoal);
};

export const saveStoredGoals = (goals) => {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch (err) {
    console.warn("[goalsApi] Failed to cache goals:", err);
  }
};

export const goalsApi = {
  /**
   * Fetch goals list from backend with optional filters and sorting
   */
  async getGoals(params = {}) {
    try {
      const response = await goalsClient.get("/goals/", { params });
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      if (rawList.length > 0) {
        const normalized = rawList.map(normalizeGoal).filter(Boolean);
        saveStoredGoals(normalized);
        return normalized;
      }
    } catch (error) {
      console.warn("[goalsApi] Backend GET /goals/ unavailable, using cached goals:", error.message);
    }
    return getStoredGoals();
  },

  /**
   * Create a new goal
   */
  async createGoal(goalData) {
    const payload = {
      name: goalData.name,
      status: goalData.status || "on track",
      progress: Number(goalData.progress) || 0,
      accountable_team: goalData.team || goalData.accountable_team || "",
      team: goalData.team || goalData.accountable_team || "",
      time_period: goalData.timePeriod || goalData.time_period || "",
      timePeriod: goalData.timePeriod || goalData.time_period || "",
      owner: goalData.owner || null,
      due_date: goalData.dueDate || goalData.due_date || "",
      dueDate: goalData.dueDate || goalData.due_date || "",
      status_summary: goalData.statusSummary || goalData.status_summary || "",
      statusSummary: goalData.statusSummary || goalData.status_summary || "",
      comments: Array.isArray(goalData.comments) ? goalData.comments : [],
      privacy: goalData.privacy || "",
      parent: goalData.parent || null,
    };

    try {
      const response = await goalsClient.post("/goals/", payload);
      const created = normalizeGoal(response.data);
      const current = getStoredGoals();
      saveStoredGoals([created, ...current.filter((g) => g.id !== created.id)]);
      return created;
    } catch (error) {
      console.warn("[goalsApi] Backend POST /goals/ error, saving locally:", error.message);
      const fallbackGoal = normalizeGoal({
        ...payload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const current = getStoredGoals();
      saveStoredGoals([fallbackGoal, ...current]);
      return fallbackGoal;
    }
  },

  /**
   * Update an existing goal
   */
  async updateGoal(id, goalData) {
    const payload = {
      ...goalData,
      team: goalData.team || goalData.accountable_team || "",
      accountable_team: goalData.team || goalData.accountable_team || "",
      timePeriod: goalData.timePeriod || goalData.time_period || "",
      time_period: goalData.timePeriod || goalData.time_period || "",
      dueDate: goalData.dueDate || goalData.due_date || "",
      due_date: goalData.dueDate || goalData.due_date || "",
      statusSummary: goalData.statusSummary || goalData.status_summary || "",
      status_summary: goalData.statusSummary || goalData.status_summary || "",
    };

    try {
      const response = await goalsClient.patch(`/goals/${id}/`, payload);
      const updated = normalizeGoal(response.data);
      const current = getStoredGoals();
      saveStoredGoals(current.map((g) => (g.id === id ? updated : g)));
      return updated;
    } catch (error) {
      console.warn(`[goalsApi] Backend PATCH /goals/${id}/ error, saving locally:`, error.message);
      const current = getStoredGoals();
      const updated = normalizeGoal({ ...current.find((g) => g.id === id), ...payload, id });
      saveStoredGoals(current.map((g) => (g.id === id ? updated : g)));
      return updated;
    }
  },

  /**
   * Delete a goal
   */
  async deleteGoal(id) {
    try {
      await goalsClient.delete(`/goals/${id}/`);
    } catch (error) {
      console.warn(`[goalsApi] Backend DELETE /goals/${id}/ error:`, error.message);
    }
    const current = getStoredGoals();
    saveStoredGoals(current.filter((g) => g.id !== id));
    return true;
  },

  /**
   * Fetch Strategy Map pillars and alignment metrics
   */
  async getStrategyMap() {
    try {
      const response = await goalsClient.get("/strategy-map/");
      if (response.data && response.data.pillars) {
        localStorage.setItem("nexus_strategy_map_cache", JSON.stringify(response.data));
        return response.data;
      }
    } catch (error) {
      console.warn("[goalsApi] Backend GET /strategy-map/ unavailable, using fallback:", error.message);
    }

    try {
      const cached = localStorage.getItem("nexus_strategy_map_cache");
      if (cached) return JSON.parse(cached);
    } catch {}

    return {
      pillars: [
        {
          id: "pillar-1",
          title: "Product Experience & User Adoption",
          description: "Drive daily active engagement through friction-free workflows, refined UI, and instant collaboration.",
          color: "#6366f1",
          tag: "Product Excellence",
          targetPeriod: "Q1 - Q2 FY26",
          weight: 35,
          progress: 80,
          goals: [
            {
              id: "g-1",
              name: "Enhance Product Quality & Platform Reliability",
              status: "on track",
              progress: 75,
              team: "Engineering",
              owner: "Jagadeep",
              dueDate: "Mar 31, 2026",
            },
            {
              id: "g-3",
              name: "Redesign User Onboarding & First-Run Experience",
              status: "on track",
              progress: 85,
              team: "Design",
              owner: "Alex Rivera",
              dueDate: "Apr 15, 2026",
            },
          ],
        },
        {
          id: "pillar-2",
          title: "Architecture Scale & Enterprise Security",
          description: "Harden platform infrastructure, achieve SOC-2 Type II certification, and support 100k+ concurrent users.",
          color: "#10b981",
          tag: "Infrastructure",
          targetPeriod: "Q2 - Q3 FY26",
          weight: 25,
          progress: 30,
          goals: [
            {
              id: "g-2",
              name: "Scale System Architecture to 100k DAU",
              status: "at risk",
              progress: 40,
              team: "Engineering",
              owner: "Sarah Chen",
              dueDate: "Jun 30, 2026",
            },
            {
              id: "g-4",
              name: "Achieve SOC-2 Type II Compliance",
              status: "off track",
              progress: 20,
              team: "Operations",
              owner: "Michael Chang",
              dueDate: "Sep 30, 2026",
            },
          ],
        },
        {
          id: "pillar-3",
          title: "Customer Value & Enterprise Retention",
          description: "Deepen enterprise customer relationships, improve sprint delivery predictability, and reduce churn by 15%.",
          color: "#3b82f6",
          tag: "Customer Success",
          targetPeriod: "Full Year 2026",
          weight: 25,
          progress: 80,
          goals: [
            {
              id: "g-5",
              name: "Increase Enterprise Customer Retention by 15%",
              status: "achieved",
              progress: 100,
              team: "Product",
              owner: "Sarah Chen",
              dueDate: "Dec 31, 2026",
            },
            {
              id: "g-6",
              name: "Deploy Automated Customer Health Score Dashboard",
              status: "on track",
              progress: 60,
              team: "Product",
              owner: "Luxmor",
              dueDate: "Aug 31, 2026",
            },
          ],
        },
        {
          id: "pillar-4",
          title: "Engineering Velocity & Quality Assurance",
          description: "Establish continuous automated test pipelines, reduce cycle times, and eliminate regression bottlenecks.",
          color: "#f59e0b",
          tag: "Engineering Velocity",
          targetPeriod: "Q3 - Q4 FY26",
          weight: 15,
          progress: 75,
          goals: [
            {
              id: "g-7",
              name: "Reach 90% Automated End-to-End Test Coverage",
              status: "on track",
              progress: 70,
              team: "QA & Infrastructure",
              owner: "Jeeva",
              dueDate: "Oct 15, 2026",
            },
            {
              id: "g-8",
              name: "Reduce CI/CD Build and Deployment Latency under 5 mins",
              status: "on track",
              progress: 80,
              team: "Engineering",
              owner: "Franklin",
              dueDate: "Nov 30, 2026",
            },
          ],
        },
      ],
      metrics: {
        totalPillars: 4,
        totalGoals: 8,
        overallAlignment: 76,
        onTrackCount: 5,
        atRiskCount: 1,
        offTrackCount: 1,
      },
    };
  },

  /**
   * Create a new strategic pillar in Strategy Map
   */
  async createPillar(pillarData) {
    try {
      const response = await goalsClient.post("/strategy-map/", pillarData);
      return response.data;
    } catch (error) {
      console.warn("[goalsApi] Backend POST /strategy-map/ error, using local:", error.message);
      return {
        id: `pillar-${Date.now()}`,
        ...pillarData,
        goals: pillarData.goals || [],
      };
    }
  },

  /**
   * Fetch Team Goals and aggregated team OKRs
   */
  async getTeamGoals() {
    try {
      const response = await goalsClient.get("/team-goals/");
      if (response.data && response.data.teams) {
        localStorage.setItem("nexus_team_goals_cache", JSON.stringify(response.data));
        return response.data;
      }
    } catch (error) {
      console.warn("[goalsApi] Backend GET /team-goals/ unavailable, using fallback:", error.message);
    }

    try {
      const cached = localStorage.getItem("nexus_team_goals_cache");
      if (cached) return JSON.parse(cached);
    } catch {}

    return {
      teams: [
        {
          teamName: "Engineering",
          totalGoals: 4,
          completedGoals: 1,
          averageProgress: 68,
          health: "On Track",
          goals: [
            {
              id: "tg-1",
              name: "Deliver Automated CI/CD Pipeline & 85% Code Coverage",
              status: "on track",
              progress: 80,
              team: "Engineering",
              timePeriod: "Q1 FY26",
              owner: { name: "Franklin", initials: "FR" },
              dueDate: "Mar 31, 2026",
            },
            {
              id: "tg-3",
              name: "Enterprise Multi-Tenancy & Data Isolation Audit",
              status: "at risk",
              progress: 45,
              team: "Engineering",
              timePeriod: "Q2 FY26",
              owner: { name: "Sarah Chen", initials: "SC" },
              dueDate: "May 30, 2026",
            },
            {
              id: "tg-7",
              name: "Database Query Optimization & Indexing",
              status: "on track",
              progress: 65,
              team: "Engineering",
              timePeriod: "Q2 FY26",
              owner: { name: "Sivakumar", initials: "SK" },
              dueDate: "Jun 15, 2026",
            },
          ],
        },
        {
          teamName: "Design",
          totalGoals: 2,
          completedGoals: 0,
          averageProgress: 80,
          health: "On Track",
          goals: [
            {
              id: "tg-2",
              name: "Design System Tokenization & Accessibility Compliance",
              status: "on track",
              progress: 75,
              team: "Design",
              timePeriod: "Q1 FY26",
              owner: { name: "Alex Rivera", initials: "AR" },
              dueDate: "Apr 15, 2026",
            },
            {
              id: "tg-8",
              name: "Mobile Responsive Interactive Prototypes",
              status: "on track",
              progress: 85,
              team: "Design",
              timePeriod: "Q1 FY26",
              owner: { name: "Alex Rivera", initials: "AR" },
              dueDate: "Apr 30, 2026",
            },
          ],
        },
        {
          teamName: "Product",
          totalGoals: 2,
          completedGoals: 1,
          averageProgress: 95,
          health: "On Track",
          goals: [
            {
              id: "tg-4",
              name: "Product Analytics & Funnel Drop-off Telemetry",
              status: "on track",
              progress: 90,
              team: "Product",
              timePeriod: "Q1 FY26",
              owner: { name: "Luxmor", initials: "LX" },
              dueDate: "Apr 30, 2026",
            },
            {
              id: "tg-9",
              name: "Q1 Customer Feedback Synthesis & Roadmap Release",
              status: "achieved",
              progress: 100,
              team: "Product",
              timePeriod: "Q1 FY26",
              owner: { name: "Luxmor", initials: "LX" },
              dueDate: "Mar 31, 2026",
            },
          ],
        },
        {
          teamName: "Operations",
          totalGoals: 2,
          completedGoals: 0,
          averageProgress: 42,
          health: "At Risk",
          goals: [
            {
              id: "tg-5",
              name: "Zero-Downtime Deployment & Chaos Testing Protocol",
              status: "on track",
              progress: 65,
              team: "Operations",
              timePeriod: "Q2 FY26",
              owner: { name: "Michael Chang", initials: "MC" },
              dueDate: "Jun 15, 2026",
            },
            {
              id: "tg-10",
              name: "SOC-2 Audit Readiness & Security Evidence Vault",
              status: "off track",
              progress: 20,
              team: "Operations",
              timePeriod: "Q3 FY26",
              owner: { name: "Michael Chang", initials: "MC" },
              dueDate: "Sep 30, 2026",
            },
          ],
        },
        {
          teamName: "QA & Infrastructure",
          totalGoals: 2,
          completedGoals: 0,
          averageProgress: 75,
          health: "On Track",
          goals: [
            {
              id: "tg-6",
              name: "Regression Test Automation for Sprints & Task Flows",
              status: "on track",
              progress: 70,
              team: "QA & Infrastructure",
              timePeriod: "Q2 FY26",
              owner: { name: "Jeeva", initials: "JV" },
              dueDate: "Jun 30, 2026",
            },
            {
              id: "tg-11",
              name: "Cross-Browser & Visual Regression Test Suite",
              status: "on track",
              progress: 80,
              team: "QA & Infrastructure",
              timePeriod: "Q2 FY26",
              owner: { name: "Jeeva", initials: "JV" },
              dueDate: "May 15, 2026",
            },
          ],
        },
      ],
      metrics: {
        totalTeams: 5,
        totalGoals: 12,
        completedGoals: 2,
        overallCompletionPercent: 17,
        overallAverageProgress: 72,
      },
    };
  },

  /**
   * Create a new Team Goal
   */
  async createTeamGoal(goalData) {
    try {
      const response = await goalsClient.post("/team-goals/", goalData);
      return response.data;
    } catch (error) {
      console.warn("[goalsApi] Backend POST /team-goals/ error, saving locally:", error.message);
      return {
        id: `tg-${Date.now()}`,
        ...goalData,
      };
    }
  },
};
