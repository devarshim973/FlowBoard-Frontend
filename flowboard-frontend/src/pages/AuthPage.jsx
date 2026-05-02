import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THEME_STORAGE_KEY = "flowboard-theme";

function formatAuthError(message) {
  if (!message) {
    return "Something went wrong. Please try again.";
  }

  if (message.includes("ROLE.USER")) {
    return "Admin signup is not available right now. Create a normal account instead.";
  }

  if (message.includes("User already exist")) {
    return "This email is already registered. Try logging in instead.";
  }

  if (message.includes("Signup OTP is required")) {
    return "Send the signup OTP first, then enter it here to complete registration.";
  }

  if (message.includes("SMTP authentication failed")) {
    return "OTP email could not be delivered because SMTP_USERNAME or SMTP_APP_PASSWORD is wrong.";
  }

  if (message.includes("SMTP email is not configured")) {
    return "OTP email could not be delivered because SMTP_USERNAME, SMTP_APP_PASSWORD, or SMTP_FROM_EMAIL is missing in auth-service.";
  }

  if (message.includes("Unable to send email via SMTP")) {
    return "OTP email could not be delivered. Check Gmail SMTP settings and the generated app password.";
  }

  if (message.includes("Unable to send email")) {
    return "OTP email could not be delivered because the email provider is not configured correctly yet.";
  }

  if (message.includes("disabled") || message.includes("Bad credentials")) {
    return "Email or password is incorrect. Create the account first, then log in with the same password.";
  }

  return message;
}

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [theme, setTheme] = useState(getInitialTheme);
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const activeTitle = useMemo(() => {
    if (mode === "signup") return "Create an account that feels ready on day one";
    return "Sign in and continue building with your team";
  }, [mode]);

  function setFeedbackMessage(type, text) {
    setFeedback(text ? { type, text } : { type: "", text: "" });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setFeedbackMessage("", "");
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
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
      setFeedbackMessage("success", "Account created successfully. Now sign in to enter FlowBoard.");
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
      await authApi.sendSignupOtp(signupForm.email.trim());
      setFeedbackMessage("success", "Signup OTP sent to your email. Enter it below to finish creating your account.");
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

      try {
        profile = await userApi.getById(userId, token, userId);
      } catch {
        profile = { fullName: loginForm.email.trim(), email: loginForm.email.trim() };
      }

      login({ token, userId, role: payload.role || "", profile });
      navigate(payload.role === "PLATFORM_ADMIN" ? "/app/admin" : "/app");
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
    <div className="auth-page auth-stage">
      <section className="auth-showcase panel auth-showcase-panel">
        <div className="auth-showcase-top">
          <div className="brand auth-brand auth-brand-large">
            <span className="brand-mark">F</span>
            <div>
              <strong>FlowBoard</strong>
              <p>Organize boards, lists, cards, and team momentum from one place.</p>
            </div>
          </div>
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle light and dark theme">
            <span>{theme === "light" ? "Dark" : "Light"} mode</span>
          </button>
        </div>

        <div className="auth-showcase-copy">
          <p className="eyebrow">Project Focus</p>
          <h1>Workflows that stay clear even when the project gets messy.</h1>
          <p className="landing-copy auth-copy">
            Move from signup to shipping with a cleaner auth screen, stronger visual hierarchy, and a theme switch that feels built in instead of added later.
          </p>
        </div>

        <div className="auth-feature-grid">
          <article className="auth-feature-card">
            <span className="auth-feature-kicker">Boards</span>
            <h3>Plan work visually</h3>
            <p>Track priorities, ownership, and status without losing the bigger picture.</p>
          </article>
          <article className="auth-feature-card">
            <span className="auth-feature-kicker">Teams</span>
            <h3>Keep collaboration calm</h3>
            <p>Give everyone one place to check progress, updates, and what needs attention next.</p>
          </article>
          <article className="auth-feature-card accent-card">
            <span className="auth-feature-kicker">Theme</span>
            <h3>{theme === "light" ? "Warm light mode" : "Focused dark mode"}</h3>
            <p>Switch the atmosphere instantly without leaving the page or resetting the form.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel form-panel auth-card auth-card-modern">
        <div className="auth-header auth-header-modern">
          <p className="eyebrow">Welcome Back</p>
          <h2>{mode === "signup" ? "Create your FlowBoard account" : "Login to your workspace"}</h2>
          <p className="auth-subtitle">{activeTitle}</p>
        </div>

        <div className="tab-row auth-tab-row">
          <button type="button" className={mode === "login" ? "tab active" : "tab"} onClick={() => switchMode("login")}>
            Login
          </button>
          <button type="button" className={mode === "signup" ? "tab active" : "tab"} onClick={() => switchMode("signup")}>
            Signup
          </button>
        </div>

        {mode === "login" ? (
          <form className="form-grid auth-form-grid" onSubmit={handleLogin}>
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
            <p className="auth-note auth-note-soft">Use the same password format enforced by the backend so login and signup stay consistent.</p>
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
          </form>
        ) : (
          <form className="form-grid auth-form-grid" onSubmit={handleSignup}>
            <label>
              Full Name
              <input value={signupForm.fullName} onChange={(event) => setSignupForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Devar Sharma" />
            </label>
            <label>
              Email
              <input value={signupForm.email} onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" />
            </label>
            <div className="otp-request-row">
              <p className="auth-note auth-note-soft">Send the OTP first, then enter it below to finish creating the account.</p>
              <button type="button" className="secondary-button otp-button" onClick={handleSendSignupOtp} disabled={loading}>
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
            <p className="auth-note auth-note-soft">Password must include uppercase, lowercase, number, special character, and at least 8 characters.</p>
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
          </form>
        )}

        {feedback.text ? <p className={`feedback ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>{feedback.text}</p> : null}
      </section>
    </div>
  );
}
