import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  User,
  Globe2,
  Settings,
  SlidersHorizontal,
  Sun,
  Moon,
  Lock,
  List,
  Mail,
  Smartphone,
  MapPin,
  ListChecks,
  FolderKanban,
  CircleCheck,
  Camera,
  Pencil,
  Check,
  X,
  LogOut,
  Loader2,
  Bell,
  Sparkles,
  Clock,
  ShieldCheck,
} from "lucide-react";

import "./profilepage.css";
import LanguageRegionPage from "../Settings/General/LanguageRegion/languageregion";
import ChangePassword from "../Settings/General/ChangePassword/changepass";
import SessionHistoryPage from "../Settings/General/SessionHistory/sessionhistory";
import { NotificationSettingsPanel } from "../Settings/Notification/notifysettings";
import profileApi, { getLocalFallbackProfile } from "./profileApi";
import {
  getStoredProjectKey,
  getStoredTasks,
  STORAGE_KEYS,
} from "../../SideBar/SubSideBar/MyTasks/Backlog/backlogApi";

const formatLocation = (value) => {
  if (!value) return "Add a location";

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return "Add a location";

  return parts.length > 1 ? `${parts[0]}, ${parts[1]}` : parts[0];
};

const Profile = ({ children }) => (
  <div className="profile-page">
    <div className="profile-ambient-sphere profile-ambient-1" />
    <div className="profile-ambient-sphere profile-ambient-2" />
    {children}
  </div>
);

