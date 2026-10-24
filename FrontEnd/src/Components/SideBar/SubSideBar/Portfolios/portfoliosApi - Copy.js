import axios from "axios";

const API_BASE = "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (token && token !== "nexus-guest-token") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const FALLBACK_DATA = {
  portfolios: [
    {
      id: "pf-core-2026",
      name: "Core Platform Modernization",
      key: "PORT-CORE",
      description: "Enterprise-scale UI/UX unification, distributed microservice architecture, and sub-100ms API response latency.",
      status: "on track",
      progress: 74,
      priority: "High",
      timeframe: "Q1 - Q4 FY26",
      budget: "$340,000",
      color: "#6366f1",
      owner: {
        name: "Jagadeep",
        role: "VP of Engineering",
        initials: "JA",
      },
      projects: [
        { id: "p-1", name: "Nexus Design System 2.0", progress: 85, status: "on track" },
        { id: "p-2", name: "Distributed Event Engine", progress: 70, status: "on track" },
        { id: "p-3", name: "Edge Caching & Cloud Scale", progress: 62, status: "at risk" },
      ],
      created_at: "2026-01-15T09:00:00Z",
    },
    {
      id: "pf-sec-2026",
      name: "Enterprise Trust & SOC-2 Compliance",
      key: "PORT-SEC",
      description: "Zero-trust identity governance, end-to-end audit logging pipeline, and automated threat vulnerability remediation.",
      status: "on track",
      progress: 90,
      priority: "Urgent",
      timeframe: "Q1 - Q3 FY26",
      budget: "$210,000",
      color: "#10b981",
      owner: {
        name: "Sarah Chen",
        role: "Security Director",
        initials: "SC",
      },
      projects: [
        { id: "p-4", name: "SOC-2 Type II Compliance", progress: 95, status: "on track" },
        { id: "p-5", name: "Zero-Trust RBAC Matrix", progress: 88, status: "on track" },
        { id: "p-6", name: "Encrypted Session Audit Store", progress: 82, status: "on track" },
      ],
      created_at: "2026-02-01T10:00:00Z",
    },
    {
      id: "pf-mobile-2026",
      name: "Mobile & Cross-Platform Experience",
      key: "PORT-MOB",
      description: "High-fidelity mobile applications for iOS and Android with seamless offline task synchronization and instant push alerts.",
      status: "at risk",
      progress: 48,
      priority: "Medium",
      timeframe: "Q2 - Q4 FY26",
      budget: "$195,000",
      color: "#f59e0b",
      owner: {
        name: "Alex Rivera",
        role: "Lead Mobile Architect",
        initials: "AR",
      },
      projects: [
        { id: "p-7", name: "React Native Mobile Client", progress: 55, status: "at risk" },
        { id: "p-8", name: "Offline First Sync Engine", progress: 40, status: "off track" },
        { id: "p-9", name: "Rich Notification Service", progress: 60, status: "on track" },
      ],
      created_at: "2026-03-10T12:00:00Z",
    },
    {
      id: "pf-ai-2026",
      name: "Autonomous AI & Intelligent Workflows",
      key: "PORT-AI",
      description: "Context-aware coding agents, smart task triage algorithms, and real-time sprint velocity predictive models.",
      status: "on track",
      progress: 64,
      priority: "High",
      timeframe: "Q2 - Q4 FY26",
      budget: "$275,000",
      color: "#ec4899",
      owner: {
        name: "Elena Rostova",
        role: "Head of AI Engineering",
        initials: "ER",
      },
      projects: [
        { id: "p-10", name: "Predictive Burndown Forecaster", progress: 65, status: "on track" },
        { id: "p-11", name: "Smart Backlog Triage Engine", progress: 72, status: "on track" },
        { id: "p-12", name: "Conversational Agent Sidecar", progress: 50, status: "at risk" },
      ],
      created_at: "2026-04-05T08:30:00Z",
    },
  ],
  metrics: {
    totalPortfolios: 4,
    totalProjects: 12,
    averageProgress: 69,
    onTrackCount: 3,
    atRiskCount: 1,
    offTrackCount: 0,
  },
};

export const portfoliosApi = {
  async getPortfolios(params = {}) {
    try {
      const response = await client.get("/portfolios/", { params });
      if (response.data && response.data.portfolios) {
        return response.data;
      }
      return FALLBACK_DATA;
    } catch (err) {
      console.warn("[portfoliosApi] Using offline fallback data:", err.message);
      let list = FALLBACK_DATA.portfolios;
      if (params.status && params.status !== "all") {
        list = list.filter((p) => p.status.toLowerCase() === params.status.toLowerCase());
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.owner.name.toLowerCase().includes(q)
        );
      }
      return {
        portfolios: list,
        metrics: FALLBACK_DATA.metrics,
      };
    }
  },

  async createPortfolio(payload) {
    try {
      const response = await client.post("/portfolios/", payload);
      return response.data;
    } catch (err) {
      console.warn("[portfoliosApi] Create error, creating local fallback object:", err.message);
      return {
        id: `pf-local-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
      };
    }
  },

  async updatePortfolio(id, payload) {
    try {
      const response = await client.put(`/portfolios/${id}/`, payload);
      return response.data;
    } catch (err) {
      console.warn("[portfoliosApi] Update error:", err.message);
      return { id, ...payload };
    }
  },

  async deletePortfolio(id) {
    try {
      await client.delete(`/portfolios/${id}/`);
      return true;
    } catch (err) {
      console.warn("[portfoliosApi] Delete error:", err.message);
      return true;
    }
  },
};
