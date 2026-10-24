import { useState, useEffect, useMemo, useCallback } from 'react';
import './GoogleAuthModal.css';
import {
  validateGoogleAccountInput,
  isStrictValidGoogleEmail,
} from './googleAuthUtils';

// Google 4-color "G" Icon
const GoogleGIcon = () => (
  <svg className="google-auth-g-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.37 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

// Jira Logo for the Left Side App Icon
const AppJiraLogo = () => (
  <svg className="google-auth-app-logo" viewBox="0 0 28 28" width="36" height="36" fill="none" aria-hidden="true">
    <path
      d="M13.45 2.33c0 2.8-2.27 5.07-5.07 5.07H3.29C1.47 7.4 0 8.87 0 10.7v5.07c0 2.8 2.27 5.07 5.07 5.07h5.07c2.8 0 5.07-2.27 5.07-5.07V2.33h-1.77z"
      fill="#0052CC"
    />
    <path
      d="M14.55 2.33c0 2.8 2.27 5.07 5.07 5.07h5.07C26.51 7.4 28 8.87 28 10.7v5.07c0 2.8-2.27 5.07-5.07 5.07h-5.07c-2.8 0-5.07-2.27-5.07-5.07V2.33h1.77z"
      fill="#2684FF"
    />
  </svg>
);

// User in Circle Icon for "Use another account"
const UserCircleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#444746" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 14c-3.1 0-5.5 1.8-6 4" />
    <circle cx="12" cy="9" r="3" />
  </svg>
);

// Close button icon
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Trash / Remove icon for removing saved mail ID
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// Default Primary Account matching user's exact screenshot
const DEFAULT_ACCOUNT = {
  name: 'Sivakumar',
  email: 'sivakumarluxmorchn@gmail.com',
  avatarBg: '#137333', // Exact Google dark green
  initial: 'S',
};

