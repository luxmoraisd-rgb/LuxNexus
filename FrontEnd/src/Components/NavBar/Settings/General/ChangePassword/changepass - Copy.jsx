import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Check,
} from "lucide-react";
import "./changepass.css";
import profileApi from "../../../Profile/profileApi";
import authApi from "../../../../Auth/authApi";

const getStoredUser = () => {
  try {
    const raw =
      typeof window !== "undefined"
        ? sessionStorage.getItem("user") || localStorage.getItem("user")
        : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const DelayedPasswordInput = ({
  value: controlledValue,
  onChange,
  type = "password",
  delay = 1000,
  maskChar = "•",
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  onSelect,
  onPointerUp,
  onCopy,
  onCut,
  className = "",
  style,
  ...restProps
}) => {
  const isPlainText = type === "text";
  const realValueRef = useRef(String(controlledValue ?? ""));
  const [displayValue, setDisplayValue] = useState(() =>
    isPlainText
      ? realValueRef.current
      : maskChar.repeat(realValueRef.current.length)
  );
  const inputRef = useRef(null);
  const lastSelRef = useRef({
    start: realValueRef.current.length,
    end: realValueRef.current.length,
  });
  const targetCursorRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const stringVal = String(controlledValue ?? "");
    if (stringVal !== realValueRef.current) {
      realValueRef.current = stringVal;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDisplayValue(
        isPlainText ? stringVal : maskChar.repeat(stringVal.length)
      );
    }
  }, [controlledValue, isPlainText, maskChar]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDisplayValue(
      isPlainText
        ? realValueRef.current
        : maskChar.repeat(realValueRef.current.length)
    );
  }, [isPlainText, maskChar]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (
      targetCursorRef.current !== null &&
      inputRef.current &&
      document.activeElement === inputRef.current
    ) {
      const pos = targetCursorRef.current;
      try {
        inputRef.current.setSelectionRange(pos, pos);
        lastSelRef.current = { start: pos, end: pos };
      } catch {}
      targetCursorRef.current = null;
    }
  }, [displayValue]);

  const recordSel = (e) => {
    if (e.target && typeof e.target.selectionStart === "number") {
      lastSelRef.current = {
        start: e.target.selectionStart,
        end: e.target.selectionEnd ?? e.target.selectionStart,
      };
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

    let newReal = "";
    let visibleIndex = -1;

    if (!inputVal) {
      newReal = "";
      visibleIndex = -1;
    } else if (
      nativeEvent.inputType === "insertText" &&
      typeof nativeEvent.data === "string"
    ) {
      const start = Math.min(
        lastSelRef.current.start,
        realValueRef.current.length
      );
      const end = Math.min(lastSelRef.current.end, realValueRef.current.length);
      newReal =
        realValueRef.current.slice(0, start) +
        nativeEvent.data +
        realValueRef.current.slice(end);
      visibleIndex = start + nativeEvent.data.length - 1;
    } else if (nativeEvent.inputType === "deleteContentBackward") {
      let start = lastSelRef.current.start;
      let end = lastSelRef.current.end;
      if (start === end) start = Math.max(0, start - 1);
      newReal =
        realValueRef.current.slice(0, start) + realValueRef.current.slice(end);
      visibleIndex = -1;
    } else if (
      nativeEvent.inputType === "deleteContentForward" ||
      nativeEvent.inputType === "deleteByCut"
    ) {
      let start = lastSelRef.current.start;
      let end = lastSelRef.current.end;
      if (start === end && nativeEvent.inputType === "deleteContentForward")
        end = Math.min(realValueRef.current.length, end + 1);
      newReal =
        realValueRef.current.slice(0, start) + realValueRef.current.slice(end);
      visibleIndex = -1;
    } else if (!inputVal.includes(maskChar)) {
      if (inputVal.length === realValueRef.current.length + 1) {
        const idx =
          typeof e.target.selectionEnd === "number"
            ? e.target.selectionEnd - 1
            : inputVal.length - 1;
        newReal = inputVal;
        visibleIndex = Math.max(0, idx);
      } else {
        newReal = inputVal;
        visibleIndex = -1;
      }
    } else {
      const selStart = Math.min(
        lastSelRef.current.start,
        realValueRef.current.length
      );
      const selEnd = Math.min(
        lastSelRef.current.end,
        realValueRef.current.length
      );
      const selLen = selEnd - selStart;
      const oldLen = displayValue.length;
      const newLen = inputVal.length;

      if (selLen > 0) {
        const insCount = newLen - oldLen + selLen;
        if (insCount > 0) {
          const insChars = inputVal.slice(selStart, selStart + insCount);
          newReal =
            realValueRef.current.slice(0, selStart) +
            insChars +
            realValueRef.current.slice(selEnd);
          visibleIndex = selStart + insChars.length - 1;
        } else {
          newReal =
            realValueRef.current.slice(0, selStart) +
            realValueRef.current.slice(selEnd);
          visibleIndex = -1;
        }
      } else if (newLen > oldLen) {
        const addedCount = newLen - oldLen;
        const insEnd =
          typeof e.target.selectionEnd === "number" &&
          e.target.selectionEnd >= addedCount
            ? e.target.selectionEnd
            : newLen;
        const insStart = insEnd - addedCount;
        const insChars = inputVal.slice(insStart, insEnd);
        newReal =
          realValueRef.current.slice(0, insStart) +
          insChars +
          realValueRef.current.slice(insStart);
        visibleIndex = insStart + insChars.length - 1;
      } else if (newLen < oldLen) {
        const delCount = oldLen - newLen;
        const delEnd =
          typeof e.target.selectionEnd === "number"
            ? e.target.selectionEnd + delCount
            : realValueRef.current.length;
        const delStart =
          typeof e.target.selectionEnd === "number"
            ? e.target.selectionEnd
            : realValueRef.current.length - delCount;
        newReal =
          realValueRef.current.slice(0, Math.max(0, delStart)) +
          realValueRef.current.slice(
            Math.min(realValueRef.current.length, delEnd)
          );
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
      const peek =
        maskChar.repeat(visibleIndex) +
        newReal[visibleIndex] +
        maskChar.repeat(newReal.length - visibleIndex - 1);
      setDisplayValue(peek);
      timerRef.current = setTimeout(() => {
        if (inputRef.current && document.activeElement === inputRef.current) {
          targetCursorRef.current =
            inputRef.current.selectionEnd ?? inputRef.current.selectionStart;
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
        currentTarget: { ...e.currentTarget, value: newReal },
      });
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={(e) => {
        recordSel(e);
        onKeyDown?.(e);
      }}
      onKeyUp={(e) => {
        recordSel(e);
        onKeyUp?.(e);
      }}
      onSelect={(e) => {
        recordSel(e);
        onSelect?.(e);
      }}
      onPointerUp={(e) => {
        recordSel(e);
        onPointerUp?.(e);
      }}
      onFocus={(e) => {
        recordSel(e);
        onFocus?.(e);
      }}
      onBlur={handleBlur}
      onCopy={(e) => {
        if (!isPlainText) e.preventDefault();
        onCopy?.(e);
      }}
      onCut={(e) => {
        if (!isPlainText) e.preventDefault();
        onCut?.(e);
      }}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      data-password-type="true"
      className={className}
      style={{
        fontFamily: "inherit",
        letterSpacing: !isPlainText ? "0.08em" : "normal",
        ...style,
      }}
      {...restProps}
    />
  );
};

const ChangePassword = () => {
  const [storedUser] = useState(() => getStoredUser());
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [resetEmail, setResetEmail] = useState(
    () => getStoredUser()?.email || ""
  );
  const [showEmailReset, setShowEmailReset] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("info");

  // Real-time password validation criteria identical to signup page
  const passwordRules = useMemo(() => {
    return [
      {
        id: "length",
        label: "At least 8 characters",
        valid: newPassword.length >= 8,
      },
      {
        id: "uppercase",
        label: "At least one capital letter (A-Z)",
        valid: /[A-Z]/.test(newPassword),
      },
      {
        id: "number",
        label: "At least one number (0-9)",
        valid: /[0-9]/.test(newPassword),
      },
      {
        id: "special",
        label: "At least one special character (!@#$%...)",
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
    if (metRulesCount === 0)
      return { label: "Too short", colorClass: "strength-none" };
    if (metRulesCount === 1)
      return { label: "Weak", colorClass: "strength-weak" };
    if (metRulesCount === 2)
      return { label: "Fair", colorClass: "strength-fair" };
    if (metRulesCount === 3)
      return { label: "Good", colorClass: "strength-good" };
    return { label: "Strong", colorClass: "strength-strong" };
  };

  const isConfirmPasswordMatch = useMemo(() => {
    return confirmPassword.length > 0 && newPassword === confirmPassword;
  }, [newPassword, confirmPassword]);

  // Generate Reset OTP via Backend
  const generateResetCode = async () => {
    const targetEmail = resetEmail.trim() || storedUser?.email;
    if (!targetEmail) {
      setShowEmailReset(true);
      setStatus("Please enter your registered email address to receive a reset code.");
      setStatusType("error");
      return;
    }

    setIsSendingOtp(true);
    setStatus("Requesting reset verification code from backend...");
    setStatusType("info");

    try {
      const res = await authApi.forgotPassword({ email: targetEmail });
      setGeneratedOtp(res.data?.otp || "SENT");
      setEnteredOtp("");
      setOtpVerified(false);
      setShowEmailReset(true);
      const msg =
        res.data?.message ||
        `Verification code sent to ${targetEmail}. Please check your inbox.`;
      setStatus(msg);
      setStatusType("info");
      if (res.data?.otp) {
        console.info("[Password Reset] OTP generated in MongoDB:", res.data.otp);
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to send reset code. Please try again.";
      setStatus(errMsg);
      setStatusType("error");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify Reset Code via Backend
  const verifyResetCode = async () => {
    if (!enteredOtp || enteredOtp.trim().length < 4) {
      setStatus("Please enter the 6-digit verification code.");
      setStatusType("error");
      return;
    }

    setIsVerifyingOtp(true);
    setStatus("Verifying verification code...");
    setStatusType("info");

    try {
      const targetEmail = resetEmail.trim() || storedUser?.email;
      const res = await authApi.verifyOtp({
        email: targetEmail,
        otp: enteredOtp.trim(),
      });
      setOtpVerified(true);
      setStatus(
        res.data?.message ||
          "Reset code verified! You can now choose a new password."
      );
      setStatusType("success");
      setFieldErrors((prev) => ({ ...prev, currentPassword: "" }));
    } catch (err) {
      if (
        generatedOtp &&
        generatedOtp !== "SENT" &&
        enteredOtp.trim() === generatedOtp.trim()
      ) {
        setOtpVerified(true);
        setStatus("Reset code verified! You can now choose a new password.");
        setStatusType("success");
        setFieldErrors((prev) => ({ ...prev, currentPassword: "" }));
      } else {
        const errMsg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          "That verification code is incorrect or expired.";
        setStatus(errMsg);
        setStatusType("error");
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Form Submit Handler
  const savePassword = async (event) => {
    event.preventDefault();
    const errors = {};

    // Validate current password if not OTP verified
    if (!otpVerified && !currentPassword.trim()) {
      errors.currentPassword = "Your current password is required.";
    }

    // Validate new password rules
    if (!isPasswordValid) {
      if (newPassword.length < 8) {
        errors.newPassword = "Password must be at least 8 characters.";
      } else if (!/[A-Z]/.test(newPassword)) {
        errors.newPassword = "Password must contain at least one capital letter (A-Z).";
      } else if (!/[0-9]/.test(newPassword)) {
        errors.newPassword = "Password must contain at least one number (0-9).";
      } else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword)) {
        errors.newPassword = "Password must contain at least one special character.";
      }
    } else if (!otpVerified && currentPassword && newPassword === currentPassword) {
      errors.newPassword = "New password cannot be the same as your current password.";
    }

    // Validate confirmation matching
    if (!confirmPassword) {
      errors.confirmPassword = "Please re-enter your new password to confirm.";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "New password and confirmation do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus("Please resolve the validation errors indicated below.");
      setStatusType("error");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    setStatus("Updating password...");
    setStatusType("info");

    try {
      const targetEmail = resetEmail.trim() || storedUser?.email;
      const res = await profileApi.changePassword({
        currentPassword: otpVerified ? undefined : currentPassword,
        newPassword,
        confirmPassword,
        otp: otpVerified ? enteredOtp.trim() : undefined,
        email: targetEmail,
        username: storedUser?.username,
      });

      setStatus(res.message || "Password updated successfully!");
      setStatusType("success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setEnteredOtp("");
      setGeneratedOtp("");
      setOtpVerified(false);
      setShowEmailReset(false);
      setFieldErrors({});
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.response?.data?.current_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        err.message ||
        "Failed to update password.";
      setStatus(errMsg);
      setStatusType("error");

      if (err.response?.data?.current_password) {
        setFieldErrors((prev) => ({
          ...prev,
          currentPassword: Array.isArray(err.response.data.current_password)
            ? err.response.data.current_password[0]
            : err.response.data.current_password,
        }));
      }
      if (err.response?.data?.new_password) {
        setFieldErrors((prev) => ({
          ...prev,
          newPassword: Array.isArray(err.response.data.new_password)
            ? err.response.data.new_password[0]
            : err.response.data.new_password,
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="settings-page password-settings">
      <header className="settings-page-header">
        <div className="settings-header-title-row">
          <div className="settings-title-group">
            <div className="password-icon-badge">
              <KeyRound size={20} className="password-icon" />
            </div>
            <div>
              <h2>Change Password</h2>
            </div>
          </div>
        </div>
      </header>

      {/* Global Status Banner */}
      {status && (
        <div className={`password-status-banner ${statusType}`} role="status">
          {statusType === "success" && (
            <CheckCircle2 size={18} className="status-icon" />
          )}
          {statusType === "error" && (
            <AlertCircle size={18} className="status-icon" />
          )}
          {statusType === "info" && (
            <Loader2 size={18} className="status-icon spin-icon" />
          )}
          <span className="status-text">{status}</span>
        </div>
      )}

      <form className="password-form" onSubmit={savePassword} noValidate>
        {/* CURRENT PASSWORD FIELD */}
        {!otpVerified && (
          <div className="password-field-group">
            <div className="password-field-header">
              <label
                className="password-field-label"
                htmlFor="current-password-input"
              >
                Current Password <span className="req-star">*</span>
              </label>
              <button
                type="button"
                className="forgot-toggle-link"
                onClick={() => setShowEmailReset(!showEmailReset)}
              >
                {showEmailReset ? "Hide reset option" : "Forgot current password?"}
              </button>
            </div>

            <div className="password-input-wrapper">
              <DelayedPasswordInput
                id="current-password-input"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: "" }));
                  }
                }}
                className={`password-text-input ${
                  fieldErrors.currentPassword ? "has-error" : ""
                }`}
                required={!otpVerified}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                aria-label={
                  showCurrentPassword ? "Hide password" : "Show password"
                }
                tabIndex={0}
              >
                {showCurrentPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {fieldErrors.currentPassword && (
              <div className="password-field-error-msg">
                <AlertCircle size={14} />
                <span>{fieldErrors.currentPassword}</span>
              </div>
            )}
          </div>
        )}

        {/* OTP VERIFIED BANNER */}
        {otpVerified && (
          <div className="otp-verified-banner">
            <CheckCircle2 size={18} className="success-icon" />
            <span>
              Identity verified via email code. Current password is not required.
            </span>
          </div>
        )}

        {/* OTP / EMAIL RESET DRAWER */}
        {showEmailReset && !otpVerified && (
          <div className="otp-verification-flow">
            <div className="otp-flow-header">
              <Mail size={16} className="otp-mail-icon" />
              <div>
                <h4>Reset via Email Verification Code</h4>
                <p>
                  Receive a 6-digit one-time code to update your password without your current password.
                </p>
              </div>
            </div>

            <div className="password-field-group">
              <label
                className="password-field-label"
                htmlFor="reset-email-input"
              >
                Registered Account Email
              </label>
              <div className="otp-send-row">
                <input
                  id="reset-email-input"
                  type="email"
                  className="password-text-input"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="user@example.com"
                />
                <button
                  type="button"
                  className="otp-send-btn"
                  onClick={generateResetCode}
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 size={13} className="spin-icon" /> Sending...
                    </>
                  ) : (
                    "Send Code"
                  )}
                </button>
              </div>
            </div>

            {generatedOtp && (
              <div className="password-field-group">
                <label
                  className="password-field-label"
                  htmlFor="reset-otp-input"
                >
                  6-Digit Verification Code
                </label>
                <div className="otp-verify-row">
                  <input
                    id="reset-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="password-text-input otp-code-input"
                    placeholder="123456"
                    value={enteredOtp}
                    onChange={(event) =>
                      setEnteredOtp(event.target.value.replace(/\D/g, ""))
                    }
                  />
                  <button
                    className="otp-verify-btn"
                    type="button"
                    onClick={verifyResetCode}
                    disabled={isVerifyingOtp || enteredOtp.length < 4}
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 size={13} className="spin-icon" /> Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NEW PASSWORD FIELD */}
        <div className="password-field-group">
          <label className="password-field-label" htmlFor="new-password-input">
            New Password <span className="req-star">*</span>
          </label>
          <div className="password-input-wrapper">
            <DelayedPasswordInput
              id="new-password-input"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                if (fieldErrors.newPassword) {
                  setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
                }
              }}
              onFocus={() => setIsNewPasswordFocused(true)}
              onBlur={() => setIsNewPasswordFocused(false)}
              className={`password-text-input ${
                fieldErrors.newPassword ? "has-error" : ""
              }`}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowNewPassword(!showNewPassword)}
              aria-label={showNewPassword ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {fieldErrors.newPassword && (
            <div className="password-field-error-msg">
              <AlertCircle size={14} />
              <span>{fieldErrors.newPassword}</span>
            </div>
          )}

          {/* REAL-TIME CHECKLIST & STRENGTH METER (LIKE SIGNUP PAGE) */}
          {(isNewPasswordFocused ||
            newPassword.length > 0 ||
            fieldErrors.newPassword) && (
            <div className="auth-password-checklist-card" aria-live="polite">
              <div className="auth-password-checklist-header">
                <span className="auth-password-checklist-title">
                  Password must contain:
                </span>
                {newPassword.length > 0 && (
                  <span
                    className={`auth-password-strength-badge ${
                      getStrengthMeta().colorClass
                    }`}
                  >
                    {getStrengthMeta().label} ({metRulesCount}/4)
                  </span>
                )}
              </div>

              {newPassword.length > 0 && (
                <div className="auth-password-meter-track">
                  <div
                    className={`auth-password-meter-bar ${
                      getStrengthMeta().colorClass
                    }`}
                    style={{ width: `${strengthPercentage}%` }}
                  />
                </div>
              )}

              <div className="auth-password-rules-list">
                {passwordRules.map((rule) => (
                  <label
                    key={rule.id}
                    htmlFor={`rule-cb-${rule.id}`}
                    className={`auth-password-rule-row ${
                      rule.valid ? "is-valid" : "is-pending"
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`rule-cb-${rule.id}`}
                      className="auth-rule-native-checkbox"
                      checked={rule.valid}
                      readOnly
                      aria-label={rule.label}
                    />
                    <span
                      className="auth-rule-custom-checkbox"
                      aria-hidden="true"
                    >
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

        {/* CONFIRM PASSWORD FIELD */}
        <div className="password-field-group">
          <div className="password-field-header">
            <label
              className="password-field-label"
              htmlFor="confirm-password-input"
            >
              Re-enter New Password <span className="req-star">*</span>
            </label>
            {isConfirmPasswordMatch && (
              <span className="password-match-tag">
                <Check size={12} />
                <span>Passwords match</span>
              </span>
            )}
          </div>

          <div className="password-input-wrapper">
            <DelayedPasswordInput
              id="confirm-password-input"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }
              }}
              className={`password-text-input ${
                fieldErrors.confirmPassword
                  ? "has-error"
                  : isConfirmPasswordMatch
                  ? "has-success"
                  : ""
              }`}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
              tabIndex={0}
            >
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {fieldErrors.confirmPassword && (
            <div className="password-field-error-msg">
              <AlertCircle size={14} />
              <span>{fieldErrors.confirmPassword}</span>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="password-form-actions">
          <button
            className="password-save-button"
            type="submit"
            disabled={
              isSubmitting ||
              !isPasswordValid ||
              !isConfirmPasswordMatch ||
              (!otpVerified && !currentPassword.trim())
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spin-icon" /> Saving password...
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Save Password</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};

export default ChangePassword;
