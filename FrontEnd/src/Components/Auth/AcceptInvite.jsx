import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import authApi from './authApi';
import './SignIn/signin.css';

const roleLabels = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  user: 'User',
};

export default function AcceptInvite({ isAuthenticated, onInvitationAccepted, theme, onThemeToggle }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(() => token ? '' : 'This invitation link is missing its token.');
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (!token) return () => { isCurrent = false; };

    authApi.previewInvitation(token)
      .then(({ data }) => {
        if (isCurrent) setInvitation(data);
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(requestError.response?.data?.detail || 'This invitation link is invalid or expired.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError('');
    try {
      const { data } = await authApi.acceptInvitation(token);
      onInvitationAccepted(data.user);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to accept this invitation. Please try again.');
      setIsAccepting(false);
    }
  };

  const query = new URLSearchParams({ invite: token });
  if (invitation?.email) query.set('email', invitation.email);

  return (
    <div className="auth-wrapper" data-theme={theme}>
      {onThemeToggle && (
        <button type="button" className="auth-theme-toggle-btn" onClick={onThemeToggle}>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      )}
      <main className="auth-card invite-accept-card">
        <div className="auth-brand-badge"><span className="auth-brand-name">NEXUS</span></div>
        <div className="auth-card-header">
          <h1 className="auth-card-title">Join your Nexus team</h1>
          {isLoading ? (
            <p className="auth-card-subtitle">Checking your invitation…</p>
          ) : invitation ? (
            <p className="auth-card-subtitle">
              {invitation.email} was invited as <strong>{roleLabels[invitation.role] || invitation.role}</strong>.
            </p>
          ) : (
            <p className="auth-card-subtitle">This invitation cannot be used.</p>
          )}
        </div>
        {error && <div className="auth-alert-box auth-alert-danger" role="alert">{error}</div>}
        {invitation && !isAuthenticated && (
          <div className="invite-accept-actions">
            <button
              type="button"
              className="auth-btn-primary"
              onClick={() => navigate(`/signup?${query.toString()}`)}
            >
              Create account and accept
            </button>
            <Link className="invite-signin-link" to={`/signin?invite=${encodeURIComponent(token)}`}>
              Already have an account? Sign in to accept
            </Link>
          </div>
        )}
        {invitation && isAuthenticated && (
          <button
            type="button"
            className="auth-btn-primary"
            onClick={handleAccept}
            disabled={isAccepting}
          >
            {isAccepting ? 'Accepting…' : 'Accept invitation'}
          </button>
        )}
      </main>
    </div>
  );
}
