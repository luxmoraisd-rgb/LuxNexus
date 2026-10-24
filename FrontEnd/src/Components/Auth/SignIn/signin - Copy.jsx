import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import authApi, { API_BASE_URL } from '../authApi';
import GoogleAuthModal from '../GoogleAuthModal';
import { validateGoogleAccountInput } from '../googleAuthUtils';
import './signin.css';

const GoogleIcon = () => (
  <svg className="auth-sso-icon" viewBox="0 0 24 24" aria-hidden="true">
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

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckIcon = () => (
  <svg className="auth-checkbox-tick" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="2 6 5 9 10 3" />
  </svg>
);

const DecorativeBackgroundLeft = () => (
  <svg
    className="auth-bg-art auth-bg-art-left"
    viewBox="0 0 340 380"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M-40 380C30 330 110 350 170 300C230 250 240 180 270 120C290 80 270 30 230 0L-40 0V380Z"
      fill="#DEEBFF"
      fillOpacity="0.45"
    />
    <path
      d="M-20 380C40 350 90 320 140 280C200 230 210 160 250 90L-20 20V380Z"
      fill="#B3D4FF"
      fillOpacity="0.35"
    />
    <circle cx="210" cy="190" r="14" fill="#0052CC" fillOpacity="0.12" />
    <circle cx="270" cy="90" r="8" fill="#2684FF" fillOpacity="0.2" />
    <path
      d="M70 210L110 250M110 210L70 250"
      stroke="#4C9AFF"
      strokeWidth="3"
      strokeLinecap="round"
      strokeOpacity="0.3"
    />
  </svg>
);

const DecorativeBackgroundRight = () => (
  <svg
    className="auth-bg-art auth-bg-art-right"
    viewBox="0 0 340 380"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M380 380C310 320 230 350 170 290C110 230 100 150 70 90C50 50 70 10 110 -20L380 -20V380Z"
      fill="#EAE6FF"
      fillOpacity="0.5"
    />
    <path
      d="M360 380C300 340 250 310 200 260C140 200 130 130 90 70L360 10V380Z"
      fill="#C0B6F2"
      fillOpacity="0.25"
    />
    <circle cx="130" cy="170" r="16" fill="#6554C0" fillOpacity="0.12" />
    <circle cx="70" cy="80" r="10" fill="#0052CC" fillOpacity="0.15" />
    <rect
      x="170"
      y="220"
      width="24"
      height="24"
      rx="4"
      transform="rotate(25 170 220)"
      fill="#0052CC"
      fillOpacity="0.1"
    />
  </svg>
);

const navigateTo = (url) => {
  if (typeof window !== 'undefined' && url) {
    window.location.assign(url);
  }
};

const DelayedPasswordInput = ({
  value: controlledValue,
  onChange,
  type = 'password',
  delay = 1000,
  maskChar = '•',
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  onSelect,
  onPointerUp,
  onCopy,
  onCut,
  className = '',
  style,
  ...restProps
}) => {
  const isPlainText = type === 'text';
  const realValueRef = useRef(String(controlledValue ?? ''));
  const [displayValue, setDisplayValue] = useState(() =>
    isPlainText ? realValueRef.current : maskChar.repeat(realValueRef.current.length)
  );
  const inputRef = useRef(null);
  const lastSelRef = useRef({ start: realValueRef.current.length, end: realValueRef.current.length });
  const targetCursorRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const stringVal = String(controlledValue ?? '');
    if (stringVal !== realValueRef.current) {
      realValueRef.current = stringVal;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDisplayValue(isPlainText ? stringVal : maskChar.repeat(stringVal.length));
    }
  }, [controlledValue, isPlainText, maskChar]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDisplayValue(isPlainText ? realValueRef.current : maskChar.repeat(realValueRef.current.length));
  }, [isPlainText, maskChar]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (targetCursorRef.current !== null && inputRef.current && document.activeElement === inputRef.current) {
      const pos = targetCursorRef.current;
      try {
        inputRef.current.setSelectionRange(pos, pos);
        lastSelRef.current = { start: pos, end: pos };
      } catch {}
      targetCursorRef.current = null;
    }
  }, [displayValue]);

  const recordSel = (e) => {
    if (e.target && typeof e.target.selectionStart === 'number') {
      lastSelRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd ?? e.target.selectionStart };
    }
  };

  const handleBlur = (e) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isPlainText && realValueRef.current) {
      setDisplayValue(maskChar.repeat(realValueRef.current.length));
    }
    if (onBlur) onBlur(e);
  };

  const handleChange = (e) => {
    const inputVal = e.target.value;
    const nativeEvent = e.nativeEvent || {};

    if (isPlainText) {
      realValueRef.current = inputVal;
      setDisplayValue(inputVal);
      if (onChange) onChange(e);
      return;
    }

    let newReal = '';
    let visibleIndex = -1;

    if (!inputVal) {
      newReal = '';
      visibleIndex = -1;
    } else if (nativeEvent.inputType === 'insertText' && typeof nativeEvent.data === 'string') {
      const start = Math.min(lastSelRef.current.start, realValueRef.current.length);
      const end = Math.min(lastSelRef.current.end, realValueRef.current.length);
      newReal = realValueRef.current.slice(0, start) + nativeEvent.data + realValueRef.current.slice(end);
      visibleIndex = start + nativeEvent.data.length - 1;
    } else if (nativeEvent.inputType === 'deleteContentBackward') {
      let start = lastSelRef.current.start;
      let end = lastSelRef.current.end;
      if (start === end) start = Math.max(0, start - 1);
      newReal = realValueRef.current.slice(0, start) + realValueRef.current.slice(end);
      visibleIndex = -1;
    } else if (nativeEvent.inputType === 'deleteContentForward' || nativeEvent.inputType === 'deleteByCut') {
      let start = lastSelRef.current.start;
      let end = lastSelRef.current.end;
      if (start === end && nativeEvent.inputType === 'deleteContentForward') end = Math.min(realValueRef.current.length, end + 1);
      newReal = realValueRef.current.slice(0, start) + realValueRef.current.slice(end);
      visibleIndex = -1;
    } else if (!inputVal.includes(maskChar)) {
      if (inputVal.length === realValueRef.current.length + 1) {
        const idx = typeof e.target.selectionEnd === 'number' ? e.target.selectionEnd - 1 : inputVal.length - 1;
        newReal = inputVal;
        visibleIndex = Math.max(0, idx);
      } else {
        newReal = inputVal;
        visibleIndex = -1;
      }
    } else {
      const selStart = Math.min(lastSelRef.current.start, realValueRef.current.length);
      const selEnd = Math.min(lastSelRef.current.end, realValueRef.current.length);
      const selLen = selEnd - selStart;
      const oldLen = displayValue.length;
      const newLen = inputVal.length;

      if (selLen > 0) {
        const insCount = (newLen - oldLen) + selLen;
        if (insCount > 0) {
          const insChars = inputVal.slice(selStart, selStart + insCount);
          newReal = realValueRef.current.slice(0, selStart) + insChars + realValueRef.current.slice(selEnd);
          visibleIndex = selStart + insChars.length - 1;
        } else {
          newReal = realValueRef.current.slice(0, selStart) + realValueRef.current.slice(selEnd);
          visibleIndex = -1;
        }
      } else if (newLen > oldLen) {
        const addedCount = newLen - oldLen;
        const insEnd = typeof e.target.selectionEnd === 'number' && e.target.selectionEnd >= addedCount ? e.target.selectionEnd : newLen;
        const insStart = insEnd - addedCount;
        const insChars = inputVal.slice(insStart, insEnd);
        newReal = realValueRef.current.slice(0, insStart) + insChars + realValueRef.current.slice(insStart);
        visibleIndex = insStart + insChars.length - 1;
      } else if (newLen < oldLen) {
        const delCount = oldLen - newLen;
        const delEnd = typeof e.target.selectionEnd === 'number' ? e.target.selectionEnd + delCount : realValueRef.current.length;
        const delStart = typeof e.target.selectionEnd === 'number' ? e.target.selectionEnd : realValueRef.current.length - delCount;
        newReal = realValueRef.current.slice(0, Math.max(0, delStart)) + realValueRef.current.slice(Math.min(realValueRef.current.length, delEnd));
        visibleIndex = -1;
      } else {
        newReal = realValueRef.current;
        visibleIndex = -1;
      }
    }

    realValueRef.current = newReal;
    targetCursorRef.current = e.target.selectionEnd ?? newReal.length;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (visibleIndex >= 0 && visibleIndex < newReal.length) {
      const peek = maskChar.repeat(visibleIndex) + newReal[visibleIndex] + maskChar.repeat(newReal.length - visibleIndex - 1);
      setDisplayValue(peek);
      timerRef.current = setTimeout(() => {
        if (inputRef.current && document.activeElement === inputRef.current) {
          targetCursorRef.current = inputRef.current.selectionEnd ?? inputRef.current.selectionStart;
        }
        setDisplayValue(maskChar.repeat(realValueRef.current.length));
        timerRef.current = null;
      }, delay);
    } else {
      setDisplayValue(maskChar.repeat(newReal.length));
    }

    if (onChange) {
      onChange({
        ...e,
        target: { ...e.target, value: newReal },
        currentTarget: { ...e.currentTarget, value: newReal }
      });
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={(e) => { recordSel(e); onKeyDown?.(e); }}
      onKeyUp={(e) => { recordSel(e); onKeyUp?.(e); }}
      onSelect={(e) => { recordSel(e); onSelect?.(e); }}
      onPointerUp={(e) => { recordSel(e); onPointerUp?.(e); }}
      onFocus={(e) => { recordSel(e); onFocus?.(e); }}
      onBlur={handleBlur}
      onCopy={(e) => { if (!isPlainText) e.preventDefault(); onCopy?.(e); }}
      onCut={(e) => { if (!isPlainText) e.preventDefault(); onCut?.(e); }}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      data-password-type="true"
      className={className}
      style={{
        fontFamily: 'inherit',
        letterSpacing: !isPlainText ? '0.08em' : 'normal',
        ...style
      }}
      {...restProps}
    />
  );
};

