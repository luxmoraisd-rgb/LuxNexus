import { useState, useEffect, useMemo, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { fetchMeetings, createMeeting, deleteMeeting } from "./meetingsApi";
import "./MeetingsPage.css";

const getTodayDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateValue = (dateValue) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getInitialFormData = () => ({
  title: "",
  type: "upcoming",
  date: getTodayDateValue(),
  startTime: "16:00",
  endTime: "17:00",
  duration: "60 mins",
  platform: "Google Meet",
  link: "",
  location: "",
  agenda: "",
});

const isInPersonPlatform = (platform) => platform === "In Person" || platform?.startsWith("In Person ");

const getMeetingDetail = (platform) => {
  if (isInPersonPlatform(platform)) {
    return { label: "Location", placeholder: "Enter meeting location", type: "text" };
  }
  const placeholders = {
    "Google Meet": "https://meet.google.com/...",
    Zoom: "https://zoom.us/j/...",
    "Microsoft Teams": "https://teams.microsoft.com/l/meetup-join/...",
  };
  return {
    label: "Meeting Link",
    placeholder: placeholders[platform] || "https://",
    type: "url",
  };
};

const formatMeetingDate = (dateValue, options) => {
  return new Intl.DateTimeFormat("en-US", options).format(parseDateValue(dateValue));
};

const formatMeetingTime = (timeValue) => {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
};

const getMinutesFromTime = (timeValue) => {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
};

export default function MeetingsPage({ currentUser }) {
  const [meetings, setMeetings] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, upcoming: 0, recent: 0, hours_recorded: "0 hrs" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "upcoming" | "recent"
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const meetingModalRef = useRef(null);
  
  // Schedule Form State
  const [formData, setFormData] = useState(getInitialFormData);
  const [validationErrors, setValidationErrors] = useState({});
  const [timeError, setTimeError] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [maxMeetingYear, setMaxMeetingYear] = useState(() => new Date().getFullYear() + 1);
  const todayDateValue = getTodayDateValue();
  const maxDateValue = `${maxMeetingYear}-12-31`;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const firstDayOffset = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const daysInCalendarMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInCalendarMonth }, (_, index) => index + 1),
  ];
  const monthOptions = Array.from(
    { length: 12 - (calendarYear === currentYear ? currentDate.getMonth() : 0) },
    (_, index) => index + (calendarYear === currentYear ? currentDate.getMonth() : 0)
  );
  const yearOptions = Array.from(
    { length: maxMeetingYear - currentYear + 1 },
    (_, index) => currentYear + index
  );
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

  const changeCalendarMonth = (monthOffset) => {
    const nextMonth = new Date(calendarYear, calendarMonthIndex + monthOffset, 1);
    setCalendarMonth(nextMonth);
    setMaxMeetingYear((year) => Math.max(year, nextMonth.getFullYear() + 1));
  };

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

  useEffect(() => {
    if (!selectedMeeting || !meetingModalRef.current) return;

    const modal = meetingModalRef.current;
    const previouslyFocused = document.activeElement;
    const getFocusableElements = () =>
      Array.from(
        modal.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0);

    getFocusableElements()[0]?.focus();

    const handleModalTab = (event) => {
      if (event.key === "Escape") {
        setSelectedMeeting(null);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        modal.focus();
      } else if (!modal.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleModalTab);
    return () => {
      document.removeEventListener("keydown", handleModalTab);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [selectedMeeting]);

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
    const isInPerson = isInPersonPlatform(formData.platform);
    const meetingDetail = isInPerson ? formData.location : formData.link;
    const errors = {
      title: formData.title.trim() ? "" : "Meeting title is required.",
      meetingDetail: meetingDetail.trim() ? "" : `${getMeetingDetail(formData.platform).label} is required.`,
    };
    setValidationErrors(errors);
    if (errors.title || errors.meetingDetail) return;
    if (formData.endTime <= formData.startTime) {
      setTimeError("End time must be later than start time.");
      return;
    }

    setTimeError("");
    const { startTime, endTime, ...meetingData } = formData;
    const duration = getMinutesFromTime(endTime) - getMinutesFromTime(startTime);

    try {
      const res = await createMeeting({
        ...meetingData,
        link: isInPerson ? "" : formData.link,
        location: isInPerson ? formData.location : "",
        date: formatMeetingDate(formData.date, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time: `${formatMeetingTime(startTime)} - ${formatMeetingTime(endTime)}`,
        duration: `${duration} mins`,
        attendees: [
          {
            name: currentUser?.name || currentUser?.username || "",
            role: "Host",
            initials: (currentUser?.name || currentUser?.username || "")
              .slice(0, 2)
              .toUpperCase(),
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
      setFormData(getInitialFormData());
      setValidationErrors({});
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
          onClick={() => {
            setValidationErrors({});
            setTimeError("");
            setIsScheduleModalOpen(true);
          }}
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
            <span className="stat-value">{metrics.hours_recorded || "0 hrs"}</span>
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
                role="group"
                tabIndex={0}
                aria-label={`${meeting.title} meeting card`}
                onClick={() => setSelectedMeeting(meeting)}
              >
                <div className="meeting-card-header">
                  <span className={`meeting-meta-badge ${isUpcoming ? "upcoming" : "completed"}`}>
                    {isUpcoming ? "Upcoming Call" : "Completed Session"}
                  </span>
                  <div className="meeting-time-badge">
                    <Clock size={12} />
                    <span>{meeting.date}{meeting.duration ? ` • ${meeting.duration}` : ""}</span>
                  </div>
                </div>

                <div>
                  <h3 className="meeting-card-title">{meeting.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: "0.78rem", color: "var(--app-muted)" }}>
                    <Video size={13} style={{ color: "#818cf8" }} />
                    <span>{meeting.platform || "Platform not specified"}</span>
                    <span>•</span>
                    <span>{meeting.time}</span>
                  </div>
                </div>

                <p className="meeting-agenda-snippet">
                  {meeting.agenda || meeting.keyTakeaways || "No agenda provided."}
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
                    {isUpcoming && meeting.link && !isInPersonPlatform(meeting.platform) ? (
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

            <form onSubmit={handleCreateMeeting} noValidate>
              <div className="meetings-modal-body">
                <div className="modal-form-group">
                  <label htmlFor="meeting-title">Meeting Title *</label>
                  <input
                    id="meeting-title"
                    type="text"
                    className={`modal-input ${validationErrors.title ? "is-invalid" : ""}`}
                    placeholder="e.g. Sprint 24 Planning & Estimation"
                    value={formData.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setFormData({ ...formData, title });
                      if (title.trim()) {
                        setValidationErrors((errors) => ({ ...errors, title: "" }));
                      }
                    }}
                    aria-invalid={Boolean(validationErrors.title)}
                    aria-describedby={validationErrors.title ? "meeting-title-error" : undefined}
                    autoFocus
                  />
                  {validationErrors.title && (
                    <span id="meeting-title-error" className="modal-form-error" role="alert">
                      {validationErrors.title}
                    </span>
                  )}
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
                      onChange={(e) => setFormData({
                        ...formData,
                        platform: e.target.value,
                        link: "",
                        location: "",
                      })}
                    >
                      <option value="Google Meet">Google Meet</option>
                      <option value="Zoom">Zoom</option>
                      <option value="Microsoft Teams">Microsoft Teams</option>
                      <option value="In Person">In Person</option>
                    </select>
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>Date & Day</label>
                    <div
                      className="modal-date-picker"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) {
                          setIsDatePickerOpen(false);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="modal-input modal-date-trigger"
                        aria-label="Meeting date"
                        aria-haspopup="dialog"
                        aria-expanded={isDatePickerOpen}
                        onClick={() => {
                          if (!isDatePickerOpen) {
                            setCalendarMonth(parseDateValue(formData.date));
                          }
                          setIsDatePickerOpen((open) => !open);
                        }}
                      >
                        <span>{formData.date.split("-").reverse().join("-")}</span>
                        <CalendarDays size={16} aria-hidden="true" />
                      </button>
                      {isDatePickerOpen && (
                        <div className="modal-calendar-popover" role="dialog" aria-label="Choose meeting date">
                          <div className="modal-calendar-header">
                            <button
                              type="button"
                              className="modal-calendar-nav"
                              aria-label="Previous month"
                              disabled={calendarYear === currentYear && calendarMonthIndex === currentDate.getMonth()}
                              onClick={() => changeCalendarMonth(-1)}
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <select
                              className="modal-calendar-select"
                              aria-label="Month"
                              value={calendarMonthIndex}
                              onChange={(event) => setCalendarMonth(new Date(calendarYear, Number(event.target.value), 1))}
                            >
                              {monthOptions.map((month) => (
                                <option key={month} value={month}>
                                  {monthFormatter.format(new Date(calendarYear, month, 1))}
                                </option>
                              ))}
                            </select>
                            <select
                              className="modal-calendar-select modal-calendar-year"
                              aria-label="Year"
                              value={calendarYear}
                              onChange={(event) => {
                                const year = Number(event.target.value);
                                const month = year === currentYear
                                  ? Math.max(calendarMonthIndex, currentDate.getMonth())
                                  : calendarMonthIndex;
                                setCalendarMonth(new Date(year, month, 1));
                                setMaxMeetingYear((currentMax) => Math.max(currentMax, year + 1));
                              }}
                            >
                              {yearOptions.map((year) => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="modal-calendar-nav"
                              aria-label="Next month"
                              disabled={calendarYear === maxMeetingYear && calendarMonthIndex === 11}
                              onClick={() => changeCalendarMonth(1)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                          <div className="modal-calendar-grid modal-calendar-weekdays" aria-hidden="true">
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                              <span key={day}>{day}</span>
                            ))}
                          </div>
                          <div className="modal-calendar-grid">
                            {calendarCells.map((day, index) => {
                              if (day === null) {
                                return <span key={`empty-${index}`} className="modal-calendar-empty" />;
                              }
                              const dateValue = toDateValue(new Date(calendarYear, calendarMonthIndex, day));
                              return (
                                <button
                                  key={dateValue}
                                  type="button"
                                  className={`modal-calendar-day ${dateValue === formData.date ? "selected" : ""}`}
                                  aria-label={formatMeetingDate(dateValue, {
                                    weekday: "long",
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                  aria-pressed={dateValue === formData.date}
                                  disabled={dateValue < todayDateValue || dateValue > maxDateValue}
                                  onClick={() => {
                                    setFormData({ ...formData, date: dateValue });
                                    setIsDatePickerOpen(false);
                                  }}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {formData.date && (
                      <span className="modal-date-preview">
                        {formatMeetingDate(formData.date, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  <div className="modal-form-group">
                    <label>Time Slot</label>
                    <div className="modal-time-slot">
                      <input
                        type="time"
                        className="modal-input"
                        aria-label="Meeting start time"
                        value={formData.startTime}
                        onChange={(e) => {
                          setFormData({ ...formData, startTime: e.target.value });
                          setTimeError("");
                        }}
                        required
                      />
                      <span className="modal-time-separator" aria-hidden="true">to</span>
                      <input
                        type="time"
                        className="modal-input"
                        aria-label="Meeting end time"
                        value={formData.endTime}
                        onChange={(e) => {
                          setFormData({ ...formData, endTime: e.target.value });
                          setTimeError("");
                        }}
                        required
                      />
                    </div>
                    {timeError && <span className="modal-form-error">{timeError}</span>}
                  </div>
                </div>

                <div className="modal-form-group">
                  <label htmlFor="meeting-link-or-location">{getMeetingDetail(formData.platform).label} *</label>
                  <input
                    id="meeting-link-or-location"
                    type={getMeetingDetail(formData.platform).type}
                    className={`modal-input ${validationErrors.meetingDetail ? "is-invalid" : ""}`}
                    placeholder={getMeetingDetail(formData.platform).placeholder}
                    value={isInPersonPlatform(formData.platform) ? formData.location : formData.link}
                    onChange={(e) => {
                      const detailKey = isInPersonPlatform(formData.platform) ? "location" : "link";
                      setFormData({ ...formData, [detailKey]: e.target.value });
                      if (e.target.value.trim()) {
                        setValidationErrors((errors) => ({ ...errors, meetingDetail: "" }));
                      }
                    }}
                    aria-invalid={Boolean(validationErrors.meetingDetail)}
                    aria-describedby={validationErrors.meetingDetail ? "meeting-detail-error" : undefined}
                  />
                  {validationErrors.meetingDetail && (
                    <span id="meeting-detail-error" className="modal-form-error" role="alert">
                      {validationErrors.meetingDetail}
                    </span>
                  )}
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
          <div
            ref={meetingModalRef}
            className="meetings-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
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

              {isInPersonPlatform(selectedMeeting.platform) ? (
                selectedMeeting.location && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Location:</strong> {selectedMeeting.location}
                  </div>
                )
              ) : selectedMeeting.link && (
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