const GoogleAuthModal = ({
  isOpen,
  onClose,
  onSelectAccount,
  appName = 'Jira',
  appDomain = 'jira.com',
  currentEmail = '',
}) => {
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customError, setCustomError] = useState('');
  const [modalError, setModalError] = useState('');
  const [language, setLanguage] = useState('English (United States)');
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Accounts list initialized with default account
  const [savedAccounts, setSavedAccounts] = useState(() => [DEFAULT_ACCOUNT]);
  const [dismissedAccountEmails, setDismissedAccountEmails] = useState([]);
  const accounts = useMemo(() => {
    const visibleAccounts = savedAccounts.filter(
      (account) => !dismissedAccountEmails.includes(account.email.toLowerCase())
    );
    if (!currentEmail || !isStrictValidGoogleEmail(currentEmail)) {
      return visibleAccounts;
    }

    const email = currentEmail.trim();
    const emailLower = email.toLowerCase();
    if (visibleAccounts.some((account) => account.email.toLowerCase() === emailLower)) {
      return visibleAccounts;
    }

    const namePart = email.split('@')[0];
    return [
      ...visibleAccounts,
      {
        name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
        email,
        avatarBg: '#1a73e8',
        initial: namePart.charAt(0).toUpperCase(),
      },
    ];
  }, [savedAccounts, dismissedAccountEmails, currentEmail]);

  const handleClose = useCallback(() => {
    setCustomError('');
    setModalError('');
    setShowAddAccount(false);
    setIsProcessing(false);
    setSelectedEmail(null);
    onClose();
  }, [onClose]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isProcessing, handleClose]);

  if (!isOpen) return null;

  const handleAccountClick = (account) => {
    if (isProcessing) return;

    // Strict validation of the clicked account email
    const validation = validateGoogleAccountInput(account.email);
    if (!validation.isValid) {
      setModalError(validation.error || "Couldn't find your Google Account");
      return;
    }

    setModalError('');
    setSelectedEmail(account.email);
    setIsProcessing(true);

    // Authentic slight delay simulating Google OAuth token generation & redirect
    setTimeout(() => {
      setIsProcessing(false);
      onSelectAccount(account);
    }, 700);
  };

  const handleCustomAccountSubmit = (e) => {
    e.preventDefault();
    setCustomError('');
    setModalError('');

    // Strict validation against invalid mail IDs, fake domains, malformed strings
    const validation = validateGoogleAccountInput(customEmail);
    if (!validation.isValid) {
      setCustomError(validation.error);
      return;
    }

    const newAccount = {
      name: validation.name || validation.email.split('@')[0],
      email: validation.email,
      avatarBg: '#1a73e8',
      initial: (validation.name || validation.email).charAt(0).toUpperCase(),
    };

    setSavedAccounts((prev) => [
      ...prev.filter((a) => a.email.toLowerCase() !== newAccount.email.toLowerCase()),
      newAccount,
    ]);
    setDismissedAccountEmails((prev) =>
      prev.filter((email) => email !== newAccount.email.toLowerCase())
    );

    setShowAddAccount(false);
    setCustomEmail('');
    handleAccountClick(newAccount);
  };

  const handleRemoveAccount = (e, emailToRemove) => {
    e.stopPropagation();
    if (isProcessing) return;

    const emailLower = emailToRemove.toLowerCase();

    // Remove from in-memory accounts state
    setSavedAccounts((prev) => prev.filter((a) => a.email.toLowerCase() !== emailLower));
    setDismissedAccountEmails((prev) => [...new Set([...prev, emailLower])]);
    setModalError('');
  };

  return (
    <div
      className="google-auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-auth-heading"
      onClick={() => {
        if (!isProcessing) handleClose();
      }}
    >
      <div
        className="google-auth-dialog-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Card with 2-Column Google Identity Services Layout */}
        <div className="google-auth-card">
          {/* Top Animated Progress Bar on Account Click */}
          {isProcessing && (
            <div className="google-auth-progressbar" role="progressbar" aria-label="Authenticating with Google">
              <div className="google-auth-progressbar-bar" />
            </div>
          )}

          {/* Top Bar: Google G Icon + 'Sign in with Google' + Close Button */}
          <div className="google-auth-top-bar">
            <div className="google-auth-brand-badge">
              <GoogleGIcon />
              <span className="google-auth-brand-title">Sign in with Google</span>
            </div>

            <button
              type="button"
              className="google-auth-close-btn"
              onClick={handleClose}
              disabled={isProcessing}
              aria-label="Close dialog"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Main 2-Column Body */}
          <div className="google-auth-body">
            {/* Left Column: App Icon, Headline, Subtitle */}
            <div className="google-auth-left">
              <div className="google-auth-app-icon-wrapper">
                <AppJiraLogo />
              </div>

              <h1 id="google-auth-heading" className="google-auth-headline">
                Choose an account
              </h1>

              <p className="google-auth-subheadline">
                to continue to <span className="google-auth-app-name">{appDomain || appName}</span>
              </p>
            </div>

            {/* Right Column: Account List & Privacy Notice */}
            <div className="google-auth-right">
              {modalError && (
                <div className="google-auth-global-error" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#b3261e" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}
              <div className="google-auth-accounts-box">
                {/* Empty State when all accounts are removed */}
                {accounts.length === 0 && (
                  <div className="google-auth-no-accounts">
                    <span>No saved accounts</span>
                  </div>
                )}

                {/* List of accounts with remove button */}
                {accounts.map((acc) => {
                  const isSelected = selectedEmail === acc.email && isProcessing;
                  return (
                    <div key={acc.email} className="google-auth-account-wrapper">
                      <div className={`google-auth-account-item ${isSelected ? 'google-auth-account-item-selected' : ''}`}>
                        <button
                          type="button"
                          className={`google-auth-account-row ${isSelected ? 'google-auth-account-row-selected' : ''}`}
                          onClick={() => handleAccountClick(acc)}
                          disabled={isProcessing}
                          title={`Sign in as ${acc.name} (${acc.email})`}
                        >
                          <div
                            className="google-auth-avatar"
                            style={{ backgroundColor: acc.avatarBg || '#137333' }}
                          >
                            {acc.initial || acc.name?.charAt(0) || 'U'}
                          </div>

                          <div className="google-auth-account-meta">
                            <span className="google-auth-user-name">{acc.name}</span>
                            <span className="google-auth-user-email">{acc.email}</span>
                          </div>

                          {isSelected && (
                            <div className="google-auth-row-spinner" aria-hidden="true" />
                          )}
                        </button>

                        {!isProcessing && (
                          <button
                            type="button"
                            className="google-auth-remove-account-btn"
                            onClick={(e) => handleRemoveAccount(e, acc.email)}
                            title={`Remove ${acc.email}`}
                            aria-label={`Remove saved mail id ${acc.email}`}
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                      <div className="google-auth-divider" />
                    </div>
                  );
                })}

                {/* 'Use another account' Row or Custom Email Form */}
                {!showAddAccount ? (
                  <div className="google-auth-account-wrapper">
                    <button
                      type="button"
                      className="google-auth-account-row"
                      onClick={() => {
                        setShowAddAccount(true);
                        setCustomError('');
                      }}
                      disabled={isProcessing}
                    >
                      <div className="google-auth-avatar-icon">
                        <UserCircleIcon />
                      </div>

                      <div className="google-auth-account-meta">
                        <span className="google-auth-action-label">Use another account</span>
                      </div>
                    </button>
                    <div className="google-auth-divider" />
                  </div>
                ) : (
                  <form
                    className="google-auth-custom-form"
                    onSubmit={handleCustomAccountSubmit}
                    noValidate
                  >
                    <div className="google-auth-input-group">
                      <label htmlFor="google-custom-email-input" className="google-auth-input-label">
                        Email or phone
                      </label>
                      <input
                        id="google-custom-email-input"
                        type="text"
                        className={`google-auth-input-field ${customError ? 'google-auth-input-error' : ''}`}
                        placeholder="Enter email or phone"
                        value={customEmail}
                        onChange={(e) => {
                          setCustomEmail(e.target.value);
                          if (customError) setCustomError('');
                        }}
                        autoFocus
                        disabled={isProcessing}
                      />
                      {customError && (
                        <div className="google-auth-input-error-msg">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" stroke="#fff" strokeWidth="2" />
                            <line x1="12" y1="16" x2="12.01" y2="16" stroke="#fff" strokeWidth="2" />
                          </svg>
                          <span>{customError}</span>
                        </div>
                      )}
                    </div>

                    <div className="google-auth-custom-actions">
                      <button
                        type="button"
                        className="google-auth-btn-text"
                        onClick={() => {
                          setShowAddAccount(false);
                          setCustomError('');
                        }}
                        disabled={isProcessing}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="google-auth-btn-pill"
                        disabled={!customEmail.trim() || isProcessing}
                      >
                        Next
                      </button>
                    </div>
                    <div className="google-auth-divider" style={{ marginTop: '16px' }} />
                  </form>
                )}
              </div>

              {/* Privacy Notice Exactly as in Google Sign In */}
              <div className="google-auth-disclaimer">
                <span>
                  Before using this app, you can review {appName}&apos;s{' '}
                  <a
                    href="#privacy"
                    className="google-auth-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a
                    href="#terms"
                    className="google-auth-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    Terms of Service
                  </a>
                  .
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Outside Card: Language Selector & Google Links */}
        <div className="google-auth-footer-bar">
          <div className="google-auth-lang-selector-container">
            <button
              type="button"
              className="google-auth-lang-btn"
              onClick={() => setShowLangMenu(!showLangMenu)}
              aria-haspopup="listbox"
              aria-expanded={showLangMenu}
            >
              <span>{language}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            {showLangMenu && (
              <div className="google-auth-lang-menu" role="listbox">
                {[
                  'English (United States)',
                  'English (United Kingdom)',
                  'Español (España)',
                  'Français (France)',
                  'Deutsch',
                  '日本語',
                  'தமிழ்',
                  'हिन्दी',
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`google-auth-lang-option ${item === language ? 'active' : ''}`}
                    onClick={() => {
                      setLanguage(item);
                      setShowLangMenu(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="google-auth-footer-links">
            <a
              href="https://support.google.com/accounts?hl=en"
              target="_blank"
              rel="noreferrer"
              className="google-auth-footer-link"
            >
              Help
            </a>
            <a
              href="https://policies.google.com/privacy?hl=en"
              target="_blank"
              rel="noreferrer"
              className="google-auth-footer-link"
            >
              Privacy
            </a>
            <a
              href="https://policies.google.com/terms?hl=en"
              target="_blank"
              rel="noreferrer"
              className="google-auth-footer-link"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleAuthModal;