Profile.Sidebar = ({ activeTab, setActiveTab, profile = {}, projectKey = "LUX" }) => {
  const settingsOpen = activeTab !== "personal";

  const fields = [
    profile.name,
    profile.email,
    profile.mobile,
    profile.location,
    profile.jobTitle,
    profile.photo,
  ];
  const filledCount = fields.filter(Boolean).length;
  const completionPct = Math.round((filledCount / fields.length) * 100);

  return (
    <aside className="profile-sidebar">
      <div className="sidebar-nav-section">
        <span className="sidebar-section-label">Account Navigation</span>
        <button
          className={`sidebar-item ${activeTab === "personal" ? "active" : ""}`}
          onClick={() => setActiveTab("personal")}
          aria-current={activeTab === "personal" ? "page" : undefined}
        >
          <div className="sidebar-item-icon-wrap">
            <User size={18} />
          </div>
          <span>Personal info</span>
          {activeTab === "personal" && <span className="active-glow-pip" />}
        </button>

        <button
          className={`sidebar-item settings-parent ${settingsOpen ? "active" : ""}`}
          onClick={() => setActiveTab(settingsOpen ? "personal" : "basic")}
          aria-expanded={settingsOpen}
        >
          <div className="sidebar-item-icon-wrap">
            <Settings size={18} />
          </div>
          <span>General settings</span>
          {settingsOpen && <span className="active-glow-pip" />}
        </button>

        {settingsOpen && (
          <nav className="profile-subsidebar" aria-label="General settings">
            {[
              { id: "basic", label: "Basic settings", icon: <SlidersHorizontal size={17} /> },
              { id: "notifications", label: "Notification settings", icon: <Bell size={17} /> },
              { id: "language", label: "Language & Region", icon: <Globe2 size={17} /> },
              { id: "password", label: "Password", icon: <Lock size={17} /> },
              { id: "session", label: "Session history", icon: <List size={17} /> },
            ].map((item, idx) => (
              <button
                key={item.id}
                className={`sidebar-item subsidebar-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
                style={{ animationDelay: `${idx * 0.04}s` }}
                aria-current={activeTab === item.id ? "page" : undefined}
              >
                <div className="sidebar-item-icon-wrap">{item.icon}</div>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Animated Profile Strength & Status Card */}
      <div className="sidebar-status-widget">
        <div className="sidebar-status-header">
          <div className="status-indicator-pill">
            <span className="live-ping-dot" />
            <span className="live-status-text">Online & Active</span>
          </div>
          <span className="sidebar-workspace-tag">{projectKey}</span>
        </div>

        <div className="profile-strength-card">
          <div className="strength-header">
            <div className="strength-icon-wrap">
              <Sparkles size={15} className="strength-sparkle" />
            </div>
            <div>
              <span className="strength-label">Profile Strength</span>
              <strong className="strength-value">{completionPct}%</strong>
            </div>
          </div>

          <div className="strength-progress-track">
            <div
              className="strength-progress-fill"
              style={{ width: `${Math.max(10, completionPct)}%` }}
            >
              <span className="progress-shimmer-sparkle" />
            </div>
          </div>
          <p className="strength-tip">
            {completionPct === 100
              ? "All profile fields are completed!"
              : "Complete your profile details"}
          </p>
        </div>

        <div className="sidebar-quick-stats">
          <div className="sidebar-quick-stat-item">
            <span className="quick-stat-number">{profile.role || "Member"}</span>
            <span className="quick-stat-label">Role</span>
          </div>
          <div className="sidebar-quick-stat-divider" />
          <div className="sidebar-quick-stat-item">
            <span className="quick-stat-number">{projectKey}</span>
            <span className="quick-stat-label">Workspace</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

Profile.Header = ({ onBack, onLogout, isSaving }) => {
  return (
    <header className="profile-header">
      <div className="profile-header-left">
        {onBack && (
          <button type="button" className="back-button" onClick={onBack} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1>Profile</h1>
      </div>
      <div className="profile-header-right">
        {isSaving && (
          <div className="profile-saving-indicator">
            <Loader2 size={15} className="profile-saving-spinner" />
            <span>Saving...</span>
          </div>
        )}
        {onLogout && (
          <button
            type="button"
            className="profile-header-logout-btn"
            onClick={onLogout}
            title="Sign out of Nexus"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </header>
  );
};

Profile.Layout = ({ children }) => (
  <main className="profile-layout">{children}</main>
);

Profile.Content = ({ children, className = "" }) => (
  <section className={`profile-content ${className}`.trim()}>{children}</section>
);

const ProfileHero = ({ profile, onUpdate, onPhotoUpload, isSaving }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name || "");
  const [editingJobTitle, setEditingJobTitle] = useState(false);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle || "");
  const [editingMobile, setEditingMobile] = useState(false);
  const [mobile, setMobile] = useState(profile.mobile || "");
  const [mobileError, setMobileError] = useState("");
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const previewCloseButtonRef = useRef(null);

  useEffect(() => {
    if (!isPhotoPreviewOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const triggerElement = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsPhotoPreviewOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    previewCloseButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus?.();
    };
  }, [isPhotoPreviewOpen]);

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdate({ ...profile, name: trimmed });
    setEditing(false);
  };

  const saveJobTitle = () => {
    onUpdate({ ...profile, jobTitle: jobTitle.trim() });
    setEditingJobTitle(false);
  };

  const saveMobile = () => {
    if (mobileError || !/^[0-9]{0,10}$/.test(mobile)) {
      setMobileError("Enter a mobile number with up to 10 digits.");
      return;
    }
    onUpdate({ ...profile, mobile: mobile.trim() });
    setEditingMobile(false);
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (onPhotoUpload) {
        onPhotoUpload(file, dataUrl);
      } else {
        onUpdate({ ...profile, photo: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="profile-hero">
      <div className="profile-main-info">
        <div className="avatar-wrapper">
          {profile.photo ? (
            <button
              type="button"
              className="profile-avatar"
              onClick={() => setIsPhotoPreviewOpen(true)}
              aria-label={`View ${profile.name || "user"} profile picture`}
              title="View profile picture"
            >
              <img src={profile.photo} alt={profile.name || "Profile"} className="profile-avatar-image" />
            </button>
          ) : (
            <div className="profile-avatar">
              <div className="avatar-fallback">{profile.name?.charAt(0) || "U"}</div>
            </div>
          )}

          <label className="upload-button" htmlFor="profile-photo-upload" title="Upload new photo">
            <Camera size={16} />
            {isSaving ? "Updating..." : "Add image"}
          </label>
          <input
            className="profile-photo-input"
            id="profile-photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handlePhotoUpload}
            disabled={isSaving}
          />
        </div>

        <div className="profile-name-section">
          {editing ? (
            <div className="edit-name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
              />

              <button type="button" onClick={saveName} disabled={isSaving}>
                Save
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setName(profile.name || "");
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="name-row">
                <h2>{profile.name || "User"}</h2>
                <button
                  type="button"
                  className="edit-btn"
                  onClick={() => setEditing(true)}
                  aria-label="Edit name"
                  title="Edit name"
                >
                  <Pencil size={16} />
                </button>
              </div>

              {editingJobTitle ? (
                <div className="job-row job-title-editor">
                  <input
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    placeholder="Enter job title"
                    aria-label="Job title"
                    autoFocus
                  />
                  <button type="button" onClick={saveJobTitle} disabled={isSaving}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setJobTitle(profile.jobTitle || "");
                      setEditingJobTitle(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="job-row">
                  <p className="job-title">{profile.jobTitle || "Add a job title"}</p>
                  <button
                    type="button"
                    className="job-edit-btn"
                    onClick={() => {
                      setJobTitle(profile.jobTitle || "");
                      setEditingJobTitle(true);
                    }}
                    aria-label="Edit job title"
                    title="Edit job title"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              )}
              <span className="role-badge">{profile.role || "Member"}</span>
            </>
          )}
        </div>
      </div>

      <div className="contact-info">
        <Profile.InfoItem
          icon={<Mail size={18} />}
          title="Email"
          value={profile.email || "Add an email"}
          empty={!profile.email}
        />

        <div className="info-item">
          <div className="info-icon"><Smartphone size={18} /></div>
          <div className="mobile-info-content">
            <strong>Mobile phone</strong>
            {editingMobile ? (
              <>
                <div className="mobile-number-editor">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobile}
                    onChange={(event) => {
                      const enteredValue = event.target.value;
                      if (/[^0-9]/.test(enteredValue)) {
                        setMobileError("Enter digits only.");
                        setMobile(enteredValue.replace(/[^0-9]/g, "").slice(0, 10));
                        return;
                      }
                      if (enteredValue.length > 10) {
                        setMobileError("Mobile number cannot exceed 10 digits.");
                        setMobile(enteredValue.slice(0, 10));
                        return;
                      }
                      setMobile(enteredValue);
                      setMobileError("");
                    }}
                    placeholder="Enter up to 10 digits"
                    aria-label="Mobile phone number"
                    aria-invalid={Boolean(mobileError)}
                    aria-describedby={mobileError ? "mobile-number-error" : undefined}
                    autoFocus
                  />
                  <button type="button" onClick={saveMobile} aria-label="Save mobile number" title="Save">
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobile(profile.mobile || "");
                      setMobileError("");
                      setEditingMobile(false);
                    }}
                    aria-label="Cancel mobile number edit"
                    title="Cancel"
                  >
                    <X size={15} />
                  </button>
                </div>
                {mobileError && (
                  <p id="mobile-number-error" className="mobile-number-error" role="alert">
                    {mobileError}
                  </p>
                )}
              </>
            ) : (
              <div className="mobile-number-display">
                <p className={!profile.mobile ? "empty-info" : ""}>
                  {profile.mobile || "Add a mobile phone"}
                </p>
                <button
                  type="button"
                  className="mobile-number-edit"
                  onClick={() => {
                    setMobile(profile.mobile || "");
                    setMobileError("");
                    setEditingMobile(true);
                  }}
                  aria-label="Edit mobile number"
                  title="Edit mobile number"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {isPhotoPreviewOpen && profile.photo && typeof document !== "undefined" && createPortal(
        <div
          className="profile-photo-preview-overlay"
          onClick={() => setIsPhotoPreviewOpen(false)}
        >
          <div
            className="profile-photo-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${profile.name || "User"} profile picture preview`}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsPhotoPreviewOpen(false);
              } else {
                event.stopPropagation();
              }
            }}
          >
            <button
              ref={previewCloseButtonRef}
              type="button"
              className="profile-photo-preview-close"
              onClick={() => setIsPhotoPreviewOpen(false)}
              aria-label="Close profile picture preview"
            >
              <X size={20} />
            </button>
            <img
              className="profile-photo-preview-image"
              src={profile.photo}
              alt={`${profile.name || "User"} profile`}
            />
            <span className="profile-photo-preview-caption">{profile.name || "Profile picture"}</span>
            <button
              type="button"
              className="profile-photo-preview-cancel"
              onClick={() => setIsPhotoPreviewOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

Profile.Hero = ProfileHero;

Profile.InfoItem = ({ icon, title, value, empty }) => {
  return (
    <div className="info-item" title={value}>
      <div className="info-icon">{icon}</div>
      <div className="info-item-text">
        <strong>{title}</strong>
        <p className={empty ? "empty-info" : ""}>{value}</p>
      </div>
    </div>
  );
};

Profile.Card = ({ children, className = "" }) => (
  <div className={`profile-card ${className}`}>{children}</div>
);

const ProfilePersonalDetails = ({ profile, onUpdate, isSaving }) => {
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState(profile.location || "");

  const timezoneInfo = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return { timezone: tz, localTime: timeStr };
    } catch {
      return { timezone: "Local Time", localTime: "" };
    }
  }, []);

  const saveLocation = () => {
    onUpdate({ ...profile, location: locationInput.trim() });
    setEditingLocation(false);
  };

  return (
    <Profile.Card className="details-card">
      <div className="card-section-title">
        <User size={18} />
        <span>Personal & Regional Details</span>
      </div>

      <div className="detail-rows-container">
        {/* Location Row */}
        <div className="detail-item">
          <div className="detail-icon">
            <MapPin size={19} />
          </div>
          <div className="detail-content">
            <div className="detail-header-row">
              <h3>Location</h3>
              {profile.location && !editingLocation && (
                <button
                  type="button"
                  className="detail-edit-btn"
                  onClick={() => setEditingLocation(true)}
                  title="Edit location"
                  aria-label="Edit location"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
            {editingLocation ? (
              <div className="inline-detail-editor">
                <input
                  type="text"
                  placeholder="City, State"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="detail-save-btn"
                  onClick={saveLocation}
                  disabled={isSaving}
                  title="Save location"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  className="detail-cancel-btn"
                  onClick={() => {
                    setLocationInput(profile.location || "");
                    setEditingLocation(false);
                  }}
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : profile.location ? (
              <p>{formatLocation(profile.location)}</p>
            ) : (
              <button
                type="button"
                className="add-button"
                onClick={() => setEditingLocation(true)}
              >
                Add a location
              </button>
            )}
          </div>
        </div>

        {/* Timezone / Region Row */}
        <div className="detail-item">
          <div className="detail-icon">
            <Globe2 size={19} />
          </div>
          <div className="detail-content">
            <div className="detail-header-row">
              <h3>Timezone & Region</h3>
            </div>
            <p className="detail-meta-text">
              {timezoneInfo.timezone} {timezoneInfo.localTime ? `(${timezoneInfo.localTime} local)` : ""}
            </p>
          </div>
        </div>

        {/* Work Status Row */}
        <div className="detail-item">
          <div className="detail-icon">
            <ShieldCheck size={19} />
          </div>
          <div className="detail-content">
            <div className="detail-header-row">
              <h3>Account Status</h3>
            </div>
            <div className="detail-status-pill">
              <span className="live-ping-dot" />
              <span>Active Verified Contributor</span>
            </div>
          </div>
        </div>
      </div>
    </Profile.Card>
  );
};

Profile.PersonalDetails = ProfilePersonalDetails;

const ProfileProjectSummaryCard = ({ tasks = [], projectKey = "LUX" }) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "Done").length;
  const inProgressTasks = tasks.filter((task) => task.status !== "Done").length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Profile.Card className="project-summary-card">
      <header className="project-summary-header">
        <div className="project-summary-icon">
          <FolderKanban size={22} />
        </div>
        <div className="project-summary-heading">
          <span>Project Workspace</span>
          <h2>{projectKey}</h2>
        </div>
        <div className="project-rate-badge">
          {completionPercentage}% complete
        </div>
      </header>

      <div className="project-summary-stats">
        <div className="stat-metric-box">
          <ListChecks size={18} />
          <span>Total tasks</span>
          <strong>{totalTasks}</strong>
        </div>
        <div className="stat-metric-box">
          <Clock size={18} />
          <span>In progress</span>
          <strong>{inProgressTasks}</strong>
        </div>
        <div className="stat-metric-box">
          <CircleCheck size={18} />
          <span>Completed</span>
          <strong>{completedTasks}</strong>
        </div>
      </div>

      <div className="project-progress-section">
        <div className="project-progress-labels">
          <span>Sprint delivery</span>
          <span>{completedTasks} of {totalTasks} finished</span>
        </div>
        <div className="project-progress-track">
          <div
            className="project-progress-bar"
            style={{ width: `${Math.max(4, completionPercentage)}%` }}
          />
        </div>
      </div>
    </Profile.Card>
  );
};

Profile.BasicSettings = ({ theme, onThemeChange }) => (
  <section className="settings-page">
    <header className="settings-page-header">
      <h2>Basic settings</h2>
    </header>
    <div className="basic-setting-row">
      <div>
        <h3>Appearance</h3>
        <p>Choose the theme used throughout the app.</p>
      </div>
      <div className="theme-control" role="group" aria-label="Appearance theme">
        <button
          type="button"
          className={theme === "light" ? "selected" : ""}
          aria-pressed={theme === "light"}
          onClick={() => onThemeChange("light")}
        >
          <Sun size={17} />
          Light
        </button>
        <button
          type="button"
          className={theme === "dark" ? "selected" : ""}
          aria-pressed={theme === "dark"}
          onClick={() => onThemeChange("dark")}
        >
          <Moon size={17} />
          Dark
        </button>
      </div>
    </div>
  </section>
);

Profile.TabContent = ({ activeTab, theme, onThemeChange, onLogout, currentUser }) => {
  const titles = {
    language: "Language & Region",
    password: "Password",
    session: "Session history",
  };

  if (activeTab === "personal") return null;
  if (activeTab === "basic") {
    return <Profile.BasicSettings theme={theme} onThemeChange={onThemeChange} />;
  }
  if (activeTab === "notifications") {
    return (
      <div className="profile-settings-section">
        <NotificationSettingsPanel theme={theme} isStandalone={true} />
      </div>
    );
  }
  if (activeTab === "language") return <LanguageRegionPage />;
  if (activeTab === "password") return <ChangePassword />;
  if (activeTab === "session") return <SessionHistoryPage onLogout={onLogout} currentUser={currentUser} />;


  return (
    <div className="tab-placeholder">
      <h2>{titles[activeTab]}</h2>
      <p>This section is ready for your settings and functionality.</p>
    </div>
  );
};

const ProfilePage = ({
  onBack,
  activeTab,
  setActiveTab,
  profileName,
  onProfileNameChange,
  profilePhoto,
  onProfilePhotoChange,
  theme,
  onThemeChange,
  onLogout,
  currentUser,
}) => {
  // Initialize with cached profile or defaults
  const [profile, setProfile] = useState(() => getLocalFallbackProfile());
  const [tasks, setTasks] = useState(() => getStoredTasks());
  const [projectKey, setProjectKey] = useState(() => getStoredProjectKey());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileAnimating, setIsProfileAnimating] = useState(false);
  const [notification, setNotification] = useState(null);
  const profileInputsRef = useRef({
    profileName,
    profilePhoto,
    currentUser,
    onProfileNameChange,
    onProfilePhotoChange,
  });

  useEffect(() => {
    profileInputsRef.current = {
      profileName,
      profilePhoto,
      currentUser,
      onProfileNameChange,
      onProfilePhotoChange,
    };
  }, [profileName, profilePhoto, currentUser, onProfileNameChange, onProfilePhotoChange]);

  // Auto-dismiss notification after 3.5 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

  useEffect(() => {
    const syncTasks = (nextTasks) => {
      if (Array.isArray(nextTasks)) setTasks(nextTasks);
      setProjectKey(getStoredProjectKey());
    };
    const handleTaskUpdate = (event) => syncTasks(event.detail);
    const handleProjectKeyUpdate = (event) => {
      if (typeof event.detail === "string") setProjectKey(event.detail);
    };
    const handleStorageUpdate = (event) => {
      if (event.key === STORAGE_KEYS.TASKS || event.key === STORAGE_KEYS.PROJECT_KEY) {
        syncTasks(getStoredTasks());
      }
    };

    window.addEventListener("nexus:backlog-tasks-changed", handleTaskUpdate);
    window.addEventListener("nexus:project-key-changed", handleProjectKeyUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("nexus:backlog-tasks-changed", handleTaskUpdate);
      window.removeEventListener("nexus:project-key-changed", handleProjectKeyUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isProfileAnimating) return undefined;
    const timer = setTimeout(() => setIsProfileAnimating(false), 700);
    return () => clearTimeout(timer);
  }, [isProfileAnimating]);

  // Initial Profile Fetch via profileApi
  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const result = await profileApi.getProfile();
        if (isMounted && result.data) {
          const profileInputs = profileInputsRef.current;
          const hasPlaceholderLocation =
            result.data.location?.trim().toLowerCase() === "san francisco, california";
          const merged = {
            ...result.data,
            name: result.data.name || profileInputs.profileName || profileInputs.currentUser?.name || profileInputs.currentUser?.username || "User",
            email: result.data.email || profileInputs.currentUser?.email || "",
            photo: result.data.photo || profileInputs.profilePhoto || "",
            location: hasPlaceholderLocation ? "" : result.data.location || "",
          };
          setProfile(merged);
          if (hasPlaceholderLocation) {
            profileApi.updateProfile({ location: "" }).catch((error) => {
              console.warn("Could not clear the old default profile location.", error);
            });
          }
          if (merged.name && profileInputs.onProfileNameChange) {
            profileInputs.onProfileNameChange(merged.name);
          }
          if (merged.photo && profileInputs.onProfilePhotoChange) {
            profileInputs.onProfilePhotoChange(merged.photo);
          }
        }
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  // Location auto-lookup fallback (only if location is not already set)
  useEffect(() => {
    if (profile.location || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
          );

          if (!response.ok) return;

          const data = await response.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "";
          const state = data.address?.state || "";
          const nextLocation = [city, state].filter(Boolean).join(", ");

          if (nextLocation) {
            const result = await profileApi.updateProfile({
              location: nextLocation,
            });
            setProfile((prev) =>
              prev.location ? prev : { ...prev, ...result.data, location: nextLocation }
            );
          }
        } catch (error) {
          console.warn("Location reverse lookup failed", error);
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000,
      }
    );
  }, [profile.location]);

  // Update profile handler (persists via API and storage)
  const updateProfile = async (updatedProfile) => {
    setIsSaving(true);
    try {
      const res = await profileApi.updateProfile(updatedProfile);
      const saved = res.data || updatedProfile;
      setProfile(saved);
      if (saved.name && onProfileNameChange) {
        onProfileNameChange(saved.name);
      }
      if (saved.photo && onProfilePhotoChange) {
        onProfilePhotoChange(saved.photo);
      }
      setNotification({
        type: "success",
        message: "Profile updated successfully!",
      });
      setIsProfileAnimating(true);
    } catch (err) {
      console.error("Profile update failed:", err);
      setNotification({
        type: "error",
        message:
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to update profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Upload photo handler (persists via API and storage)
  const handlePhotoUpload = async (file, dataUrl) => {
    const previousPhoto = profile.photo;
    setIsSaving(true);
    setProfile((prev) => ({ ...prev, photo: dataUrl }));
    if (onProfilePhotoChange) onProfilePhotoChange(dataUrl);

    try {
      const res = await profileApi.uploadAvatar(file, dataUrl);
      const newPhoto = res.photo || dataUrl;
      setProfile((prev) => ({ ...prev, photo: newPhoto }));
      if (onProfilePhotoChange) onProfilePhotoChange(newPhoto);
      setNotification({
        type: "success",
        message: "Profile photo updated successfully!",
      });
      setIsProfileAnimating(true);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setProfile((prev) => ({ ...prev, photo: previousPhoto || "" }));
      if (onProfilePhotoChange) onProfilePhotoChange(previousPhoto || "");
      setNotification({
        type: "error",
        message: err.response?.data?.error || "Failed to save profile photo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Profile>
      <Profile.Header onBack={onBack} onLogout={onLogout} isSaving={isSaving} />

      {/* Floating Notification Toast */}
      {notification && (
        <aside
          className={`profile-notification-toast profile-toast-${notification.type}`}
          role="status"
          aria-live="polite"
        >
          <span className="profile-toast-message">{notification.message}</span>
          <button
            type="button"
            className="profile-toast-close"
            onClick={() => setNotification(null)}
            aria-label="Dismiss message"
          >
            <X size={14} />
          </button>
        </aside>
      )}

      <Profile.Layout>
        <Profile.Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          profile={profile}
          projectKey={projectKey}
        />

        <Profile.Content className={isProfileAnimating ? "profile-change-animation" : ""}>
          {isLoading ? (
            <div className="profile-loading-skeleton" role="status" aria-live="polite">
              <Loader2 className="profile-loading-spinner" size={32} />
              <p>Loading profile...</p>
            </div>
          ) : (
            <>
              {activeTab === "personal" && (
                <div key="personal" className="profile-tab-pane personal-info-pane">
                  <Profile.Hero
                    key={JSON.stringify([profile.name, profile.jobTitle, profile.mobile])}
                    profile={profile}
                    onUpdate={updateProfile}
                    onPhotoUpload={handlePhotoUpload}
                    isSaving={isSaving}
                  />

                  <div className="cards-grid">
                    <Profile.PersonalDetails
                      key={profile.location}
                      profile={profile}
                      onUpdate={updateProfile}
                      isSaving={isSaving}
                    />
                    <ProfileProjectSummaryCard tasks={tasks} projectKey={projectKey} />
                  </div>
                </div>
              )}

              {activeTab !== "personal" && (
                <div key={activeTab} className="profile-tab-pane settings-tab-pane">
                  <Profile.TabContent
                    activeTab={activeTab}
                    theme={theme}
                    onThemeChange={onThemeChange}
                    onLogout={onLogout}
                    currentUser={currentUser}
                  />
                </div>
              )}

            </>
          )}
        </Profile.Content>
      </Profile.Layout>
    </Profile>
  );
};

export default ProfilePage;
