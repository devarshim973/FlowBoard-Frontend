import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Shell from "../components/Shell";
import { adminApi } from "../services/api";
import { formatDate, unwrapItems } from "../services/helpers";
import { useAuth } from "../state/AuthContext";

export default function AdminPage() {
  const { token, userId } = useAuth();
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAdminData() {
      if (!token || !userId) return;

      setLoading(true);
      setMessage("");

      try {
        const [usersResult, workspacesResult, boardsResult] = await Promise.allSettled([
          adminApi.getUsers(token, userId),
          adminApi.getWorkspaces(token, userId),
          adminApi.getBoards(token, userId)
        ]);

        const errors = [];

        if (usersResult.status === "fulfilled") {
          setUsers(unwrapItems(usersResult.value));
        } else {
          setUsers([]);
          errors.push(`Users: ${usersResult.reason.message}`);
        }

        if (workspacesResult.status === "fulfilled") {
          setWorkspaces(unwrapItems(workspacesResult.value));
        } else {
          setWorkspaces([]);
          errors.push(`Workspaces: ${workspacesResult.reason.message}`);
        }

        if (boardsResult.status === "fulfilled") {
          setBoards(unwrapItems(boardsResult.value));
        } else {
          setBoards([]);
          errors.push(`Boards: ${boardsResult.reason.message}`);
        }

        setMessage(errors.join(" | "));
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, [token, userId]);

  const stats = useMemo(() => ([
    { title: "Registered Users", value: users.length, hint: "All accounts on the platform" },
    { title: "Workspaces", value: workspaces.length, hint: "Owned across every user" },
    { title: "Boards", value: boards.length, hint: "Created across all workspaces" }
  ]), [users.length, workspaces.length, boards.length]);

  async function handleUserAction(action, targetUserId) {
    try {
      if (action === "delete") {
        await adminApi.deleteUser(targetUserId, token, userId);
        setUsers((current) => current.filter((user) => user.userId !== targetUserId));
      } else if (action === "disable") {
        await adminApi.disableUser(targetUserId, token, userId);
        setUsers((current) => current.map((user) => (
          user.userId === targetUserId ? { ...user, active: false, isActive: false } : user
        )));
      } else if (action === "enable") {
        await adminApi.enableUser(targetUserId, token, userId);
        setUsers((current) => current.map((user) => (
          user.userId === targetUserId ? { ...user, active: true, isActive: true } : user
        )));
      }
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteWorkspace(workspaceId) {
    try {
      await adminApi.deleteWorkspace(workspaceId, token, userId);
      setWorkspaces((current) => current.filter((workspace) => workspace.workspaceId !== workspaceId));
      setBoards((current) => current.filter((board) => board.workspaceId !== workspaceId));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteBoard(boardId) {
    try {
      await adminApi.deleteBoard(boardId, token, userId);
      setBoards((current) => current.filter((board) => board.boardId !== boardId));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <Shell
      title="Platform Admin"
      subtitle="Review all registered users and moderate platform-wide workspace and board data."
      membershipLabel="Platform Admin"
      actions={<button type="button" className="primary-button" onClick={() => window.location.reload()}>Refresh admin data</button>}
    >
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Admin Login</p>
            <h3>Dedicated admin entry</h3>
          </div>
          <Link className="secondary-button" to="/admin/login">Open admin login</Link>
        </div>
      </div>

      <section className="metrics-grid">
        {stats.map((item) => (
          <article key={item.title} className="metric-card tone-cyan">
            <p>{item.title}</p>
            <h3>{loading ? "..." : item.value}</h3>
            <span>{item.hint}</span>
          </article>
        ))}
      </section>

      {message ? <div className="feedback-banner">{message}</div> : null}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Users</p>
            <h3>All registered accounts</h3>
          </div>
        </div>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {users.map((user) => {
            const active = user.isActive ?? user.active;
            const isCurrentAdmin = String(user.userId) === String(userId);
            return (
              <div key={user.userId} className="admin-table-row">
                <span>{user.fullName || "Unknown"}</span>
                <span>{user.email}</span>
                <span>{user.role || "USER"}</span>
                <span>{active ? "Active" : "Disabled"}</span>
                <span className="admin-actions">
                  {active ? (
                    <button type="button" className="secondary-button" onClick={() => handleUserAction("disable", user.userId)} disabled={isCurrentAdmin}>Disable</button>
                  ) : (
                    <button type="button" className="secondary-button" onClick={() => handleUserAction("enable", user.userId)}>Enable</button>
                  )}
                  <button type="button" className="ghost-button" onClick={() => handleUserAction("delete", user.userId)} disabled={isCurrentAdmin}>Delete</button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Workspaces</p>
              <h3>All workspace data</h3>
            </div>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Name</span>
              <span>Owner ID</span>
              <span>Visibility</span>
              <span>Created</span>
              <span>Actions</span>
            </div>
            {workspaces.map((workspace) => (
              <div key={workspace.workspaceId} className="admin-table-row">
                <span>{workspace.name}</span>
                <span>{workspace.ownerId}</span>
                <span>{workspace.visibility}</span>
                <span>{formatDate(workspace.createdAt)}</span>
                <span className="admin-actions">
                  <button type="button" className="ghost-button" onClick={() => handleDeleteWorkspace(workspace.workspaceId)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Boards</p>
              <h3>All board data</h3>
            </div>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Name</span>
              <span>Workspace</span>
              <span>Created By</span>
              <span>Visibility</span>
              <span>Actions</span>
            </div>
            {boards.map((board) => (
              <div key={board.boardId} className="admin-table-row">
                <span>{board.name}</span>
                <span>{board.workspaceId}</span>
                <span>{board.createdById}</span>
                <span>{board.visibility}</span>
                <span className="admin-actions">
                  <button type="button" className="ghost-button" onClick={() => handleDeleteBoard(board.boardId)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
