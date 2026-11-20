import { BarChart2, Calendar, Clock, Layers, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./resourcing.css";
import {
  getStoredCharts,
  getTodayDate,
  resourcingApi,
  saveStoredCharts,
  validateProjectDates,
} from "./resourcingApi";

const chartSections = [
  {
    id: "recommended",
    title: "Recommended",
    charts: [
      {
        id: "incomplete-tasks",
        title: "Incomplete tasks by project",
        type: "bar",
        colors: ["#08cfa3", "#19cfae", "#63e6be", "#5bd9c0"],
      },
      {
        id: "projects-status",
        title: "Projects by status",
        type: "donut",
        colors: ["#18d68c", "#ffcb05", "#ef476f"],
      },
    ],
  },
  {
    id: "resourcing",
    title: "Resourcing",
    charts: [
      {
        id: "estimated-actual-assignee",
        title: "Estimated and actual time by assignee",
        badge: "New",
        type: "bar",
        colors: ["#9a8cff", "#ed65ad"],
      },
      {
        id: "estimated-actual-time",
        title: "Estimated and actual time over time",
        badge: "New",
        type: "line",
        colors: ["#9c8bff", "#f2b84b"],
      },
      {
        id: "tasks-assignee-status",
        title: "Tasks by assignee and task status",
        badge: "New",
        type: "bar",
        colors: ["#9b8cff"],
      },
      {
        id: "upcoming-assignee",
        title: "Upcoming tasks by assignee this week",
        type: "people",
        colors: ["#16b8f4"],
      },
      {
        id: "month-tasks-project",
        title: "This month's tasks by project",
        type: "bar",
        colors: ["#ef476f", "#ffb000", "#00cfa5", "#009ee8"],
      },
      {
        id: "custom-field-total",
        title: "Custom field total",
        type: "number",
      },
      {
        id: "projects-owner",
        title: "Projects by owner",
        type: "people",
        colors: ["#7669e8"],
      },
      {
        id: "projects-portfolio",
        title: "Projects by portfolio",
        type: "bar",
        colors: ["#326ee8", "#11c8bc", "#f0bd26", "#f66c1a"],
      },
      {
        id: "tasks-creator",
        title: "Tasks by creator",
        type: "people",
        colors: ["#20b8ee"],
      },
    ],
  },
  {
    id: "work-health",
    title: "Work health",
    charts: [
      {
        id: "time-custom-field",
        title: "Time in custom field",
        type: "bar",
        colors: ["#087ef5", "#11cfc0", "#f4ca22", "#f77c1a"],
      },
      {
        id: "tasks-custom-field",
        title: "Tasks by custom field",
        type: "donut",
        colors: ["#2774e8", "#20d7a0", "#f5c12d", "#765ee8"],
      },
      {
        id: "overdue-project",
        title: "Overdue tasks by project",
        type: "bar",
        colors: ["#ef476f", "#ff7188"],
      },
      {
        id: "upcoming-project",
        title: "Upcoming tasks by project",
        type: "bar",
        colors: ["#00a8ef", "#36c6f3", "#79dcf8"],
      },
      {
        id: "custom-project",
        title: "Custom field total by projects",
        type: "bar",
        colors: ["#6d5ddd", "#9287e8"],
      },
      {
        id: "projects-custom-field",
        title: "Projects by custom field",
        type: "donut",
        colors: ["#ef7f9e", "#00c8aa", "#7164e8"],
      },
      {
        id: "goals-status",
        title: "Goals by status",
        type: "donut",
        colors: ["#20d78c", "#ffc400", "#ef476f"],
      },
    ],
  },
  {
    id: "progress",
    title: "Progress",
    charts: [
      {
        id: "most-completed",
        title: "Projects with the most completed tasks",
        type: "bar",
        colors: ["#00cfa4", "#42dbc0"],
      },
      {
        id: "completion-status",
        title: "Tasks by completion status this month",
        type: "donut",
        colors: ["#69e5d1", "#18cba8", "#7763e9"],
      },
      {
        id: "completed-month",
        title: "Tasks completed by month",
        type: "line",
        colors: ["#00aeea"],
      },
    ],
  },
  {
    id: "work-connection",
    title: "Work connection",
    charts: [
      {
        id: "goal",
        title: "Goal",
        badge: "New",
        type: "line",
        colors: ["#9d8dff", "#f0b642"],
      },
    ],
  },
];

const AddChart = ({ onClose, onChartSelect, inline = false }) => {
  const [selectedChart, setSelectedChart] = useState(null);
  const [activeSection, setActiveSection] = useState("recommended");
  const contentRef = useRef(null);

  const scrollToSection = (sectionId) => {
    const container = contentRef.current;
    const element = container?.querySelector(`#chart-section-${sectionId}`);
    if (element && container) {
      const containerTop = container.getBoundingClientRect().top;
      const sectionTop = element.getBoundingClientRect().top;
      container.scrollTo({
        top: container.scrollTop + sectionTop - containerTop - 20,
        behavior: "smooth",
      });
    }
    setActiveSection(sectionId);
  };

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const targetTop = containerRect.top + parseFloat(getComputedStyle(container).paddingTop);
      const sections = chartSections
        .map((section) => {
          const element = container.querySelector(`#chart-section-${section.id}`);
          if (!element) return null;

          const rect = element.getBoundingClientRect();
          return { id: section.id, top: Math.abs(rect.top - targetTop) };
        })
        .filter(Boolean)
        .sort((a, b) => a.top - b.top);

      if (sections.length) {
        setActiveSection(sections[0].id);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleChartSelect = (chart) => {
    setSelectedChart(chart.id);
    if (onChartSelect) {
      onChartSelect(chart);
    }
  };

  return (
    <ChartModal onClose={onClose} inline={inline}>
      <ChartModal.Header>
        <h1>Add chart</h1>
        <button className="chart-close-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </ChartModal.Header>

      <ChartModal.Body>
        <ChartSidebar sections={chartSections} activeSection={activeSection} onSelect={scrollToSection} />
        <div className="chart-content" ref={contentRef}>
          {chartSections.map((section) => (
            <ChartSection
              key={section.id}
              section={section}
              selectedChart={selectedChart}
              onChartSelect={handleChartSelect}
            />
          ))}
        </div>
      </ChartModal.Body>
    </ChartModal>
  );
};

const ChartModal = ({ children, onClose, inline }) => (
  <div
    className={`chart-modal-overlay ${inline ? "chart-modal-overlay-inline" : ""}`}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <div className={`chart-modal ${inline ? "chart-modal-inline" : ""}`}>{children}</div>
  </div>
);

ChartModal.Header = ({ children }) => <header className="chart-modal-header">{children}</header>;
ChartModal.Body = ({ children }) => <div className="chart-modal-body">{children}</div>;

const ChartSidebar = ({ sections, activeSection, onSelect }) => (
  <aside className="chart-sidebar">
    {sections.map((section) => (
      <button
        key={section.id}
        className={`sidebar-item ${activeSection === section.id ? "active" : ""}`}
        onClick={() => onSelect(section.id)}
      >
        {section.title}
      </button>
    ))}
  </aside>
);

const ChartSection = ({ section, selectedChart, onChartSelect }) => (
  <section id={`chart-section-${section.id}`} className="chart-section">
    <h2 className="chart-section-title">{section.title}</h2>
    <div className="chart-grid">
      {section.charts.map((chart) => (
        <ChartCard
          key={chart.id}
          chart={chart}
          selected={selectedChart === chart.id}
          onClick={() => onChartSelect(chart)}
        />
      ))}
    </div>
  </section>
);

const ChartCard = ({ chart, selected, onClick }) => (
  <button className={`chart-card ${selected ? "selected" : ""}`} onClick={onClick}>
    <div className="chart-card-header">
      <span className="chart-card-title">{chart.title}</span>
      {chart.badge && <span className="new-badge">{chart.badge}</span>}
    </div>

    <div className="chart-preview">
      <ChartPreview type={chart.type} colors={chart.colors} />
    </div>
  </button>
);

const ChartPreview = () => (
  <div className="chart-no-data">Data will appear when available.</div>
);

const Resourcing = () => {
  const [activeTab, setActiveTab] = useState("charts");
  const [showAddChart, setShowAddChart] = useState(false);
  const [charts, setCharts] = useState(() => getStoredCharts());
  const [projects, setProjects] = useState([]);
  const [projectsError, setProjectsError] = useState("");
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [dateErrors, setDateErrors] = useState({});
  const [dateValidationAttempted, setDateValidationAttempted] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    resourcingApi
      .getCapacity()
      .then((data) => {
        if (isCurrent) {
          setProjects(data);
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setProjectsError(error.response?.data?.detail || error.message || "Unable to load projects.");
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!showNewProjectModal) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowNewProjectModal(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showNewProjectModal]);

  const handleChartSelect = (chart) => {
    setCharts((currentCharts) => {
      if (currentCharts.some((item) => item.id === chart.id)) {
        return currentCharts;
      }
      const updated = [...currentCharts, chart];
      saveStoredCharts(updated);
      return updated;
    });
    setShowAddChart(false);
  };

  const handleRemoveChart = (chartId, event) => {
    event?.stopPropagation?.();
    setCharts((currentCharts) => {
      const updated = currentCharts.filter((c) => c.id !== chartId);
      saveStoredCharts(updated);
      return updated;
    });
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setDateValidationAttempted(true);
    const errors = validateProjectDates(newStartDate, newEndDate);
    setDateErrors(errors);
    setCreateProjectError("");
    if (Object.keys(errors).length > 0) return;

    try {
      const created = await resourcingApi.createProject({
        name: newProjectName.trim(),
        start_date: newStartDate,
        end_date: newEndDate,
      });

      setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setNewProjectName("");
      setNewStartDate("");
      setNewEndDate("");
      setDateErrors({});
      setDateValidationAttempted(false);
      setShowNewProjectModal(false);
    } catch (error) {
      const serverErrors = error.fieldErrors || {};
      setDateErrors((previous) => ({
        ...previous,
        ...(serverErrors.start_date ? { start_date: serverErrors.start_date } : {}),
        ...(serverErrors.end_date ? { end_date: serverErrors.end_date } : {}),
      }));
      if (!serverErrors.start_date && !serverErrors.end_date) {
        setCreateProjectError("Unable to create the project. Please try again.");
      }
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await resourcingApi.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (error) {
      setProjectsError(error.response?.data?.detail || error.message || "Unable to delete project.");
    }
  };

  const totalAllocatedHours = projects.reduce((total, p) => {
    const projectHours = (p.allocations || []).reduce(
      (sum, a) => sum + (parseFloat(a.hours) || 0),
      0
    );
    return total + projectHours;
  }, 0);

  return (
    <main className="resourcing-page">
      <header className="resourcing-header">
        <div>
          <p className="resourcing-eyebrow">Tracker</p>
          <h1>Resourcing</h1>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              background: "var(--app-surface-card, #1a1b20)",
              padding: "4px",
              borderRadius: "8px",
              border: "1px solid var(--app-border, rgba(255,255,255,0.08))",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("charts")}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                background: activeTab === "charts" ? "#4a68d9" : "transparent",
                color: activeTab === "charts" ? "#ffffff" : "var(--app-muted, #8e8e8e)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <BarChart2 size={15} />
              Charts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("capacity")}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                background: activeTab === "capacity" ? "#4a68d9" : "transparent",
                color: activeTab === "capacity" ? "#ffffff" : "var(--app-muted, #8e8e8e)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Users size={15} />
              Projects & Capacity
            </button>
          </div>

          {activeTab === "charts" && charts.length > 0 && (
            <button
              className="resourcing-add-button"
              type="button"
              onClick={() => setShowAddChart(true)}
            >
              <Plus size={17} />
              Add chart
            </button>
          )}

          {activeTab === "capacity" && (
            <button
              className="resourcing-add-button"
              type="button"
              onClick={() => setShowNewProjectModal(true)}
            >
              <Plus size={17} />
              New Project
            </button>
          )}
        </div>
      </header>
      {projectsError && <p role="alert">{projectsError}</p>}

      {/* SUMMARY STATS BAR */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto 28px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "10px",
            background: "var(--app-surface, #18191e)",
            border: "1px solid var(--app-border, rgba(255,255,255,0.08))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--app-muted, #8e8e8e)",
              fontSize: "13px",
              marginBottom: "6px",
            }}
          >
            <Layers size={16} />
            <span>Active Projects</span>
          </div>
          <strong style={{ fontSize: "22px", color: "var(--app-text, #edf0ff)" }}>
            {projects.length}
          </strong>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderRadius: "10px",
            background: "var(--app-surface, #18191e)",
            border: "1px solid var(--app-border, rgba(255,255,255,0.08))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--app-muted, #8e8e8e)",
              fontSize: "13px",
              marginBottom: "6px",
            }}
          >
            <Clock size={16} />
            <span>Total Allocated Hours</span>
          </div>
          <strong style={{ fontSize: "22px", color: "var(--app-text, #edf0ff)" }}>
            {totalAllocatedHours.toFixed(0)} hrs
          </strong>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderRadius: "10px",
            background: "var(--app-surface, #18191e)",
            border: "1px solid var(--app-border, rgba(255,255,255,0.08))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--app-muted, #8e8e8e)",
              fontSize: "13px",
              marginBottom: "6px",
            }}
          >
            <BarChart2 size={16} />
            <span>Active Charts</span>
          </div>
          <strong style={{ fontSize: "22px", color: "var(--app-text, #edf0ff)" }}>
            {charts.length}
          </strong>
        </div>
      </section>

      {/* CHARTS TAB CONTENT */}
      {activeTab === "charts" && (
        <>
          {charts.length === 0 ? (
            <section className="resourcing-empty-state">
              <h2>Add chart</h2>
              <p>
                Choose a chart to track time, tasks, projects, and team workload.
              </p>
              <button
                className="resourcing-empty-action"
                type="button"
                onClick={() => setShowAddChart(true)}
              >
                <Plus size={17} />
                Add chart
              </button>
            </section>
          ) : (
            <section className="resourcing-chart-grid">
              {charts.map((chart) => (
                <article
                  className="resourcing-chart-card"
                  key={chart.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "220px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: "15px", fontWeight: 600 }}>
                        {chart.title}
                      </h2>
                      {chart.badge && (
                        <span className="new-badge">{chart.badge}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveChart(chart.id, e)}
                      title="Remove chart"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--app-muted, #8e8e8e)",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "4px",
                        display: "flex",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef476f")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--app-muted, #8e8e8e)")
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: "10px",
                    }}
                  >
                    <ChartPreview type={chart.type} colors={chart.colors} />
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      {/* CAPACITY & PROJECTS TAB CONTENT */}
      {activeTab === "capacity" && (
        <section style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {projects.length === 0 ? (
            <section className="resourcing-empty-state">
              <h2>No Resourcing Projects Yet</h2>
              <p>Create your first project to plan team capacity and assign hours.</p>
              <button
                className="resourcing-empty-action"
                type="button"
                onClick={() => setShowNewProjectModal(true)}
              >
                <Plus size={17} />
                New Project
              </button>
            </section>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {projects.map((project) => {
                const totalHours = (project.allocations || []).reduce(
                  (sum, a) => sum + (parseFloat(a.hours) || 0),
                  0
                );
                return (
                  <article
                    key={project.id}
                    style={{
                      background: "var(--app-surface, #18191e)",
                      border: "1px solid var(--app-border, rgba(255,255,255,0.08))",
                      borderRadius: "10px",
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            fontSize: "18px",
                            fontWeight: 700,
                            color: "var(--app-text, #edf0ff)",
                            margin: "0 0 6px 0",
                          }}
                        >
                          {project.name}
                        </h2>
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            color: "var(--app-muted, #8e8e8e)",
                            fontSize: "13px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Calendar size={14} />
                            {project.start_date} to {project.end_date}
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock size={14} />
                            {totalHours.toFixed(0)} total hrs
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteProject(project.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--app-muted, #8e8e8e)",
                          cursor: "pointer",
                          padding: "6px",
                        }}
                        title="Delete project"
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef476f")}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--app-muted, #8e8e8e)")
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {project.allocations && project.allocations.length > 0 ? (
                      <div style={{ marginTop: "16px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--app-muted, #8e8e8e)",
                            display: "block",
                            marginBottom: "8px",
                          }}
                        >
                          Allocated Team Members
                        </span>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          {project.allocations.map((alloc) => {
                            const u = alloc.user_details || alloc.user;
                            const name =
                              typeof u === "object"
                                ? u?.username || u?.name || "Team Member"
                                : "Team Member";
                            return (
                              <div
                                key={alloc.id || `${alloc.user}-${alloc.month}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "6px 12px",
                                  background: "var(--app-surface-card, #1a1b20)",
                                  borderRadius: "6px",
                                  border:
                                    "1px solid var(--app-border, rgba(255,255,255,0.06))",
                                  fontSize: "13px",
                                }}
                              >
                                <span
                                  style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    background: "#4a68d9",
                                    color: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                  }}
                                >
                                  {name.slice(0, 2).toUpperCase()}
                                </span>
                                <span style={{ fontWeight: 500 }}>{name}</span>
                                <span
                                  style={{
                                    color: "var(--app-muted, #8e8e8e)",
                                    fontSize: "12px",
                                  }}
                                >
                                  ({parseFloat(alloc.hours || 0).toFixed(0)}h in{" "}
                                  {alloc.month})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: "12px",
                          fontSize: "13px",
                          color: "var(--app-muted, #8e8e8e)",
                          fontStyle: "italic",
                        }}
                      >
                        No member allocations recorded for this project yet.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ADD CHART MODAL */}
      {showAddChart && (
        <AddChart
          onClose={() => setShowAddChart(false)}
          onChartSelect={handleChartSelect}
          inline
        />
      )}

      {/* NEW PROJECT MODAL */}
      {showNewProjectModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onMouseDown={() => setShowNewProjectModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "var(--app-surface, #18191e)",
              border: "1px solid var(--app-border, rgba(255,255,255,0.12))",
              borderRadius: "12px",
              padding: "24px",
              color: "var(--app-text, #edf0ff)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                margin: "0 0 16px 0",
              }}
            >
              Create Resourcing Project
            </h2>
            <form onSubmit={handleCreateProject} noValidate>
              {createProjectError && (
                <p role="alert" style={{ color: "#ef476f", fontSize: "13px", margin: "0 0 12px" }}>
                  {createProjectError}
                </p>
              )}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "var(--app-muted, #8e8e8e)",
                  }}
                >
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Search Rollout"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--app-border, rgba(255,255,255,0.15))",
                    background: "var(--app-surface-card, #1a1b20)",
                    color: "inherit",
                    fontSize: "14px",
                  }}
                  autoFocus
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                      color: "var(--app-muted, #8e8e8e)",
                    }}
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    min={getTodayDate()}
                    value={newStartDate}
                    aria-invalid={Boolean(dateErrors.start_date)}
                    aria-describedby={dateErrors.start_date ? "new-project-start-date-error" : undefined}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      setNewStartDate(startDate);
                      setDateErrors(validateProjectDates(startDate, newEndDate, dateValidationAttempted));
                      setCreateProjectError("");
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--app-border, rgba(255,255,255,0.15))",
                      background: "var(--app-surface-card, #1a1b20)",
                      color: "inherit",
                      fontSize: "13px",
                    }}
                  />
                  {dateErrors.start_date && (
                    <p id="new-project-start-date-error" role="alert" style={{ color: "#ef476f", fontSize: "12px", margin: "5px 0 0" }}>
                      {dateErrors.start_date}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "6px",
                      color: "var(--app-muted, #8e8e8e)",
                    }}
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    min={newStartDate || getTodayDate()}
                    value={newEndDate}
                    aria-invalid={Boolean(dateErrors.end_date)}
                    aria-describedby={dateErrors.end_date ? "new-project-end-date-error" : undefined}
                    onChange={(e) => {
                      const endDate = e.target.value;
                      setNewEndDate(endDate);
                      setDateErrors(validateProjectDates(newStartDate, endDate, dateValidationAttempted));
                      setCreateProjectError("");
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--app-border, rgba(255,255,255,0.15))",
                      background: "var(--app-surface-card, #1a1b20)",
                      color: "inherit",
                      fontSize: "13px",
                    }}
                  />
                  {dateErrors.end_date && (
                    <p id="new-project-end-date-error" role="alert" style={{ color: "#ef476f", fontSize: "12px", margin: "5px 0 0" }}>
                      {dateErrors.end_date}
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "1px solid var(--app-border, rgba(255,255,255,0.12))",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="resourcing-add-button"
                  style={{ padding: "8px 16px" }}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Resourcing;
