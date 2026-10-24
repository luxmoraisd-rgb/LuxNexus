import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Video,
  Plus,
  Search,
  Users,
  CheckCircle2,
  CalendarDays,
  ExternalLink,
  Trash2,
  Sparkles,
  FileText,
  CheckSquare,
} from "lucide-react";
import { fetchMeetings, createMeeting, deleteMeeting } from "./meetingsApi";
import "./MeetingsPage.css";

export default function MeetingsPage({ currentUser }) {
  const [meetings, setMeetings] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, upcoming: 0, recent: 0, hours_recorded: "18.5 hrs" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "upcoming" | "recent"
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
  // Schedule Form State
  const [formData, setFormData] = useState({
    title: "",
    type: "upcoming",
    date: "Today, Oct 23",
    time: "4:00 PM - 5:00 PM",
    duration: "60 mins",
    platform: "Google Meet",
    link: "https://meet.google.com/nex-call",
    agenda: "",
  });

  // Load meetings
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchMeetings();
      if (res && res.success) {
        setMeetings(res.meetings || []);
        if (res.metrics) setMetrics(res.metrics);
      }
    } catch (err) {
      console.error("Failed to load meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to sidebar selection events if any
    const handleOpenMeeting = (e) => {
      if (e.detail && e.detail.meeting) {
        setSelectedMeeting(e.detail.meeting);
      }
    };
    window.addEventListener("nexus-open-meeting", handleOpenMeeting);
    return () => window.removeEventListener("nexus-open-meeting", handleOpenMeeting);
  }, []);

  // Filtered list
  const filteredMeetings = useMemo(() => {
    let list = [...meetings];
    if (activeTab === "upcoming") {
      list = list.filter((m) => m.type === "upcoming" || m.status === "upcoming");
    } else if (activeTab === "recent") {
      list = list.filter((m) => m.type === "recent" || m.status === "completed");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.agenda && m.agenda.toLowerCase().includes(q)) ||
          (m.attendees && m.attendees.some((a) => a.name.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [meetings, activeTab, searchQuery]);

  // Handle Create Meeting
  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      const res = await createMeeting({
        ...formData,
        attendees: [
          {
            name: currentUser?.username || "Jagadeep",
            role: "Host",
            initials: currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : "JA",
            color: "#6366f1",
          },
        ],
      });

      if (res && res.success && res.meeting) {
        setMeetings((prev) => [res.meeting, ...prev]);
        setMetrics((prev) => ({
          ...prev,
          total: prev.total + 1,
          upcoming: formData.type === "upcoming" ? prev.upcoming + 1 : prev.upcoming,
          recent: formData.type === "recent" ? prev.recent + 1 : prev.recent,
        }));
      }
      setIsScheduleModalOpen(false);
      setFormData({
        title: "",
        type: "upcoming",
        date: "Today, Oct 23",
        time: "4:00 PM - 5:00 PM",
        duration: "60 mins",
        platform: "Google Meet",
        link: "https://meet.google.com/nex-call",
        agenda: "",
      });
    } catch (err) {
      console.error("Failed to schedule meeting:", err);
    }
  };

  // Handle Delete Meeting
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this meeting record?")) return;

    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      if (selectedMeeting?.id === id) setSelectedMeeting(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="meetings-page-container">
      {/* HEADER */}
      <div className="meetings-header">
        <div className="meetings-title-row">
          <div className="meetings-icon-wrapper">
            <Calendar size={26} />
          </div>
          <div>
            <h1 className="meetings-title">Knowledge & Meetings</h1>
            <span className="meetings-subtitle">
              Review upcoming sessions, join active calls, and browse past meeting notes and recordings.
            </span>
          </div>
        </div>

        <button
          type="button"
          className="schedule-meeting-btn"
          onClick={() => setIsScheduleModalOpen(true)}
        >
          <Plus size={16} />
          Schedule Meeting
        </button>
      </div>

      {/* KPI METRIC STRIP */}
      <div className="meetings-stats-grid">
        <div className="meetings-stat-card">
          <div className="stat-icon-wrap indigo">
            <CalendarDays size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{metrics.total || meetings.length}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
        </div>

        <div className="meetings-stat-card">
          <div className="stat-icon-wrap emerald">
            <Video size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{metrics.upcoming || meetings.filter((m) => m.type === "upcoming").length}</span>
            <span className="stat-label">Upcoming Meetings</span>
          </div>
        </div>

        <div className="meetings-stat-card">
          <div className="stat-icon-wrap blue">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{metrics.recent || meetings.filter((m) => m.type === "recent" || m.status === "completed").length}</span>
            <span className="stat-label">Recent Meetings</span>
          </div>
        </div>

        <div className="meetings-stat-card">
          <div className="stat-icon-wrap amber">
            <Clock size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{metrics.hours_recorded || "18.5 hrs"}</span>
            <span className="stat-label">Recorded Audio/Notes</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH STRIP */}
      <div className="meetings-filter-strip">
        <div className="meeting-tabs-group">
          <button
            type="button"
            className={`meeting-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Meetings ({meetings.length})
          </button>
          <button
            type="button"
            className={`meeting-tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming ({meetings.filter((m) => m.type === "upcoming" || m.status === "upcoming").length})
          </button>
          <button
            type="button"
            className={`meeting-tab-btn ${activeTab === "recent" ? "active" : ""}`}
            onClick={() => setActiveTab("recent")}
          >
            Recent Meetings ({meetings.filter((m) => m.type === "recent" || m.status === "completed").length})
          </button>
        </div>

        <div className="meetings-search-box">
          <Search size={15} className="search-input-icon" />
          <input
            type="text"
            className="meetings-search-input"
            placeholder="Search meetings by title, agenda, attendees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* MEETINGS GRID */}
      <div className="meetings-grid">
        {filteredMeetings.length > 0 ? (
          filteredMeetings.map((meeting) => {
            const isUpcoming = meeting.type === "upcoming" || meeting.status === "upcoming";

            return (
              <div
                key={meeting.id}
                className={`meeting-card ${isUpcoming ? "is-upcoming" : "is-recent"}`}
                onClick={() => setSelectedMeeting(meeting)}
              >
                <div className="meeting-card-header">
                  <span className={`meeting-meta-badge ${isUpcoming ? "upcoming" : "completed"}`}>
                    {isUpcoming ? "Upcoming Call" : "Completed Session"}
                  </span>
                  <div className="meeting-time-badge">
                    <Clock size={12} />
                    <span>{meeting.date} • {meeting.duration || "60 mins"}</span>
                  </div>
                </div>

                <div>
                  <h3 className="meeting-card-title">{meeting.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: "0.78rem", color: "var(--app-muted)" }}>
                    <Video size={13} style={{ color: "#818cf8" }} />
                    <span>{meeting.platform || "Google Meet"}</span>
                    <span>•</span>
                    <span>{meeting.time}</span>
                  </div>
                </div>

                <p className="meeting-agenda-snippet">
                  {meeting.agenda || meeting.keyTakeaways || "No detailed agenda provided for this sync."}
                </p>

                <div className="meeting-card-footer">
                  <div className="meeting-attendees-wrap">
                    {(meeting.attendees || []).slice(0, 4).map((att, idx) => (
                      <div
                        key={idx}
                        className="attendee-avatar"
                        style={{ backgroundColor: att.color || "#6366f1" }}
                        title={`${att.name} (${att.role || "Attendee"})`}
                      >
                        {att.initials || (att.name ? att.name.slice(0, 2).toUpperCase() : "AT")}
                      </div>
                    ))}
                    {(meeting.attendees || []).length > 4 && (
                      <div className="attendee-avatar" style={{ backgroundColor: "#334155" }}>
                        +{meeting.attendees.length - 4}
                      </div>
                    )}
                  </div>

                  <div className="meeting-card-actions">
                    {isUpcoming && meeting.link ? (
                      <a
                        href={meeting.link}
                        target="_blank"
                        rel="noreferrer"
                        className="join-meet-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} />
                        Join Call
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="details-meet-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMeeting(meeting);
                        }}
                      >
                        View Notes
                      </button>
                    )}

                    <button
                      type="button"
                      className="delete-meet-btn"
                      onClick={(e) => handleDelete(meeting.id, e)}
                      title="Remove meeting"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="meetings-empty-state">
            <Calendar size={36} style={{ color: "#6366f1" }} />
            <h3>No meetings found</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", maxWidth: 360 }}>
              {searchQuery
                ? `No meeting records match your search "${searchQuery}".`
                : "No meetings found for this filter tab."}
            </p>
          </div>
        )}
      </div>

      {/* SCHEDULE MEETING MODAL */}
      {isScheduleModalOpen && (
        <div className="meetings-modal-overlay" onClick={() => setIsScheduleModalOpen(false)}>
          <div className="meetings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="meetings-modal-header">
              <h2>Schedule New Meeting</h2>
              <button
                type="button"
                className="meetings-modal-close"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateMeeting}>
              <div className="meetings-modal-body">
                <div className="modal-form-group">
                  <label>Meeting Title *</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="e.g. Sprint 24 Planning & Estimation"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>Classification</label>
                    <select
                      className="modal-select"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="upcoming">Upcoming Meeting</option>
                      <option value="recent">Recent / Past Notes</option>
                    </select>
                  </div>

                  <div className="modal-form-group">
                    <label>Platform</label>
                    <select
                      className="modal-select"
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    >
                      <option value="Google Meet">Google Meet</option>
                      <option value="Zoom">Zoom</option>
                      <option value="Microsoft Teams">Microsoft Teams</option>
                      <option value="In Person Room A">In Person</option>
                    </select>
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>Date & Day</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="e.g. Tomorrow, Oct 24"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  <div className="modal-form-group">
                    <label>Time Slot</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="e.g. 10:00 AM - 11:00 AM"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-form-group">
                  <label>Meeting Link / Location</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="https://meet.google.com/..."
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Agenda & Topics</label>
                  <textarea
                    rows="3"
                    className="modal-textarea"
                    placeholder="Outline discussion goals and key takeaways..."
                    value={formData.agenda}
                    onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  />
                </div>
              </div>

              <div className="meetings-modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-save-btn"
                  disabled={!formData.title.trim()}
                >
                  Schedule Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEETING DETAILS / NOTES MODAL */}
      {selectedMeeting && (
        <div className="meetings-modal-overlay" onClick={() => setSelectedMeeting(null)}>
          <div className="meetings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="meetings-modal-header">
              <div>
                <span className={`meeting-meta-badge ${selectedMeeting.type === "upcoming" ? "upcoming" : "completed"}`}>
                  {selectedMeeting.type === "upcoming" ? "Upcoming Meeting" : "Completed Session"}
                </span>
                <h2 style={{ marginTop: 6 }}>{selectedMeeting.title}</h2>
              </div>
              <button
                type="button"
                className="meetings-modal-close"
                onClick={() => setSelectedMeeting(null)}
              >
                ×
              </button>
            </div>

            <div className="meetings-modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "0.85rem", color: "var(--app-muted)" }}>
                <span><strong>Date:</strong> {selectedMeeting.date}</span>
                <span>•</span>
                <span><strong>Time:</strong> {selectedMeeting.time}</span>
                <span>•</span>
                <span><strong>Platform:</strong> {selectedMeeting.platform || "Google Meet"}</span>
              </div>

              {selectedMeeting.link && (
                <div style={{ marginTop: 4 }}>
                  <a
                    href={selectedMeeting.link}
                    target="_blank"
                    rel="noreferrer"
                    className="join-meet-btn"
                    style={{ display: "inline-flex", width: "fit-content" }}
                  >
                    <ExternalLink size={13} />
                    {selectedMeeting.type === "upcoming" ? "Open Meeting Link" : "View Recording"}
                  </a>
                </div>
              )}

              {/* Agenda */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", fontWeight: 700, color: "var(--app-text)" }}>
                  <FileText size={15} style={{ color: "#6366f1" }} />
                  <span>Agenda & Discussion Topics</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "0.86rem", color: "var(--app-muted)", lineHeight: 1.5 }}>
                  {selectedMeeting.agenda || "No agenda entered for this session."}
                </p>
              </div>

              {/* Key Takeaways */}
              {selectedMeeting.keyTakeaways && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", fontWeight: 700, color: "var(--app-text)" }}>
                    <Sparkles size={15} style={{ color: "#10b981" }} />
                    <span>Key Takeaways & Decisions</span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: "0.86rem", color: "var(--app-muted)", lineHeight: 1.5 }}>
                    {selectedMeeting.keyTakeaways}
                  </p>
                </div>
              )}

              {/* Action items */}
              {selectedMeeting.actionItems && selectedMeeting.actionItems.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", fontWeight: 700, color: "var(--app-text)" }}>
                    <CheckSquare size={15} style={{ color: "#3b82f6" }} />
                    <span>Action Items ({selectedMeeting.actionItems.length})</span>
                  </div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: "0.85rem", color: "var(--app-muted)" }}>
                    {selectedMeeting.actionItems.map((item, idx) => (
                      <li key={idx} style={{ marginTop: 4 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Attendees Roster */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem", fontWeight: 700, color: "var(--app-text)" }}>
                  <Users size={15} style={{ color: "#a855f7" }} />
                  <span>Participants ({(selectedMeeting.attendees || []).length})</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {(selectedMeeting.attendees || []).map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 10px",
                        background: "rgba(255, 255, 255, 0.04)",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        fontSize: "0.82rem",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          backgroundColor: att.color || "#6366f1",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {att.initials || att.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{att.name}</span>
                      <span style={{ color: "var(--app-muted)", fontSize: "0.75rem" }}>({att.role || "Attendee"})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="meetings-modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setSelectedMeeting(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
