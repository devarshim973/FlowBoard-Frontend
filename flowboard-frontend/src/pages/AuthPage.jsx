import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { authApi, userApi } from "../services/api";
import { decodeJwt } from "../services/helpers";
import { useAuth } from "../state/AuthContext";

const initialSignup = {
  fullName: "",
  email: "",
  password: "",
  otp: ""
};

const initialLogin = {
  email: "",
  password: ""
};

const initialReset = {
  email: "",
  otp: "",
  newPassword: ""
};

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const revealOtpInDev = import.meta.env.DEV;

function formatAuthError(message) {
  if (!message) {
    return "Something went wrong. Please try again.";
  }

  if (message.includes("ROLE.USER")) {
    return "Admin signup is not available right now. Create a normal account instead.";
  }

  if (message.includes("User already exist")) {
    return "This email is already registered. Try logging in or use OTP Reset.";
  }

  if (message.includes("Signup OTP is required")) {
    return "Send the signup OTP first, then enter it here to complete registration.";
  }

  if (message.includes("SMTP authentication failed")) {
    return "OTP email could not be delivered because the mail server login is not configured correctly yet.";
  }

  if (message.includes("Unable to send email")) {
    return "OTP email could not be delivered because the email provider is not configured correctly yet.";
  }

  if (message.includes("disabled") || message.includes("Bad credentials")) {
    return "Email or password is incorrect. Create the account first, then log in with the same password.";
  }

  return message;
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [resetForm, setResetForm] = useState(initialReset);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const activeTitle = useMemo(() => {
    if (mode === "signup") return "Create your account";
    if (mode === "reset") return "Reset your password";
    return "Login to continue";
  }, [mode]);

  function setFeedbackMessage(type, text) {
    setFeedback(text ? { type, text } : { type: "", text: "" });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setFeedbackMessage("", "");
  }

  function validateLoginForm() {
    if (!loginForm.email.trim()) {
      return "Email is required.";
    }

    if (!emailPattern.test(loginForm.email.trim())) {
      return "Enter a valid email address.";
    }

    if (!loginForm.password) {
      return "Password is required.";
    }

    return "";
  }

  function validateSignupForm() {
    if (signupForm.fullName.trim().length < 3) {
      return "Full name must be at least 3 characters.";
    }

    if (!emailPattern.test(signupForm.email.trim())) {
      return "Enter a valid email address.";
    }

    if (!passwordPattern.test(signupForm.password)) {
      return "Password must contain uppercase, lowercase, number, special character, and be at least 8 characters.";
    }

    if (signupForm.otp.trim().length !== 6) {
      return "Enter the 6 character signup OTP sent to your email.";
    }

    return "";
  }

  function validateSignupOtpRequest() {
    if (!emailPattern.test(signupForm.email.trim())) {
      return "Enter a valid email address before requesting OTP.";
    }

    return "";
  }

  function validateResetForm(requireOtp) {
    if (!emailPattern.test(resetForm.email.trim())) {
      return "Enter the registered email address.";
    }

    if (!requireOtp) {
      return "";
    }

    if (resetForm.otp.trim().length !== 6) {
      return "OTP must be 6 characters.";
    }

    if (!passwordPattern.test(resetForm.newPassword)) {
      return "New password must contain uppercase, lowercase, number, special character, and be at least 8 characters.";
    }

    return "";
  }

  async function handleSignup(event) {
    event.preventDefault();
    const validationMessage = validateSignupForm();

    if (validationMessage) {
      setFeedbackMessage("error", validationMessage);
      return;
    }

    setLoading(true);
    setFeedbackMessage("", "");
    try {
      const payload = {
        fullName: signupForm.fullName.trim(),
        email: signupForm.email.trim(),
        password: signupForm.password,
        otp: signupForm.otp.trim()
      };

      await authApi.signup(payload);
      setSignupForm(initialSignup);
      setLoginForm({
        email: payload.email,
        password: payload.password
      });
      setMode("login");
      setFeedbackMessage("success", "Account created successfully. Now click Login to enter FlowBoard.");
    } catch (error) {
      setFeedbackMessage("error", formatAuthError(error.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendSignupOtp() {
    const validationMessage = validateSignupOtpRequest();

    if (validationMessage) {
      setFeedbackMessage("error", validationMessage);
      return;
    }

    setLoading(true);
    setFeedbackMessage("", "");
    try {
      const response = await authApi.sendSignupOtp(signupForm.email.trim());
      const signupOtp = response?.otp ? String(response.otp).trim() : "";
      if (signupOtp) {
        setSignupForm((current) => ({ ...current, otp: signupOtp }));
      }

      setFeedbackMessage(
        "success",
        signupOtp && revealOtpInDev
          ? `Signup OTP generated for local testing. Use OTP: ${signupOtp}`
          : "Signup OTP sent to your email. Enter it below to finish creating your account."
      );
    } catch (error) {
      setFeedbackMessage("error", formatAuthError(error.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const validationMessage = validateLoginForm();

    if (validationMessage) {
      setFeedbackMessage("error", validationMessage);
      return;
    }

    setLoading(true);
    setFeedbackMessage("", "");
    try {
      const token = await authApi.login({
        email: loginForm.email.trim(),
        password: loginForm.password
      });
      const payload = decodeJwt(token);
      const userId = payload.userId;
      let profile = { fullName: loginForm.email.trim(), email: loginForm.email.trim() };

      if (!userId) {
        throw new Error("Login succeeded but no user id was found in the token.");
      }

      if (userId) {
        try {
          profile = await userApi.getById(userId, token, userId);
        } catch {
          profile = { fullName: loginForm.email.trim(), email: loginForm.email.trim() };
        }
      }

      login({ token, userId, profile });
      navigate("/app");
    } catch (error) {
      setFeedbackMessage("error", formatAuthError(error.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(event) {
    event.preventDefault();
    const validationMessage = validateResetForm(false);

    if (validationMessage) {
      setFeedbackMessage("error", validationMessage);
      return;
    }

    setLoading(true);
    setFeedbackMessage("", "");
    try {
      const response = await authApi.sendOtp(resetForm.email.trim());
      const resetOtp = response?.otp ? String(response.otp).trim() : "";
      if (resetOtp) {
        setResetForm((current) => ({ ...current, otp: resetOtp }));
      }

      setFeedbackMessage(
        "success",
        resetOtp && revealOtpInDev
          ? `Password reset OTP generated for local testing. Use OTP: ${resetOtp}`
          : "Password reset OTP sent to your email. Enter it below with your new password."
      );
    } catch (error) {
      setFeedbackMessage("error", formatAuthError(error.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    const validationMessage = validateResetForm(true);

    if (validationMessage) {
      setFeedbackMessage("error", validationMessage);
      return;
    }

    setLoading(true);
    setFeedbackMessage("", "");
    try {
      await authApi.resetPassword({
        email: resetForm.email.trim(),
        otp: resetForm.otp.trim(),
        newPassword: resetForm.newPassword
      });
      setResetForm(initialReset);
      setLoginForm((current) => ({ ...current, email: resetForm.email.trim(), password: "" }));
      setFeedbackMessage("success", "Password updated. You can log in now with the new password.");
      setMode("login");
    } catch (error) {
      setFeedbackMessage("error", formatAuthError(error.message));
    } finally {
      setLoading(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="auth-page simple-auth-page">
      <div className="auth-panel form-panel auth-card">
        <div className="auth-header">
          <div className="brand auth-brand">
            <span className="brand-mark">F</span>
            <div>
              <strong>FlowBoard</strong>
              <p>{activeTitle}</p>
            </div>
          </div>
        </div>

        <div className="tab-row">
          <button type="button" className={mode === "login" ? "tab active" : "tab"} onClick={() => switchMode("login")}>
            Login
          </button>
          <button type="button" className={mode === "signup" ? "tab active" : "tab"} onClick={() => switchMode("signup")}>
            Signup
          </button>
          <button type="button" className={mode === "reset" ? "tab active" : "tab"} onClick={() => switchMode("reset")}>
            OTP Reset
          </button>
        </div>

        {mode === "login" ? (
          <form className="form-grid" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Password@1"
              />
            </label>
            <div className="auth-inline-actions">
              <p className="auth-note">Login requires the same strong password format enforced by the backend.</p>
              <button type="button" className="link-button" onClick={() => {
                setResetForm((current) => ({ ...current, email: loginForm.email.trim() }));
                switchMode("reset");
              }}>
                Forgot password?
              </button>
            </div>
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
          </form>
        ) : mode === "signup" ? (
          <form className="form-grid" onSubmit={handleSignup}>
            <label>
              Full Name
              <input value={signupForm.fullName} onChange={(event) => setSignupForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Devar Sharma" />
            </label>
            <label>
              Email
              <input value={signupForm.email} onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" />
            </label>
            <div className="auth-inline-actions">
              <p className="auth-note">Verify the email with OTP before the account can be created.</p>
              <button type="button" className="link-button" onClick={handleSendSignupOtp} disabled={loading}>
                {loading ? "Sending OTP..." : "Send Signup OTP"}
              </button>
            </div>
            <label>
              Password
              <input type="password" value={signupForm.password} onChange={(event) => setSignupForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password@1" />
            </label>
            <label>
              Signup OTP
              <input value={signupForm.otp} onChange={(event) => setSignupForm((current) => ({ ...current, otp: event.target.value }))} placeholder="6 character OTP" />
            </label>
            <p className="auth-note">Use Send Signup OTP first. After verification, this form will create the account and you can log in immediately.</p>
            <p className="auth-note">Use a password like `Password@1`. It must include uppercase, lowercase, number, special character, and minimum 8 characters.</p>
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
          </form>
        ) : (
          <div className="form-grid">
            <form className="form-grid" onSubmit={handleSendOtp}>
              <label>
                Registered Email
                <input
                  type="email"
                  value={resetForm.email}
                  onChange={(event) => setResetForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                />
              </label>
              <button className="secondary-button auth-submit" disabled={loading}>{loading ? "Sending OTP..." : "Send OTP"}</button>
            </form>

            <form className="form-grid" onSubmit={handleResetPassword}>
              <label>
                OTP
                <input
                  value={resetForm.otp}
                  onChange={(event) => setResetForm((current) => ({ ...current, otp: event.target.value }))}
                  placeholder="6 character OTP"
                />
              </label>
              <label>
                New Password
                <input
                  type="password"
                  value={resetForm.newPassword}
                  onChange={(event) => setResetForm((current) => ({ ...current, newPassword: event.target.value }))}
                  placeholder="NewPassword@1"
                />
              </label>
              <p className="auth-note">Use Send OTP first. The OTP will be delivered to the registered email address.</p>
              <button className="primary-button auth-submit" disabled={loading}>{loading ? "Updating password..." : "Reset Password"}</button>
            </form>
          </div>
        )}

        {feedback.text ? <p className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>{feedback.text}</p> : null}
      </div>
    </div>
  );
}
