import { useEffect, useRef, useState } from "react";
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
  <div className="profile-page">{children}</div>
);

Profile.Sidebar = ({ activeTab, setActiveTab }) => {
  const settingsOpen = activeTab !== "personal";

  return (
    <aside className="profile-sidebar">
      <button
        className={`sidebar-item ${activeTab === "personal" ? "active" : ""}`}
        onClick={() => setActiveTab("personal")}
      >
        <User size={19} />
        <span>Personal info</span>
      </button>
      <button
        className={`sidebar-item settings-parent ${settingsOpen ? "active" : ""}`}
        onClick={() => setActiveTab(settingsOpen ? "personal" : "basic")}
        aria-expanded={settingsOpen}
      >
        <Settings size={19} />
        <span>General settings</span>
      </button>
      {settingsOpen && (
        <nav className="profile-subsidebar" aria-label="General settings">
          {[
            { id: "basic", label: "Basic settings", icon: <SlidersHorizontal size={18} /> },
            { id: "notifications", label: "Notification settings", icon: <Bell size={18} /> },
            { id: "language", label: "Language & region", icon: <Globe2 size={18} /> },
            { id: "password", label: "Password", icon: <Lock size={18} /> },
            { id: "session", label: "Session history", icon: <List size={18} /> },
          ].map((item) => (
            <button
              key={item.id}
              className={`sidebar-item subsidebar-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
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
          <div className="profile-avatar">
            {profile.photo ? (
              <img src={profile.photo} alt={profile.name} className="profile-avatar-image" />
            ) : (
              <div className="avatar-fallback">{profile.name?.charAt(0) || "U"}</div>
            )}
          </div>

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
              <div className="mobile-number-editor">
                <input
                  type="tel"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="e.g. +1 555-0199"
                  aria-label="Mobile phone number"
                  autoFocus
                />
                <button type="button" onClick={saveMobile} aria-label="Save mobile number" title="Save">
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobile(profile.mobile || "");
                    setEditingMobile(false);
                  }}
                  aria-label="Cancel mobile number edit"
                  title="Cancel"
                >
                  <X size={15} />
                </button>
              </div>
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

        <Profile.InfoItem
          icon={<MapPin size={18} />}
          title="Location"
          value={profile.location ? formatLocation(profile.location) : "Add a location"}
          empty={!profile.location}
        />
      </div>
    </div>
  );
};

Profile.Hero = ProfileHero;

Profile.InfoItem = ({ icon, title, value, empty }) => {
  return (
    <div className="info-item">
      <div className="info-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p className={empty ? "empty-info" : ""}>{value}</p>
      </div>
    </div>
  );
};

Profile.Card = ({ children, className = "" }) => (
  <div className={`profile-card ${className}`}>{children}</div>
);

const ProfilePersonalDetails = ({ profile, taskCount, onUpdate, isSaving }) => {
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState(profile.location || "");

  const saveLocation = () => {
    onUpdate({ ...profile, location: locationInput.trim() });
    setEditingLocation(false);
  };

  return (
    <Profile.Card className="details-card">
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

      <div className="task-count-box">
        <ListChecks size={22} />
        <div>
          <span>Task count</span>
          <strong>{taskCount} tasks</strong>
          <small>Across your Kanban board</small>
        </div>
      </div>
    </Profile.Card>
  );
};

Profile.PersonalDetails = ProfilePersonalDetails;

const ProfileProjectSummaryCard = ({ tasks, projectKey }) => {
  const completedTasks = tasks.filter((task) => task.status === "Done").length;
  return (
    <Profile.Card className="project-summary-card">
      <header className="project-summary-header">
        <div className="project-summary-icon"><FolderKanban size={22} /></div>
        <div>
          <span>Project summary</span>
          <h2>{projectKey}</h2>
        </div>
      </header>
      <div className="project-summary-stats">
        <div>
          <ListChecks size={19} />
          <span>Total tasks</span>
          <strong>{tasks.length}</strong>
        </div>
        <div>
          <CircleCheck size={19} />
          <span>Completed</span>
          <strong>{completedTasks}</strong>
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
    language: "Language & region",
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
        <Profile.Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <Profile.Content className={isProfileAnimating ? "profile-change-animation" : ""}>
          {isLoading ? (
            <div className="profile-loading-skeleton" role="status" aria-live="polite">
              <Loader2 className="profile-loading-spinner" size={32} />
              <p>Loading profile...</p>
            </div>
          ) : (
            <>
              {activeTab === "personal" && (
                <>
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
                      taskCount={tasks.length}
                      onUpdate={updateProfile}
                      isSaving={isSaving}
                    />
                    <ProfileProjectSummaryCard tasks={tasks} projectKey={projectKey} />
                  </div>

                </>
              )}

              <Profile.TabContent
                activeTab={activeTab}
                theme={theme}
                onThemeChange={onThemeChange}
                onLogout={onLogout}
                currentUser={currentUser}
              />

            </>
          )}
        </Profile.Content>
      </Profile.Layout>
    </Profile>
  );
};

export default ProfilePage;
