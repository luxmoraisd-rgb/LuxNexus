import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./sprintoverview.css";

const sprintData = [
  {
    id: 1,
    name: "Sprint 1",
    goal: "Complete authentication module",
    status: "In Progress",
    startDate: "2026-10-01",
    endDate: "2026-10-14",
    completedTasks: 6,
    inProgressTasks: 2,
    totalTasks: 10,
    team: ["Franklin", "Dhilip", "Sugi", "Durga"],
  },
  {
    id: 2,
    name: "Sprint 2",
    goal: "Improve reporting dashboards",
    status: "Not Started",
    startDate: "2026-10-15",
    endDate: "2026-10-28",
    completedTasks: 0,
    inProgressTasks: 0,
    totalTasks: 8,
    team: ["Haritha", "Kishore", "Sakana"],
  },
  {
    id: 3,
    name: "Sprint 3",
    goal: "Launch team onboarding flow",
    status: "Completed",
    startDate: "2026-09-15",
    endDate: "2026-09-30",
    completedTasks: 9,
    inProgressTasks: 0,
    totalTasks: 9,
    team: ["Franklin", "Stuart", "Dhilip"],
  },
  {
    id: 4,
    name: "Sprint 4",
    goal: "Stabilize mobile and notifications",
    status: "In Progress",
    startDate: "2026-10-29",
    endDate: "2026-11-11",
    completedTasks: 3,
    inProgressTasks: 4,
    totalTasks: 12,
    team: ["Jones", "Durga", "Kishore", "Sugi"],
  },
];

const filters = ["All", "Not Started", "In Progress", "Completed"];

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function SprintOverviewButton({ onOpen }) {
  return (
    <button
      type="button"
      className="header-action"
      title="Sprints overview"
      onClick={onOpen}
    >
      <span>◔</span>
      Sprints overview
    </button>
  );
}

export function SprintOverviewPage() {
  const navigate = useNavigate();
  const [selectedSprintId, setSelectedSprintId] = useState(sprintData[0]?.id || null);
  const [filter, setFilter] = useState("All");

  const filteredSprints = useMemo(() => {
    if (filter === "All") return sprintData;
    return sprintData.filter((sprint) => sprint.status === filter);
  }, [filter]);

  const selectedSprint = filteredSprints.find((sprint) => sprint.id === selectedSprintId) || filteredSprints[0] || sprintData[0];

  const progress = selectedSprint
    ? Math.round((selectedSprint.completedTasks / selectedSprint.totalTasks) * 100)
    : 0;

  return (
    <div className="sprint-overview-page">
      <header className="sprint-overview-header">
        <button type="button" className="sprint-overview-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1>Sprint Overview</h1>
      </header>

      <div className="sprint-overview-toolbar">
        <div className="sprint-filter-group">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={`sprint-filter ${filter === item ? "active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <section className="sprint-overview-grid">
        <div className="sprint-rail">
          {filteredSprints.length === 0 ? (
            <div className="sprint-empty-state">No sprints available</div>
          ) : (
            filteredSprints.map((sprint) => {
              const sprintProgress = Math.round((sprint.completedTasks / sprint.totalTasks) * 100);
              const isSelected = selectedSprint?.id === sprint.id;

              return (
                <button
                  type="button"
                  key={sprint.id}
                  className={`sprint-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedSprintId(sprint.id)}
                >
                  <div className="sprint-card-header">
                    <div>
                      <div className="sprint-name">{sprint.name}</div>
                      <div className="sprint-goal">{sprint.goal}</div>
                    </div>
                    <span className={`sprint-status-badge ${sprint.status.toLowerCase().replace(/\s+/g, "-")}`}>
                      {sprint.status}
                    </span>
                  </div>

                  <div className="sprint-progress-inline">
                    <span>{sprintProgress}%</span>
                    <div className="sprint-progress-track">
                      <div className="sprint-progress-fill" style={{ width: `${sprintProgress}%` }} />
                    </div>
                  </div>

                  <div className="sprint-meta-grid">
                    <div><span>Start</span><strong>{formatDate(sprint.startDate)}</strong></div>
                    <div><span>End</span><strong>{formatDate(sprint.endDate)}</strong></div>
                    <div><span>Tasks</span><strong>{sprint.totalTasks}</strong></div>
                    <div><span>Done</span><strong>{sprint.completedTasks}</strong></div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selectedSprint && (
          <article className="sprint-detail-panel">
            <div className="sprint-detail-header">
              <div>
                <div className="sprint-detail-label">Sprint</div>
                <h2>{selectedSprint.name}</h2>
              </div>
              <span className={`sprint-status-badge ${selectedSprint.status.toLowerCase().replace(/\s+/g, "-")}`}>
                {selectedSprint.status}
              </span>
            </div>

            <div className="sprint-detail-goal">
              <strong>Goal:</strong> {selectedSprint.goal}
            </div>

            <div className="sprint-detail-metrics">
              <div className="metric-box">
                <CalendarDays size={16} />
                <div>
                  <span>Start Date</span>
                  <strong>{formatDate(selectedSprint.startDate)}</strong>
                </div>
              </div>
              <div className="metric-box">
                <CalendarDays size={16} />
                <div>
                  <span>End Date</span>
                  <strong>{formatDate(selectedSprint.endDate)}</strong>
                </div>
              </div>
              <div className="metric-box">
                <CheckCircle2 size={16} />
                <div>
                  <span>Progress</span>
                  <strong>{progress}%</strong>
                </div>
              </div>
              <div className="metric-box">
                <Clock3 size={16} />
                <div>
                  <span>Remaining</span>
                  <strong>{selectedSprint.totalTasks - selectedSprint.completedTasks}</strong>
                </div>
              </div>
            </div>

            <div className="progress-panel">
              <div className="progress-header-row">
                <span>Progress</span>
                <strong>{progress}%</strong>
              </div>
              <div className="sprint-progress-track large">
                <div className="sprint-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="task-summary-grid">
              <div className="summary-box">
                <span>Completed</span>
                <strong>{selectedSprint.completedTasks}</strong>
              </div>
              <div className="summary-box">
                <span>In Progress</span>
                <strong>{selectedSprint.inProgressTasks}</strong>
              </div>
              <div className="summary-box">
                <span>Remaining</span>
                <strong>{selectedSprint.totalTasks - selectedSprint.completedTasks}</strong>
              </div>
              <div className="summary-box">
                <span>Total</span>
                <strong>{selectedSprint.totalTasks}</strong>
              </div>
            </div>

            <div className="sprint-team-panel">
              <div className="sprint-team-header"><Users size={16} /> <span>Team members</span></div>
              <div className="sprint-team-list">
                {selectedSprint.team.map((member) => (
                  <span key={member} className="team-pill">{member}</span>
                ))}
              </div>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}
