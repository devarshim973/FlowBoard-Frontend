import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { userApi } from "../services/api";
import { decodeJwt } from "../services/helpers";
import { useAuth } from "../state/AuthContext";

export default function OAuthSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    async function completeGoogleLogin() {
      const token = searchParams.get("token");

      if (!token) {
        setError("Google login did not return a token.");
        return;
      }

      try {
        const payload = decodeJwt(token);
        const userId = payload.userId;

        if (!userId) {
          throw new Error("Google login succeeded but user id is missing.");
        }

        let profile = { fullName: payload.sub || "Google User", email: payload.sub || "" };
        try {
          profile = await userApi.getById(userId, token, userId);
        } catch {
          profile = { fullName: payload.sub || "Google User", email: payload.sub || "" };
        }

        login({
          token,
          userId,
          role: payload.role || "",
          profile
        });

        navigate(payload.role === "PLATFORM_ADMIN" || payload.role === "ADMIN" ? "/app/admin" : "/app", { replace: true });
      } catch (loginError) {
        setError(loginError.message || "Google login failed.");
      }
    }

    completeGoogleLogin();
  }, [login, navigate, searchParams]);

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="auth-page auth-stage">
      <section className="auth-panel form-panel auth-card auth-card-modern auth-processing-card">
        <div className="auth-header auth-header-modern">
          <p className="eyebrow">Google Login</p>
          <h2>{error ? "Unable to finish login" : "Signing you in..."}</h2>
          <p className="auth-subtitle">
            {error || "Your Google account was accepted. We are taking you into FlowBoard now."}
          </p>
        </div>
      </section>
    </div>
  );
}
