import { useState } from "react";
import "./peoplesidebar.css";

const PeopleSidebar = ({ activeItem: propActiveItem, onNavigate }) => {
  const [internalActiveItem, setInternalActiveItem] = useState("Members");
  const [teamExpanded, setTeamExpanded] = useState(true);

  const activeItem = propActiveItem || internalActiveItem;

  const handleNavigate = (item) => {
    setInternalActiveItem(item);
    if (onNavigate) {
      onNavigate(item);
    }
  };

  return (
    <aside className="people-sidebar">
      <PeopleSidebar.Header title="People" />

      <PeopleSidebar.Content>
        {/* Profile / Directory */}
        <PeopleSidebar.ProfileItem
          active={activeItem === "Profile" || activeItem === "Directory"}
          onClick={() => handleNavigate("Profile")}
        />

        {/* Team */}
        <PeopleSidebar.TeamSection
          expanded={teamExpanded}
          onToggle={() => setTeamExpanded(!teamExpanded)}
          onNavigate={handleNavigate}
          activeItem={activeItem}
        />
      </PeopleSidebar.Content>
    </aside>
  );
};

/* -----------------------------------
   Header Component
----------------------------------- */

PeopleSidebar.Header = ({ title }) => {
  return (
    <div className="people-sidebar__header">
      {title}
    </div>
  );
};

/* -----------------------------------
   Content Component
----------------------------------- */

PeopleSidebar.Content = ({ children }) => {
  return (
    <div className="people-sidebar__content">
      {children}
    </div>
  );
};

/* -----------------------------------
   Profile Item
----------------------------------- */

PeopleSidebar.ProfileItem = ({ active, onClick }) => {
  return (
    <button
      className={`people-sidebar__item ${
        active ? "people-sidebar__item--active" : ""
      }`}
      onClick={onClick}
    >
      <span className="people-sidebar__avatar people-sidebar__avatar--profile">
        👥
      </span>

      <span className="people-sidebar__label">
        Directory
      </span>
    </button>
  );
};

/* -----------------------------------
   Team Section
----------------------------------- */

PeopleSidebar.TeamSection = ({
  expanded,
  onToggle,
  onNavigate,
  activeItem,
}) => {
  return (
    <div className="people-sidebar__team">
      <button
        className="people-sidebar__team-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span
          className={`people-sidebar__arrow ${
            expanded ? "people-sidebar__arrow--expanded" : ""
          }`}
        />

        <span className="people-sidebar__team-title">
          Team
        </span>
      </button>

      {expanded && (
        <div className="people-sidebar__team-content">
          <button
            className={`people-sidebar__sub-item ${
              activeItem === "Members"
                ? "people-sidebar__sub-item--active"
                : ""
            }`}
            onClick={() => onNavigate("Members")}
          >
            Members
          </button>

          <button
            className={`people-sidebar__sub-item ${
              activeItem === "Teams"
                ? "people-sidebar__sub-item--active"
                : ""
            }`}
            onClick={() => onNavigate("Teams")}
          >
            Teams & Squads
          </button>

          <button
            className={`people-sidebar__sub-item ${
              activeItem === "Invitations"
                ? "people-sidebar__sub-item--active"
                : ""
            }`}
            onClick={() => onNavigate("Invitations")}
          >
            Invitations
          </button>
        </div>
      )}
    </div>
  );
};
export default PeopleSidebar;