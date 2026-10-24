/**
 * Knowledge & Meetings API Service
 */

const BASE_URL = "/api";

export const FALLBACK_MEETINGS = [
  {
    id: "meet-up-1",
    title: "Sprint 24 Planning & Estimation",
    type: "upcoming",
    status: "upcoming",
    date: "Today, Oct 23",
    time: "3:30 PM - 4:30 PM",
    duration: "60 mins",
    platform: "Google Meet",
    link: "https://meet.google.com/nex-sprint-plan",
    agenda: "Review velocity targets, prioritize backlog tickets, and assign engineering leads for sprint 24 deliverables.",
    keyTakeaways: "Pending execution.",
    actionItems: [
      "Confirm frontend component dependencies",
      "Finalize API contract for user notifications",
      "Lock sprint commitment by 5:00 PM",
    ],
    attendees: [
      {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
      {"name": "Alex Rivera", "role": "Lead Frontend Engineer", "initials": "AR", "color": "#3b82f6"},
      {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
      {"name": "Elena Rostova", "role": "Principal Product Designer", "initials": "ER", "color": "#ec4899"},
    ],
  },
  {
    id: "meet-up-2",
    title: "Executive Product Roadmap & Q4 Alignment",
    type: "upcoming",
    status: "upcoming",
    date: "Tomorrow, Oct 24",
    time: "10:00 AM - 11:00 AM",
    duration: "60 mins",
    platform: "Zoom",
    link: "https://zoom.us/j/nexus-product-sync",
    agenda: "Review customer feedback on beta releases, evaluate feature adoption metrics, and align engineering capacity.",
    keyTakeaways: "Strategic alignment session.",
    actionItems: [
      "Prepare Q3 metric deck with user retention graph",
      "Review customer satisfaction scores",
    ],
    attendees: [
      {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
      {"name": "Marcus Vance", "role": "VP of Product", "initials": "MV", "color": "#8b5cf6"},
      {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
    ],
  },
  {
    id: "meet-up-3",
    title: "Security Governance & SOC-2 Audit Preparation",
    type: "upcoming",
    status: "upcoming",
    date: "Mon, Oct 26",
    time: "1:00 PM - 2:00 PM",
    duration: "60 mins",
    platform: "Microsoft Teams",
    link: "https://teams.microsoft.com/l/meetup-join/nexus-audit",
    agenda: "Audit log retention verification, access control policy review, and automated vulnerability scan validation.",
    keyTakeaways: "Pre-audit readiness validation.",
    actionItems: [
      "Export session history audit log sample",
      "Validate encryption at rest configurations",
    ],
    attendees: [
      {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
      {"name": "David Kim", "role": "DevOps Architect", "initials": "DK", "color": "#f59e0b"},
      {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
    ],
  },
  {
    id: "meet-rec-1",
    title: "Sprint 23 Retrospective & Continuous Improvement",
    type: "recent",
    status: "completed",
    date: "Oct 22, 2026",
    time: "11:00 AM - 12:00 PM",
    duration: "60 mins",
    platform: "Google Meet",
    link: "https://meet.google.com/nex-sprint-retro",
    agenda: "Review Sprint 23 completion rate, discuss engineering friction points, and identify process adjustments.",
    keyTakeaways: "Automated deployment pipeline reduced release verification time by 42%. Frontend component tests passed 100% of pre-commit hooks.",
    actionItems: [
      "Improve Cypress end-to-end test flakiness in CI",
      "Document newly introduced API endpoints in Postman collection",
    ],
    attendees: [
      {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
      {"name": "Alex Rivera", "role": "Lead Frontend Engineer", "initials": "AR", "color": "#3b82f6"},
      {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
      {"name": "Elena Rostova", "role": "Principal Product Designer", "initials": "ER", "color": "#ec4899"},
    ],
  },
  {
    id: "meet-rec-2",
    title: "Architecture Review: Event-Driven Pipeline",
    type: "recent",
    status: "completed",
    date: "Oct 21, 2026",
    time: "2:30 PM - 3:30 PM",
    duration: "60 mins",
    platform: "Zoom",
    link: "https://zoom.us/j/nexus-event-arch",
    agenda: "Evaluate message broker options (Kafka vs Redis Streams) for live notification delivery and task events.",
    keyTakeaways: "Agreed to adopt Redis Streams for lightweight in-app messaging and Kafka partitioned topics for persistent analytics.",
    actionItems: [
      "Deploy staging Redis cluster with persistence enabled",
      "Write load testing benchmark script for 10k concurrent clients",
    ],
    attendees: [
      {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
      {"name": "David Kim", "role": "DevOps Architect", "initials": "DK", "color": "#f59e0b"},
      {"name": "Priya Patel", "role": "Backend Engineer", "initials": "PP", "color": "#14b8a6"},
    ],
  },
  {
    id: "meet-rec-3",
    title: "Nexus Design System 2.0 Token Sync",
    type: "recent",
    status: "completed",
    date: "Oct 20, 2026",
    time: "10:00 AM - 10:45 AM",
    duration: "45 mins",
    platform: "Google Meet",
    link: "https://meet.google.com/nex-design-sync",
    agenda: "Audit dark and light theme tokens, verify contrast compliance, and review new button and chip components.",
    keyTakeaways: "Approved HSL color scales and WCAG AAA compliance tokens for inputs, badges, and progress meters across both themes.",
    actionItems: [
      "Update Figma token library to match CSS variables",
      "Release component showcase in documentation site",
    ],
    attendees: [
      {"name": "Elena Rostova", "role": "Principal Product Designer", "initials": "ER", "color": "#ec4899"},
      {"name": "Marcus Vance", "role": "VP of Product", "initials": "MV", "color": "#8b5cf6"},
      {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
    ],
  },
];

export async function fetchMeetings(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.type) query.append("type", params.type);
    if (params.search) query.append("search", params.search);

    const url = `${BASE_URL}/meetings/${query.toString() ? `?${query.toString()}` : ""}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch meetings: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Using fallback meetings data:", err.message);
    let list = [...FALLBACK_MEETINGS];
    if (params.type === "upcoming") {
      list = list.filter((m) => m.type === "upcoming" || m.status === "upcoming");
    } else if (params.type === "recent") {
      list = list.filter((m) => m.type === "recent" || m.status === "completed");
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        (m.agenda && m.agenda.toLowerCase().includes(q))
      );
    }
    return {
      success: true,
      metrics: {
        total: list.length,
        upcoming: list.filter((m) => m.type === "upcoming").length,
        recent: list.filter((m) => m.type === "recent").length,
        hours_recorded: "18.5 hrs",
      },
      meetings: list,
    };
  }
}

export async function createMeeting(meetingData) {
  try {
    const res = await fetch(`${BASE_URL}/meetings/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meetingData),
    });

    if (!res.ok) {
      throw new Error(`Failed to create meeting: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Using offline meeting creation:", err.message);
    const newMeeting = {
      ...meetingData,
      id: `meet-local-${Date.now()}`,
      status: meetingData.type === "recent" ? "completed" : "upcoming",
      created_at: new Date().toISOString(),
    };
    FALLBACK_MEETINGS.unshift(newMeeting);
    return { success: true, meeting: newMeeting };
  }
}

export async function deleteMeeting(id) {
  try {
    const res = await fetch(`${BASE_URL}/meetings/${id}/`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`Failed to delete meeting: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    const idx = FALLBACK_MEETINGS.findIndex((m) => m.id === id);
    if (idx !== -1) {
      FALLBACK_MEETINGS.splice(idx, 1);
    }
    return { success: true, deleted: true };
  }
}
