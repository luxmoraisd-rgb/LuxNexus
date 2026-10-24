import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMeetings, FALLBACK_MEETINGS } from "../../SubSideBar/Knowledge/meetingsApi";
import "./knowledgesidebar.css";

/* ---------------- SVG ICONS ---------------- */

const MeetingsIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M8 8H16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M8 11.5H13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M8 15H11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="16"
      cy="15"
      r="2"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M16 14V15.2L16.8 16"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const CalendarIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M16 2V6M8 2V6M3 10H21"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const VideoIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15 10L21 6V18L15 14M4 6H15V18H4C3.44772 18 3 17.5523 3 17V7C3 6.44772 3.44772 6 4 6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronIcon = ({ expanded }) => (
  <svg
    className={`chevron-icon ${expanded ? "expanded" : ""}`}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M7 9L12 14L17 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ---------------- COMPOUND COMPONENTS ---------------- */

const KnowledgeHeader = () => {
  return (
    <div className="knowledge-header">
      <span>Knowledge</span>
    </div>
  );
};

const KnowledgeNavItem = ({
  icon,
  label,
  active,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`knowledge-nav-item ${
        active ? "knowledge-nav-item-active" : ""
      }`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className="knowledge-nav-icon">
        {icon}
      </span>

      <span className="knowledge-nav-label">
        {label}
      </span>
    </button>
  );
};

const KnowledgeNavigation = ({
  activeItem,
  onNavigate,
}) => {
  return (
    <nav className="knowledge-navigation">
      <KnowledgeNavItem
        label="Meetings"
        icon={<MeetingsIcon />}
        active={activeItem === "Meetings"}
        onClick={() => onNavigate("Meetings")}
      />
    </nav>
  );
};

const UpcomingMeetingsSection = ({ meetings, onSelectMeeting }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="recent-section">
      <button
        type="button"
        className="recent-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="recent-chevron">
          <ChevronIcon expanded={expanded} />
        </span>

        <span className="recent-title">
          Upcoming Meetings
        </span>
        <span className="meeting-count-badge upcoming">
          {meetings.length}
        </span>
      </button>

      <div
        className={`recent-content ${
          expanded ? "recent-content-open" : ""
        }`}
      >
        {meetings.length > 0 ? (
          meetings.map((m) => (
            <div
              key={m.id}
              className="recent-item meeting-sidebar-item"
              onClick={() => onSelectMeeting(m)}
              title={`${m.title} (${m.time})`}
            >
              <span className="sidebar-meet-icon-wrap upcoming">
                <VideoIcon size={14} />
              </span>

              <div className="sidebar-meet-info">
                <span className="recent-item-text">
                  {m.title}
                </span>
                <span className="sidebar-meet-sub">
                  {m.date.split(",")[0]} • {m.time.split("-")[0].trim()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="sidebar-empty-hint">No upcoming meetings</div>
        )}
      </div>
    </section>
  );
};

const RecentMeetingsSection = ({ meetings, onSelectMeeting }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="recent-section">
      <button
        type="button"
        className="recent-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="recent-chevron">
          <ChevronIcon expanded={expanded} />
        </span>

        <span className="recent-title">
          Recent Meetings
        </span>
        <span className="meeting-count-badge recent">
          {meetings.length}
        </span>
      </button>

      <div
        className={`recent-content ${
          expanded ? "recent-content-open" : ""
        }`}
      >
        {meetings.length > 0 ? (
          meetings.map((m) => (
            <div
              key={m.id}
              className="recent-item meeting-sidebar-item"
              onClick={() => onSelectMeeting(m)}
              title={`${m.title} (${m.date})`}
            >
              <span className="sidebar-meet-icon-wrap recent">
                <CalendarIcon size={14} />
              </span>

              <div className="sidebar-meet-info">
                <span className="recent-item-text">
                  {m.title}
                </span>
                <span className="sidebar-meet-sub">
                  {m.date} • {m.duration || "60 mins"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="sidebar-empty-hint">No recent meetings</div>
        )}
      </div>
    </section>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */

const KnowledgeSidebar = () => {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Meetings");
  const [meetings, setMeetings] = useState(FALLBACK_MEETINGS);

  useEffect(() => {
    let mounted = true;
    fetchMeetings().then((res) => {
      if (mounted && res && res.meetings) {
        setMeetings(res.meetings);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const upcomingMeetings = meetings.filter(
    (m) => m.type === "upcoming" || m.status === "upcoming"
  );
  const recentMeetings = meetings.filter(
    (m) => m.type === "recent" || m.status === "completed"
  );

  const handleNavigate = (item) => {
    setActiveItem(item);
    navigate("/knowledge");
  };

  const handleSelectMeeting = (meeting) => {
    navigate("/knowledge");
    window.dispatchEvent(
      new CustomEvent("nexus-open-meeting", { detail: { meeting } })
    );
  };

  return (
    <aside className="knowledge-sidebar">
      <KnowledgeHeader />

      <KnowledgeNavigation
        activeItem={activeItem}
        onNavigate={handleNavigate}
      />

      <div className="knowledge-scrollable-body">
        <UpcomingMeetingsSection
          meetings={upcomingMeetings}
          onSelectMeeting={handleSelectMeeting}
        />

        <RecentMeetingsSection
          meetings={recentMeetings}
          onSelectMeeting={handleSelectMeeting}
        />
      </div>

      <div className="knowledge-sidebar-footer" />
    </aside>
  );
};

export default KnowledgeSidebar;