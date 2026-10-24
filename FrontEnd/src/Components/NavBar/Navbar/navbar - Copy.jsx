import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Search,
  Settings,
  LogIn,
  UserPlus,
  LogOut,
  User,
  X,
} from "lucide-react";

import NotificationSettings from "../Settings/Notification/notifysettings";
import IntegrateButton from "../Integrate/integrate";

import "./navbar.css";

const appSearchOptions = [
  "Home",
  "Inbox",
  "My tasks",
  "Backlog",
  "Projects",
  "Portfolios",
  "Reporting",
  "Resourcing",
];

const Navbar = ({
  onMenuClick,
  onProfileClick,
  onSettingsClick,
  profileName,
  profilePhoto,
  currentUser,
  isAuthenticated = true,
  theme = "dark",
  onThemeChange,
  onHomeClick,
  onSignInClick,
  onSignUpClick,
  onSignOutClick,
  onSelectSuggestion,
  onCreateClick,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const searchRef = useRef(null);
  const profileMenuRef = useRef(null);

  const profileInitials = profileName
    ?.trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const searchSuggestions = appSearchOptions.filter((option) => (
    option.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ));

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };

    const handleGlobalKeyDown = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  const chooseSearchSuggestion = (suggestion) => {
    setSearchQuery(suggestion);
    setSearchOpen(false);
    setActiveSuggestion(0);
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (!searchOpen || searchSuggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((index) => (index + 1) % searchSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((index) => (index - 1 + searchSuggestions.length) % searchSuggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseSearchSuggestion(searchSuggestions[activeSuggestion] ?? searchSuggestions[0]);
    }
  };

  return (
    <header className="top-navbar" data-theme={theme}>
      <div className="nav-left">
        <button
          className="menu-btn"
          onClick={onMenuClick}
          aria-label="Toggle menu"
          title="Toggle menu"
        >
          <Menu size={22} />
        </button>
        <button
          type="button"
          className="nav-brand-btn"
          onClick={onHomeClick || (() => onSelectSuggestion?.("Home"))}
          title="Nexus Workspace Home"
          aria-label="Nexus Workspace Home"
        >
          <span className="brand-logo-icon">✦</span>
          <span className="brand-name">Nexus</span>
        </button>
      </div>

      <div className="nav-search-create">
        <div className="nav-search-autocomplete" ref={searchRef}>
          <div className="search-box">
            <Search size={18} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              role="combobox"
              aria-label="Search the app"
              aria-autocomplete="list"
              aria-expanded={searchOpen && searchSuggestions.length > 0}
              aria-controls="app-search-suggestions"
              aria-activedescendant={searchOpen ? `app-search-option-${activeSuggestion}` : undefined}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveSuggestion(0);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  setActiveSuggestion(0);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchOpen && searchSuggestions.length > 0 && (
            <div id="app-search-suggestions" className="nav-search-suggestions" role="listbox">
              {searchSuggestions.map((suggestion, index) => (
                <button
                  id={`app-search-option-${index}`}
                  key={suggestion}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  className={activeSuggestion === index ? "active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSearchSuggestion(suggestion)}
                >
                  <Search size={14} aria-hidden="true" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="nav-actions">
        {!isAuthenticated ? (
          <div className="nav-guest-actions">
            <button
              id="nav-signin-btn"
              className="nav-auth-btn nav-signin-btn"
              onClick={onSignInClick}
              title="Log in to your account"
            >
              <LogIn size={15} />
              <span>Log In</span>
            </button>
            <button
              id="nav-signup-btn"
              className="nav-auth-btn nav-signup-btn"
              onClick={onSignUpClick}
              title="Create a new account"
            >
              <UserPlus size={15} />
              <span>Sign Up</span>
            </button>
            <button
              className="nav-icon-btn"
              aria-label="Settings"
              title="Settings"
              onClick={onSettingsClick}
            >
              <Settings size={20} />
            </button>
          </div>
        ) : (
          <>
            <NotificationSettings theme={theme} />

            <IntegrateButton theme={theme} />

            <button
              className="nav-icon-btn"
              aria-label="Settings"
              title="Settings"
              onClick={onSettingsClick}
            >
              <Settings size={20} />
            </button>

            <div className="nav-profile-container" ref={profileMenuRef}>
              <button
                id="nav-profile-menu-trigger"
                className={`profile-button ${profileMenuOpen ? "active" : ""}`}
                aria-label="Profile and account options"
                title={`Profile: ${profileName}`}
                aria-expanded={profileMenuOpen}
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setSearchOpen(false);
                }}
              >
                {profilePhoto ? (
                  <img className="profile-button-image" src={profilePhoto} alt="" />
                ) : (
                  profileInitials
                )}
              </button>

              {profileMenuOpen && (
                <div className="nav-profile-dropdown" data-theme={theme} role="menu">
                  <div className="profile-dropdown-user-card">
                    <div className="profile-dropdown-avatar">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="" />
                      ) : (
                        profileInitials
                      )}
                    </div>
                    <div className="profile-dropdown-user-details">
                      <span className="profile-dropdown-name">{profileName}</span>
                      <span className="profile-dropdown-email">
                        {currentUser?.email || "user@nexusapp.io"}
                      </span>
                    </div>
                  </div>

                  <div className="profile-dropdown-divider" />

                  <button
                    className="profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onProfileClick();
                    }}
                  >
                    <User size={16} />
                    <span>My Profile</span>
                  </button>

                  <button
                    className="profile-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSettingsClick();
                    }}
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                  </button>

                  <div className="profile-dropdown-divider" />

                  <button
                    id="nav-dropdown-logout-btn"
                    className="profile-dropdown-item profile-dropdown-logout"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      if (onSignOutClick) onSignOutClick();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;