import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import authApi, { API_BASE_URL } from '../authApi';
import './forgotpassword.css';

const AlertCircleIcon = () => (
  <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
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

const DelayedPasswordInput = ({
  value: controlledValue,
  onChange,
  type = 'password',
  delay = 1500,
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

const ForgotPassword = ({
  onNavigateToSignin,
  theme = 'dark',
  onThemeToggle,
}) => {

  const [step, setStep] = useState(1);

 
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');


  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

 
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Real-time password validation criteria matching signup
  const passwordRules = useMemo(() => {
    return [
      {
        id: 'length',
        label: 'At least 8 characters',
        valid: newPassword.length >= 8,
      },
      {
        id: 'uppercase',
        label: 'At least one capital letter (A-Z)',
        valid: /[A-Z]/.test(newPassword),
      },
      {
        id: 'number',
        label: 'At least one number (0-9)',
        valid: /[0-9]/.test(newPassword),
      },
      {
        id: 'special',
        label: 'At least one special character (!@#$%...)',
        valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword),
      },
    ];
  }, [newPassword]);

  const isPasswordValid = useMemo(() => {
    return passwordRules.every((r) => r.valid);
  }, [passwordRules]);

  const metRulesCount = passwordRules.filter((r) => r.valid).length;
  const strengthPercentage = (metRulesCount / passwordRules.length) * 100;

  const getStrengthMeta = () => {
    if (metRulesCount === 0) return { label: 'Too short', colorClass: 'strength-none' };
    if (metRulesCount === 1) return { label: 'Weak', colorClass: 'strength-weak' };
    if (metRulesCount === 2) return { label: 'Fair', colorClass: 'strength-fair' };
    if (metRulesCount === 3) return { label: 'Good', colorClass: 'strength-good' };
    return { label: 'Strong', colorClass: 'strength-strong' };
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
    if (!/[A-Z]/.test(val)) {
      return 'Password must contain at least one capital letter (A-Z).';
    }
    if (!/[0-9]/.test(val)) {
      return 'Password must contain at least one number (0-9).';
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(val)) {
      return 'Password must contain at least one special character (!@#$%...).';
    }
    return '';
  };

  const validateConfirmPassword = (val, originalPassword) => {
    if (!val) {
      return 'Please re-enter your password.';
    }
    if (val !== originalPassword) {
      return 'Passwords do not match.';
    }
    return '';
  };

  const handleEmailKeyDown = (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
    }
  };

  const handleEmailChange = (e) => {
    const sanitized = e.target.value.replace(/\s+/g, '');
    setEmail(sanitized);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handleEmailBlur = () => {
    setEmail((prev) => prev.trim());
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const response = await authApi.forgotPassword({
        email: email.trim(),
      });

      setIsLoading(false);
      const resEmail = response.data?.email || email.trim();
      setEmail(resEmail);
      // Strictly do NOT auto-paste OTP: user must receive and enter it from their email
      setOtp('');
      const successMsg =
        response.data?.message ||
        `Verification OTP has been sent to ${resEmail}. Please check your email inbox.`;
      setAuthSuccess(successMsg);
      setResendTimer(30);
      setStep(2);
    } catch (err) {
      setIsLoading(false);
      const resData = err.response?.data;
      const rawError =
        resData?.error ||
        resData?.message ||
        resData?.detail ||
        (Array.isArray(resData?.email) ? resData.email[0] : resData?.email);

      const errorMsg =
        rawError ||
        (err.code === 'ERR_NETWORK'
          ? 'Backend server is currently unreachable. Please check your network connection.'
          : 'Unable to send OTP at this time. Please try again later.');

      setAuthError(errorMsg);

      const isNotRegistered =
        err.response?.status === 404 ||
        (rawError && rawError.toLowerCase().includes('not registered'));

      if (isNotRegistered) {
        setFieldErrors((prev) => ({
          ...prev,
          email: rawError || 'This email address is not registered in our database.',
        }));
      }
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!otp || otp.trim().length < 4) {
      setFieldErrors({ otp: 'Please enter the verification code sent to your email.' });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      // API call to verify the OTP with the backend via Axios
      const response = await authApi.verifyOtp({
        email: email.trim(),
        otp: otp.trim(),
      });

      setIsLoading(false);
      const successMsg =
        response.data?.message ||
        'OTP verified successfully! Please create your new secure password.';
      setAuthSuccess(successMsg);
      setStep(3);
    } catch (err) {
      setIsLoading(false);
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.code === 'ERR_NETWORK'
          ? 'Backend server is currently unreachable'
          : 'Invalid or expired verification code. Please check your email and try again.');
      setAuthError(errorMsg);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const trimmedPassword = newPassword;
    const trimmedConfirm = confirmPassword;

    const passErr = validatePassword(trimmedPassword);
    const confirmErr = validateConfirmPassword(trimmedConfirm, trimmedPassword);

    if (passErr || confirmErr) {
      setFieldErrors({
        newPassword: passErr,
        confirmPassword: confirmErr,
      });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      // API call to update the password in the database via Axios
      const response = await authApi.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword: trimmedPassword,
        password: trimmedPassword,
      });

      setIsLoading(false);
      const successMsg =
        response.data?.message || 'Password updated successfully! Redirecting to login...';
      setAuthSuccess(successMsg);

      setTimeout(() => {
        if (onNavigateToSignin) {
          onNavigateToSignin();
        } else {
          window.location.assign('/signin');
        }
      }, 1500);
    } catch (err) {
      setIsLoading(false);
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.code === 'ERR_NETWORK'
          ? 'Backend server is currently unreachable'
          : 'Unable to update password. Please try again.');
      setAuthError(errorMsg);
    }
  };

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (typeof window === 'undefined') return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    setMousePos({ x, y });
  };

  const handleBackToSignin = (e) => {
    e.preventDefault();
    if (onNavigateToSignin) {
      onNavigateToSignin();
    } else {
      window.location.assign('/signin');
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
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
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
        {/* Main Forgot Password Card with Neon Border Beam */}
        <main className="auth-card">
          <div className="auth-card-border-glow" aria-hidden="true" />
          <div className="auth-card-inner-mask" aria-hidden="true" />

          <div className="auth-card-content">
            {/* Brand Badge with Animated Rotating Aura & Sparkle */}
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

            {/* Step Indicator */}
            <div style={{ textAlign: 'center' }} className="auth-stagger-item auth-stagger-2">
              <span className="auth-step-badge">
                {step === 1 && 'Step 1 of 3: Enter Email'}
                {step === 2 && 'Step 2 of 3: Verify OTP'}
                {step === 3 && 'Step 3 of 3: New Password'}
              </span>
            </div>

            <div className="auth-card-header auth-stagger-item auth-stagger-2">
            <h1 className="auth-card-title">
              {step === 1 && 'Forgot Password'}
              {step === 2 && 'Verify OTP'}
              {step === 3 && 'Set New Password'}
            </h1>
            <p className="auth-card-subtitle">
              {step === 1 && 'Enter your registered email to receive an OTP code'}
              {step === 2 && `Enter the 6-digit OTP code sent to ${email}`}
              {step === 3 && 'Create and confirm your new password'}
            </p>
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

          {/* STEP 1: Enter Registered Email */}
          {step === 1 && (
            <form className="auth-form" onSubmit={handleSendOtp} noValidate>
              <div className="auth-field-group">
                <label htmlFor="auth-forgot-email" className="auth-field-label">
                  Registered Email
                </label>
                <div className="auth-input-wrapper">
                  <input
                    id="auth-forgot-email"
                    type="email"
                    className={`auth-input ${fieldErrors.email ? 'auth-input-error' : ''}`}
                    placeholder="name@company.com"
                    value={email}
                    onChange={handleEmailChange}
                    onKeyDown={handleEmailKeyDown}
                    onBlur={handleEmailBlur}
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

              <button
                id="auth-forgot-submit-btn"
                type="submit"
                className="auth-btn-primary auth-stagger-item auth-stagger-4"
                disabled={isLoading}
              >
                <span className="auth-btn-shimmer" aria-hidden="true" />
                {isLoading ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Validating email...</span>
                  </>
                ) : (
                  <>
                    <span>Send OTP</span>
                    <span className="auth-btn-arrow" aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 2 && (
            <form className="auth-form" onSubmit={handleVerifyOtp} noValidate>
              <div className="auth-field-group auth-stagger-item auth-stagger-3">
                <label htmlFor="auth-otp-code" className="auth-field-label">
                  Verification Code (OTP)
                </label>
                <div className="auth-input-wrapper">
                  <input
                    id="auth-otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className={`auth-input auth-otp-input ${fieldErrors.otp ? 'auth-input-error' : ''}`}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtp(val);
                      if (fieldErrors.otp) {
                        setFieldErrors((prev) => ({ ...prev, otp: '' }));
                      }
                    }}
                    autoFocus
                    required
                  />
                </div>
                {fieldErrors.otp && (
                  <div className="auth-field-error-msg">
                    <AlertCircleIcon />
                    <span>{fieldErrors.otp}</span>
                  </div>
                )}

                <div className="auth-otp-actions">
                  <button
                    type="button"
                    className="auth-otp-change-email-btn"
                    onClick={() => {
                      setStep(1);
                      setAuthError('');
                      setAuthSuccess('');
                    }}
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    className="auth-otp-resend-btn"
                    disabled={resendTimer > 0 || isLoading}
                    onClick={() => handleSendOtp()}
                  >
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>

              <button
                id="auth-verify-otp-btn"
                type="submit"
                className="auth-btn-primary auth-stagger-item auth-stagger-4"
                disabled={isLoading || otp.length < 4}
              >
                <span className="auth-btn-shimmer" aria-hidden="true" />
                {isLoading ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Verify OTP</span>
                    <span className="auth-btn-arrow" aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: Enter New Password & Confirm Password */}
          {step === 3 && (
            <form className="auth-form" onSubmit={handleResetPassword} noValidate>
              {/* New Password */}
              <div className="auth-field-group">
                <label htmlFor="auth-new-password" className="auth-field-label">
                  New Password
                </label>
                <div className="auth-input-wrapper">
                  <DelayedPasswordInput
                    id="auth-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className={`auth-input auth-input-has-icon ${fieldErrors.newPassword ? 'auth-input-error' : ''}`}
                    placeholder="Create a strong password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (fieldErrors.newPassword) {
                        setFieldErrors((prev) => ({ ...prev, newPassword: '' }));
                      }
                    }}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    autoComplete="new-password"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    className="auth-input-toggle-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {fieldErrors.newPassword && (
                  <div className="auth-field-error-msg">
                    <AlertCircleIcon />
                    <span>{fieldErrors.newPassword}</span>
                  </div>
                )}

                {/* Password Requirements Checklist & Realtime Strength Meter */}
                {(isPasswordFocused || newPassword.length > 0) && (
                  <div className="auth-password-checklist-card">
                    <div className="auth-password-checklist-header">
                      <span className="auth-password-checklist-title">Password Requirements</span>
                      {newPassword.length > 0 && (
                        <span className={`auth-password-strength-badge ${getStrengthMeta().colorClass}`}>
                          {getStrengthMeta().label} ({metRulesCount}/4)
                        </span>
                      )}
                    </div>

                    {newPassword.length > 0 && (
                      <div className="auth-password-meter-track">
                        <div
                          className={`auth-password-meter-bar ${getStrengthMeta().colorClass}`}
                          style={{ width: `${strengthPercentage}%` }}
                        />
                      </div>
                    )}

                    <div className="auth-password-rules-list">
                      {passwordRules.map((rule) => (
                        <label
                          key={rule.id}
                          htmlFor={`auth-rule-cb-${rule.id}`}
                          className={`auth-password-rule-row ${rule.valid ? 'is-valid' : 'is-pending'}`}
                        >
                          <input
                            type="checkbox"
                            id={`auth-rule-cb-${rule.id}`}
                            className="auth-rule-native-checkbox"
                            checked={rule.valid}
                            readOnly
                            aria-label={rule.label}
                          />
                          <span className="auth-rule-custom-checkbox" aria-hidden="true">
                            {rule.valid && (
                              <svg
                                className="auth-rule-checkmark"
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          <span className="auth-rule-label-text">{rule.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="auth-field-group">
                <label htmlFor="auth-confirm-password" className="auth-field-label">
                  Confirm New Password
                </label>
                <div className="auth-input-wrapper">
                  <DelayedPasswordInput
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`auth-input auth-input-has-icon ${fieldErrors.confirmPassword ? 'auth-input-error' : ''}`}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-input-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <div className="auth-field-error-msg">
                    <AlertCircleIcon />
                    <span>{fieldErrors.confirmPassword}</span>
                  </div>
                )}
              </div>

              <button
                id="auth-reset-password-btn"
                type="submit"
                className="auth-btn-primary auth-stagger-item auth-stagger-4"
                disabled={isLoading || !isPasswordValid || newPassword !== confirmPassword || !confirmPassword}
              >
                <span className="auth-btn-shimmer" aria-hidden="true" />
                {isLoading ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <span>Update Password</span>
                    <span className="auth-btn-arrow" aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Link: Return to Signin */}
          <div className="auth-card-footer-links auth-stagger-item auth-stagger-5">
            <button
              id="auth-back-to-signin-btn"
              type="button"
              className="auth-card-link-btn"
              onClick={handleBackToSignin}
            >
              Return to log in
            </button>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ForgotPassword;