const Signin = ({
  onNavigateToSignup,
  onNavigateToForgotPassword,
  onLoginSuccess,
  theme = 'dark',
  onThemeToggle,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const handleRememberMeChange = (e) => {
    setRememberMe(e.target.checked);
  };

  const validateEmail = (val) => {
    if (!val || !val.trim()) {
      return 'Email address is required.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) {
      return 'Please enter a valid work email address.';
    }
    return '';
  };

  const validatePassword = (val) => {
    if (!val) {
      return 'Password is required.';
    }
    if (val.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);

    if (emailErr || passErr) {
      setFieldErrors({
        email: emailErr,
        password: passErr,
      });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
     
      const response = await authApi.signin({
        email: email.trim(),
        username: email.trim(),
        password,
        rememberMe,
      });

      const data = response.data;
      const token = data.token || data.accessToken || data.jwt || 'active-session-token';
      const user = data.user || data.data?.user || { email: email.trim(), name: email.trim().split('@')[0] };

      
      if (token) {
        sessionStorage.setItem('token', token);
      }
      if (user) {
        sessionStorage.setItem('user', JSON.stringify(user));
      }
      if (data.ip) {
        sessionStorage.setItem('session_ip', data.ip);
      }
      sessionStorage.setItem('session_login_time', new Date().toISOString());

      setIsLoading(false);
      setAuthSuccess('Welcome back! Successfully logged in. Redirecting to home...');

      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(data);
        } else {
          navigateTo('/home');
        }
      }, 700);
    } catch (err) {
      setIsLoading(false);
      const isNetworkErr = err.code === 'ERR_NETWORK' || !err.response;
      const resData = err.response?.data;
      const rawError =
        resData?.error ||
        resData?.message ||
        resData?.detail ||
        (Array.isArray(resData?.email) ? resData.email[0] : resData?.email) ||
        (Array.isArray(resData?.non_field_errors) ? resData.non_field_errors[0] : resData?.non_field_errors) ||
        (Array.isArray(resData?.password) ? resData.password[0] : resData?.password);

      const errorMessage =
        rawError ||
        (isNetworkErr
          ? 'Backend server is currently unreachable'
          : 'Login failed. Please check your credentials.');

      setAuthError(errorMessage);

      if (
        resData?.email ||
        (errorMessage && errorMessage.toLowerCase().includes('not registered'))
      ) {
        const emailMsg =
          (Array.isArray(resData?.email) ? resData.email[0] : resData?.email) ||
          errorMessage;
        setFieldErrors((prev) => ({ ...prev, email: emailMsg }));
      } else if (
        resData?.password ||
        (errorMessage && errorMessage.toLowerCase().includes('password'))
      ) {
        const passMsg =
          (Array.isArray(resData?.password) ? resData.password[0] : resData?.password) ||
          errorMessage;
        setFieldErrors((prev) => ({ ...prev, password: passMsg }));
      }
    }
  };

  const handleOpenGoogleChooser = () => {
    setAuthError('');
    setShowGoogleChooser(true);
  };

  const handleSelectGoogleAccount = async (selectedAccount) => {
    setAuthError('');
    setAuthSuccess('');

    
    const validation = validateGoogleAccountInput(selectedAccount?.email);
    if (!validation.isValid) {
      setShowGoogleChooser(false);
      setIsGoogleLoading(false);
      setAuthError(validation.error || "Couldn't find your Google Account. Please enter a valid Google Account email.");
      return;
    }

    setShowGoogleChooser(false);
    setIsGoogleLoading(true);

    try {
      
      const googleOAuthUrl = import.meta.env.VITE_GOOGLE_AUTH_URL;
      if (googleOAuthUrl) {
        navigateTo(googleOAuthUrl);
        return;
      }

      
      const res = await authApi.googleAuth({
        email: validation.email,
        name: selectedAccount.name || validation.name,
        provider: 'google',
      });

      const googleData = res.data;
      const token = googleData?.token || googleData?.accessToken || googleData?.jwt;
      const user = googleData?.user || googleData?.data?.user || {
        name: selectedAccount.name || validation.name,
        email: validation.email,
        provider: 'google',
      };

      if (token) {
        sessionStorage.setItem('token', token);
      }
      if (user) {
        sessionStorage.setItem('user', JSON.stringify(user));
      }
      if (googleData?.ip) {
        sessionStorage.setItem('session_ip', googleData.ip);
      }
      sessionStorage.setItem('session_login_time', new Date().toISOString());


      setIsGoogleLoading(false);
      setAuthSuccess(`Signed in with Google as ${user.name || user.email}! Redirecting to home...`);

      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(googleData);
        } else {
          navigateTo('/home');
        }
      }, 700);
    } catch (err) {
      setIsGoogleLoading(false);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.code === 'ERR_NETWORK'
          ? 'Backend server is currently unreachable'
          : 'Google sign in failed. Please try again.');
      setAuthError(errorMessage);
    }
  };

  const handleSignUpClick = (e) => {
    e.preventDefault();
    if (onNavigateToSignup) {
      onNavigateToSignup();
    } else {
      navigateTo('/signup');
    }
  };

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (typeof window === 'undefined') return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    setMousePos({ x, y });
  };

  const handleForgotClick = (e) => {
    e.preventDefault();
    if (onNavigateToForgotPassword) {
      onNavigateToForgotPassword();
    } else {
      navigateTo('/forgot-password');
    }
  };

  return (
    <div className="auth-wrapper" onMouseMove={handleMouseMove}>
      {/* Animated Aurora & Nebula Canvas */}
      <div className="auth-ambient-canvas" aria-hidden="true">
        <div
          className="aurora-orb aurora-orb-1"
          style={{
            transform: `translate(${mousePos.x * 24}px, ${mousePos.y * 24}px)`,
          }}
        />
        <div
          className="aurora-orb aurora-orb-2"
          style={{
            transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)`,
          }}
        />
        <div
          className="aurora-orb aurora-orb-3"
          style={{
            transform: `translate(${mousePos.x * 16}px, ${mousePos.y * -16}px)`,
          }}
        />
        <div
          className="aurora-orb aurora-orb-4"
          style={{
            transform: `translate(${mousePos.x * -12}px, ${mousePos.y * 12}px)`,
          }}
        />
        <div className="auth-grid-mesh" />
        <div className="auth-star-particles">
          <span className="star-dot dot-1" />
          <span className="star-dot dot-2" />
          <span className="star-dot dot-3" />
          <span className="star-dot dot-4" />
          <span className="star-dot dot-5" />
          <span className="star-dot dot-6" />
          <span className="star-dot dot-7" />
          <span className="star-dot dot-8" />
        </div>
      </div>

      {onThemeToggle && (
        <button
          type="button"
          className="auth-theme-toggle-btn"
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark Mode</span>
            </>
          )}
        </button>
      )}

      <div className="auth-container">
        {/* Main Signin Card with Neon Border Beam */}
        <main className="auth-card">
          <div className="auth-card-border-glow" aria-hidden="true" />
          <div className="auth-card-inner-mask" aria-hidden="true" />

          <div className="auth-card-content">
            <div className="auth-brand-badge auth-stagger-item auth-stagger-1">
              <div className="auth-brand-icon-wrap">
                <div className="auth-brand-glow-ring" />
                <div className="auth-brand-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <span className="auth-brand-name">NEXUS</span>
              <span className="auth-brand-sparkle" aria-hidden="true">✦</span>
            </div>

            <div className="auth-card-header auth-stagger-item auth-stagger-2">
              <h1 className="auth-card-title">Log in to your account</h1>
              <p className="auth-card-subtitle">Access your projects, sprints, and tasks</p>
            </div>

          {/* Error Banner */}
          {authError && (
            <div className="auth-alert-box auth-alert-danger" role="alert">
              <AlertCircleIcon />
              <span>{authError}</span>
            </div>
          )}

          {/* Success Banner */}
          {authSuccess && (
            <div className="auth-alert-box auth-alert-success" role="status">
              <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{authSuccess}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="auth-field-group auth-stagger-item auth-stagger-3">
              <label htmlFor="auth-email" className="auth-field-label">
                Registered Email
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="auth-email"
                  type="email"
                  className={`auth-input ${fieldErrors.email ? 'auth-input-error' : ''}`}
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: '' }));
                    }
                  }}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
              {fieldErrors.email && (
                <div className="auth-field-error-msg">
                  <AlertCircleIcon />
                  <span>{fieldErrors.email}</span>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="auth-field-group auth-stagger-item auth-stagger-4">
              <label htmlFor="auth-password" className="auth-field-label">
                Password
              </label>
              <div className="auth-input-wrapper">
                <DelayedPasswordInput
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input auth-input-has-icon ${fieldErrors.password ? 'auth-input-error' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-input-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.password && (
                <div className="auth-field-error-msg">
                  <AlertCircleIcon />
                  <span>{fieldErrors.password}</span>
                </div>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="auth-form-options auth-stagger-item auth-stagger-5">
              <label className="auth-checkbox-label" htmlFor="auth-remember">
                <input
                  id="auth-remember"
                  type="checkbox"
                  className="auth-checkbox-input"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                />
                <span className="auth-checkbox-custom">
                  <CheckIcon />
                </span>
                <span>Keep me logged in</span>
              </label>

              <button
                type="button"
                className="auth-card-link-btn auth-forgot-link"
                onClick={handleForgotClick}
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <div className="auth-submit-wrap auth-stagger-item auth-stagger-6">
              <button
                id="auth-signin-submit-btn"
                type="submit"
                className="auth-btn-primary"
                disabled={isLoading}
              >
                <span className="auth-btn-shimmer" aria-hidden="true" />
                {isLoading ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Log in</span>
                    <span className="auth-btn-arrow" aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* SSO Section - Google Only */}
          <div className="auth-divider-container auth-stagger-item auth-stagger-7">
            <span className="auth-divider-line" />
            <span className="auth-divider-text">Or continue with</span>
            <span className="auth-divider-line" />
          </div>

          <div className="auth-sso-group auth-stagger-item auth-stagger-7">
            <button
              id="auth-sso-google"
              type="button"
              className="auth-sso-btn"
              onClick={handleOpenGoogleChooser}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <span className="auth-spinner auth-spinner-blue" aria-hidden="true" />
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>

          {/* Bottom Card Link */}
          <div className="auth-card-footer-links auth-stagger-item auth-stagger-8">
            <span>Don't have an account?</span>
            <button
              id="auth-to-signup-btn"
              type="button"
              className="auth-card-link-btn"
              onClick={handleSignUpClick}
            >
              Sign up
            </button>
          </div>
          </div>
        </main>
      </div>

      {/* Authentic Google Account Chooser Modal */}
      <GoogleAuthModal
        isOpen={showGoogleChooser}
        onClose={() => setShowGoogleChooser(false)}
        onSelectAccount={handleSelectGoogleAccount}
        appName="Jira"
        appDomain="jira.com"
        currentEmail={email}
      />
    </div>
  );
};

export default Signin;