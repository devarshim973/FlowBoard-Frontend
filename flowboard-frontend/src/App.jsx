import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import BoardPage from "./pages/BoardPage";
import AdminPage from "./pages/AdminPage";
import OAuthSuccessPage from "./pages/OAuthSuccessPage";
import { useAuth } from "./state/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return isAdmin ? children : <Navigate to="/app" replace />;
}

function HashScroller() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const id = location.hash.slice(1);
    let attempts = 0;
    let timerId = 0;

    function scrollToHashTarget() {
      const element = document.getElementById(id);

      if (element) {
        element.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }

      attempts += 1;
      if (attempts < 20) {
        timerId = window.setTimeout(scrollToHashTarget, 100);
      }
    }

    timerId = window.setTimeout(scrollToHashTarget, 50);

    return () => window.clearTimeout(timerId);
  }, [location.hash, location.pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <HashScroller />
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/oauth-success" element={<OAuthSuccessPage />} />
        <Route path="/admin/login" element={<AuthPage adminMode />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/board/:boardId"
          element={
            <ProtectedRoute>
              <BoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Routes>
    </>
  );
}

