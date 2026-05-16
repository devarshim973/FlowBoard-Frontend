import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import Modal from "../components/Modal";
import NotificationPanel from "../components/NotificationPanel";
import Shell from "../components/Shell";
import WorkspaceCard from "../components/WorkspaceCard";
import { boardApi, cardApi, notificationApi, paymentApi, workspaceApi } from "../services/api";
import { formatDate, getBoardId, getWorkspaceId, unwrapItems } from "../services/helpers";
import { useAuth } from "../state/AuthContext";

const DISMISSED_DUE_REMINDERS_KEY = "flowboard-dismissed-due-reminders";

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function readDismissedDueReminderIds() {
  try {
    const stored = window.localStorage.getItem(DISMISSED_DUE_REMINDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeDismissedDueReminderIds(ids) {
  try {
    window.localStorage.setItem(DISMISSED_DUE_REMINDERS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage issues and keep the reminder dismissed for the current session only.
  }
}

function buildDueDateReminder(card, board) {
  if (!card?.dueDate || card.status === "DONE") {
    return null;
  }

  const dueDate = new Date(card.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const today = startOfDay(new Date());
  const dueDay = startOfDay(dueDate);
  const dayDifference = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  let title = "";
  let message = "";

  if (dayDifference < 0) {
    title = "Overdue task";
    message = `"${card.title || "Untitled card"}" was due on ${formatDate(card.dueDate)}${board?.name ? ` in ${board.name}` : ""}.`;
  } else if (dayDifference === 0) {
    title = "Due today";
    message = `"${card.title || "Untitled card"}" is due today${board?.name ? ` in ${board.name}` : ""}.`;
  } else if (dayDifference === 1) {
    title = "Due tomorrow";
    message = `"${card.title || "Untitled card"}" is due tomorrow (${formatDate(card.dueDate)})${board?.name ? ` in ${board.name}` : ""}.`;
  } else if (dayDifference <= 3) {
    title = "Upcoming due date";
    message = `"${card.title || "Untitled card"}" is due on ${formatDate(card.dueDate)}${board?.name ? ` in ${board.name}` : ""}.`;
  } else {
    return null;
  }

  return {
    notificationId: `due-${card.cardId ?? card.id}`,
    notificationType: "DUE_DATE",
    title,
    message,
    createdAt: card.dueDate,
    isRead: false,
    source: "due-date-reminder"
  };
}

function mergeNotifications(baseNotifications, reminders) {
  const mapped = new Map();

  [...reminders, ...baseNotifications].forEach((item) => {
    const key = item.notificationId ?? item.id ?? `${item.notificationType}-${item.createdAt}-${item.message}`;
    if (!mapped.has(key)) {
      mapped.set(key, item);
    }
  });

  return Array.from(mapped.values()).sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.updatedAt || 0).getTime();
    const rightTime = new Date(right.createdAt || right.updatedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export default function DashboardPage() {
  const FREE_WORKSPACE_LIMIT = 3;
  const { token, userId } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [boardsByWorkspace, setBoardsByWorkspace] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState(null);
  const [boardModalState, setBoardModalState] = useState({ open: false, workspaceId: "", boardId: null });
  const [workspaceForm, setWorkspaceForm] = useState({ name: "", description: "", visibility: "PRIVATE", logoUrl: "https://placehold.co/120x120/png" });
  const [boardForm, setBoardForm] = useState({ workspaceId: "", name: "", description: "", visibility: "PRIVATE", background: "#0ea5e9" });
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const fallbackOwnedWorkspaceCount = workspaces.length;
  const activeSubscription = subscriptionStatus?.active === true;
  const countedOwnedWorkspaces = workspaces.filter((workspace) => String(workspace.ownerId ?? "") === String(userId)).length;
  const ownedWorkspaceCount = countedOwnedWorkspaces > 0 ? countedOwnedWorkspaces : fallbackOwnedWorkspaceCount;
  const limitMessageShown = message.includes("Workspace limit reached") || message.includes("Payment service not available");
  const showUpgradeControls = !activeSubscription && (upgradeRequired || limitMessageShown || ownedWorkspaceCount >= FREE_WORKSPACE_LIMIT);
  const requiresWorkspaceUpgrade = showUpgradeControls;
  const workspaceActionLabel = paymentLoading
    ? "Opening checkout..."
    : showUpgradeControls
      ? "Upgrade Now"
      : "New workspace";

  useEffect(() => {
    async function loadData() {
      if (!token || !userId) return;

      const errors = [];
      const dismissedDueReminderIds = new Set(readDismissedDueReminderIds());

      try {
        const workspaceResponse = await workspaceApi.getMine(token, userId);
        const nextWorkspaces = unwrapItems(workspaceResponse);
        setWorkspaces(nextWorkspaces);

        const groupedBoards = {};
        const dueDateReminders = [];
        for (const workspace of nextWorkspaces) {
          const workspaceId = getWorkspaceId(workspace);
          try {
            const privateBoards = await boardApi.getPrivate(workspaceId, token, userId);
            const boards = unwrapItems(privateBoards);
            groupedBoards[workspaceId] = boards;

            for (const board of boards) {
              const boardId = getBoardId(board);
              if (!boardId) continue;

              try {
                const cards = unwrapItems(await cardApi.getByBoard(boardId, token, userId));
                cards
                  .map((card) => buildDueDateReminder(card, board))
                  .filter(Boolean)
                  .filter((item) => !dismissedDueReminderIds.has(String(item.notificationId)))
                  .forEach((item) => dueDateReminders.push(item));
              } catch (error) {
                errors.push(`Cards for board ${board.name || boardId}: ${error.message}`);
              }
            }
          } catch (error) {
            groupedBoards[workspaceId] = [];
            errors.push(`Boards for workspace ${workspace.name || workspaceId}: ${error.message}`);
          }
        }
        setBoardsByWorkspace(groupedBoards);

        try {
          const notificationResponse = await notificationApi.getByRecipient(userId, token, userId);
          const backendNotifications = unwrapItems(notificationResponse);
          setNotifications(mergeNotifications(backendNotifications, dueDateReminders));
        } catch (error) {
          setNotifications(mergeNotifications([], dueDateReminders));
          errors.push(`Notifications: ${error.message}`);
        }
      } catch (error) {
        setWorkspaces([]);
        setBoardsByWorkspace({});
        setNotifications([]);
        errors.push(`Workspaces: ${error.message}`);
      }

      try {
        const unread = await notificationApi.unreadCount(userId, token, userId);
        setNotificationCount(Number(unread) || 0);
      } catch (error) {
        setNotificationCount(0);
        errors.push(`Unread alerts: ${error.message}`);
      }

      try {
        const subscription = await paymentApi.getStatus(token, userId);
        setSubscriptionStatus(subscription);
      } catch (error) {
        setSubscriptionStatus(null);
        console.warn("Subscription status could not be loaded", error);
      }

      setMessage(errors.join(" | "));
    }

    loadData();
  }, [token, userId]);

  useEffect(() => {
    if (requiresWorkspaceUpgrade && workspaceModalOpen) {
      setWorkspaceModalOpen(false);
    }
  }, [requiresWorkspaceUpgrade, workspaceModalOpen]);

  async function ensureRazorpayLoaded() {
    if (window.Razorpay) {
      return true;
    }

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function persistWorkspace(payload) {
    const created = await workspaceApi.create(payload, token, userId);
    const workspaceId = getWorkspaceId(created);
    setWorkspaces((current) => [created, ...current]);
    setBoardsByWorkspace((current) => ({ ...current, [workspaceId]: [] }));
    setWorkspaceModalOpen(false);
    setEditingWorkspaceId(null);
    setWorkspaceForm({ name: "", description: "", visibility: "PRIVATE", logoUrl: "https://placehold.co/120x120/png" });
    return created;
  }

  async function updateWorkspace(payload) {
    const updated = await workspaceApi.update(editingWorkspaceId, payload, token, userId);
    setWorkspaces((current) =>
      current.map((item) => (getWorkspaceId(item) === editingWorkspaceId ? updated : item))
    );
    setWorkspaceModalOpen(false);
    setEditingWorkspaceId(null);
    setWorkspaceForm({ name: "", description: "", visibility: "PRIVATE", logoUrl: "https://placehold.co/120x120/png" });
    return updated;
  }

  async function startWorkspaceUpgrade(pendingWorkspace = null) {
    if (!token || !userId) return;

    setMessage("");
    setUpgradeRequired(true);
    setWorkspaceModalOpen(false);
    setPaymentLoading(true);
    try {
      const scriptLoaded = await ensureRazorpayLoaded();
      if (!scriptLoaded) {
        throw new Error("Razorpay checkout could not be loaded.");
      }

      const order = await paymentApi.createOrder(token, userId);
      const razorpay = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: order.planName,
        description: order.description,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            const verifiedStatus = await paymentApi.verify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            }, token, userId);
            setSubscriptionStatus(verifiedStatus);
            setUpgradeRequired(false);

            if (pendingWorkspace) {
              await persistWorkspace(pendingWorkspace);
              setWorkspaces((current) => current);
              setMessage("Payment verified and workspace created successfully.");
            } else {
              setWorkspaceModalOpen(true);
              setMessage("Payment verified. You can now create more workspaces.");
            }
          } catch (error) {
            setMessage(error.message);
          } finally {
            setPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
          }
        },
        prefill: {},
        theme: {
          color: "#0f766e"
        }
      });
      razorpay.open();
    } catch (error) {
      setPaymentLoading(false);
      setMessage(error.message);
    }
  }

  async function createWorkspace(event) {
    event.preventDefault();

    if (editingWorkspaceId) {
      try {
        await updateWorkspace(workspaceForm);
        setMessage("");
      } catch (error) {
        setMessage(error.message);
      }
      return;
    }

    if (requiresWorkspaceUpgrade) {
      await startWorkspaceUpgrade({ ...workspaceForm });
      return;
    }

    try {
      await persistWorkspace(workspaceForm);
      setUpgradeRequired(false);
      setMessage("");
    } catch (error) {
      if (error.message.includes("Workspace limit reached") || error.message.includes("Payment service not available")) {
        setUpgradeRequired(true);
        await startWorkspaceUpgrade({ ...workspaceForm });
        return;
      }

      setMessage(error.message);
    }
  }

  function handleEditWorkspace(workspace) {
    setEditingWorkspaceId(getWorkspaceId(workspace));
    setWorkspaceForm({
      name: workspace.name || "",
      description: workspace.description || "",
      visibility: workspace.visibility || "PRIVATE",
      logoUrl: workspace.logoUrl || "https://placehold.co/120x120/png"
    });
    setWorkspaceModalOpen(true);
  }

  async function createBoard(event) {
    event.preventDefault();
    try {
      const workspaceId = Number(boardForm.workspaceId);
      if (boardModalState.boardId) {
        const updated = await boardApi.update(boardModalState.boardId, {
          workspaceId,
          name: boardForm.name,
          description: boardForm.description,
          visibility: boardForm.visibility,
          background: boardForm.background
        }, token, userId);
        setBoardsByWorkspace((current) => ({
          ...current,
          [workspaceId]: (current[workspaceId] || []).map((item) =>
            (item.boardId ?? item.id) === boardModalState.boardId ? updated : item
          )
        }));
      } else {
        const created = await boardApi.create({ workspaceId, name: boardForm.name, description: boardForm.description, visibility: boardForm.visibility, background: boardForm.background }, token, userId);
        setBoardsByWorkspace((current) => ({ ...current, [workspaceId]: [created, ...(current[workspaceId] || [])] }));
        navigate(`/app/board/${created.boardId ?? created.id}`);
      }
      setBoardModalState({ open: false, workspaceId: "", boardId: null });
      setBoardForm({ workspaceId: "", name: "", description: "", visibility: "PRIVATE", background: "#0ea5e9" });
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleEditBoard(board, workspaceId) {
    setBoardModalState({ open: true, workspaceId, boardId: board.boardId ?? board.id });
    setBoardForm({
      workspaceId,
      name: board.name || "",
      description: board.description || "",
      visibility: board.visibility || "PRIVATE",
      background: board.background || "#0ea5e9"
    });
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllRead(userId, token, userId);
      setNotificationCount(0);
      setNotifications([]);
      writeDismissedDueReminderIds(
        notifications
          .filter((item) => item.source === "due-date-reminder")
          .map((item) => String(item.notificationId))
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleNotificationClick(notification) {
    const notificationId = notification.notificationId ?? notification.id;

    try {
      if (notification.source === "due-date-reminder") {
        const dismissedIds = Array.from(new Set([
          ...readDismissedDueReminderIds(),
          String(notificationId)
        ]));
        writeDismissedDueReminderIds(dismissedIds);
      } else if (notificationId) {
        await notificationApi.markRead(notificationId, token, userId);
        setNotificationCount((current) => Math.max(0, current - 1));
      }

      setNotifications((current) =>
        current.filter((item) => (item.notificationId ?? item.id) !== notificationId)
      );
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteWorkspace(workspace) {
    const workspaceId = getWorkspaceId(workspace);
    if (!workspaceId || !confirm(`Delete workspace "${workspace.name || "Untitled Workspace"}"?`)) return;

    try {
      await workspaceApi.delete(workspaceId, token, userId);
      setWorkspaces((current) => current.filter((item) => getWorkspaceId(item) !== workspaceId));
      setBoardsByWorkspace((current) => {
        const next = { ...current };
        delete next[workspaceId];
        return next;
      });
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteBoard(board, workspaceId) {
    const boardId = board.boardId ?? board.id;
    if (!boardId || !confirm(`Delete board "${board.name || "Untitled Board"}"?`)) return;

    try {
      await boardApi.delete(boardId, token, userId);
      setBoardsByWorkspace((current) => ({
        ...current,
        [workspaceId]: (current[workspaceId] || []).filter((item) => (item.boardId ?? item.id) !== boardId)
      }));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <Shell
      title="Control Center"
      subtitle="A clearer view of boards and activity."
      notificationCount={notificationCount}
      membershipLabel={activeSubscription ? "Premium" : "Collaborator"}
      actions={<button className="primary-button" disabled={paymentLoading} onClick={() => {
        if (requiresWorkspaceUpgrade) {
          startWorkspaceUpgrade();
          return;
        }

        setEditingWorkspaceId(null);
        setWorkspaceForm({ name: "", description: "", visibility: "PRIVATE", logoUrl: "https://placehold.co/120x120/png" });
        setWorkspaceModalOpen(true);
      }}>{workspaceActionLabel}</button>}
    >
      <div className="dashboard-surface">
        <section className="dashboard-hero">
          <article className="hero-spotlight">
            <p className="eyebrow">Workspace overview</p>
            <h2>{workspaces.length ? `You have ${workspaces.length} workspace${workspaces.length > 1 ? "s" : ""} in motion.` : "Launch your first workspace."}</h2>
            <p className="hero-text">
              Keep boards organized, watch recent activity, and manage team flow from one focused dashboard.
            </p>
            <div className="hero-actions-row">
              <button
                type="button"
                className="primary-button"
                disabled={paymentLoading}
                onClick={() => {
                  if (requiresWorkspaceUpgrade) {
                    startWorkspaceUpgrade();
                    return;
                  }

                  setEditingWorkspaceId(null);
                  setWorkspaceForm({ name: "", description: "", visibility: "PRIVATE", logoUrl: "https://placehold.co/120x120/png" });
                  setWorkspaceModalOpen(true);
                }}
              >
                {workspaceActionLabel}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  document.getElementById("boards")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Explore boards
              </button>
            </div>
          </article>

          <aside className="hero-rail">
            <article className="hero-mini-card hero-mini-card-plan">
              <span className="hero-mini-label">Plan</span>
              <strong>{activeSubscription ? "Premium Active" : "Free Plan"}</strong>
              <p>{activeSubscription ? "Unlimited workspace creation unlocked." : `${ownedWorkspaceCount}/${FREE_WORKSPACE_LIMIT} owned workspace slots used.`}</p>
            </article>
          </aside>
        </section>

        <section className="metrics-grid dashboard-metrics">
          <MetricCard title="Workspaces" value={workspaces.length} hint="Personal and team spaces" delay={80} />
          <MetricCard title="Boards" value={Object.values(boardsByWorkspace).flat().length} hint="Across all active workspaces" tone="green" delay={160} />
          <MetricCard title="Plan" value={activeSubscription ? "Premium" : "Free"} hint={activeSubscription ? "Unlimited workspaces unlocked" : `${ownedWorkspaceCount}/${FREE_WORKSPACE_LIMIT} owned workspaces used`} delay={240} />
        </section>
      </div>

      {showUpgradeControls ? (
        <section
          className="panel"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "20px"
          }}
        >
          <div>
            <p className="eyebrow">Upgrade Required</p>
            <h3 style={{ margin: 0 }}>Create more than 3 workspaces with Premium</h3>
            <p style={{ margin: "8px 0 0 0" }}>Click the button to open Razorpay payment and unlock more workspace creation.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={paymentLoading}
            onClick={() => startWorkspaceUpgrade()}
          >
            {paymentLoading ? "Opening checkout..." : "Upgrade Now"}
          </button>
        </section>
      ) : null}

      {message ? (
        <div
          className="feedback-banner"
          onClick={limitMessageShown && !paymentLoading ? () => startWorkspaceUpgrade() : undefined}
          style={limitMessageShown ? { cursor: "pointer" } : undefined}
        >
          {limitMessageShown ? (
            <>
              <span>Free plan limit reached. Click this banner or the button to open Razorpay payment and continue creating workspaces.</span>
              <button
                type="button"
                className="primary-button"
                disabled={paymentLoading}
                onClick={(event) => {
                  event.stopPropagation();
                  startWorkspaceUpgrade();
                }}
                style={{ marginLeft: "12px" }}
              >
                {paymentLoading ? "Opening checkout..." : "Upgrade Now"}
              </button>
            </>
          ) : message}
        </div>
      ) : null}
      {activeSubscription ? <div className="feedback-banner">Premium is active on this account. You can create unlimited workspaces now.</div> : null}
      <div className="dashboard-grid">
        <div className="dashboard-main" id="boards">
          {workspaces.length ? (
            workspaces.map((workspace) => {
              const workspaceId = getWorkspaceId(workspace);
              return <WorkspaceCard key={workspaceId} workspace={workspace} boards={boardsByWorkspace[workspaceId] || []} onCreateBoard={(selectedWorkspaceId) => {
                setBoardModalState({ open: true, workspaceId: selectedWorkspaceId, boardId: null });
                setBoardForm((current) => ({ ...current, workspaceId: selectedWorkspaceId }));
              }} onEditWorkspace={handleEditWorkspace} onEditBoard={handleEditBoard} onDeleteWorkspace={handleDeleteWorkspace} onDeleteBoard={handleDeleteBoard} />;
            })
          ) : (
            <section className="panel">
              <div className="empty-panel">
                <h3>No workspaces yet</h3>
                <p>Create your first workspace to start matching the case-study flow.</p>
              </div>
            </section>
          )}

          <section className="panel" id="timeline">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Timeline</p>
                <h3>Latest workspace activity</h3>
              </div>
            </div>

            <div className="timeline-list">
              {workspaces.length || Object.values(boardsByWorkspace).flat().length ? (
                [
                  ...workspaces.map((workspace) => ({
                    id: `workspace-${getWorkspaceId(workspace)}`,
                    title: workspace.name || "Workspace created",
                    description: workspace.description || "Workspace is ready for new boards.",
                    label: workspace.visibility || "Workspace"
                  })),
                  ...Object.values(boardsByWorkspace)
                    .flat()
                    .map((board) => ({
                      id: `board-${board.boardId ?? board.id}`,
                      title: board.name || "Board created",
                      description: board.description || "Board is ready for lists and cards.",
                      label: board.visibility || "Board"
                    }))
                ]
                  .slice(0, 6)
                  .map((item) => (
                    <article key={item.id} className="timeline-row">
                      <div className="timeline-dot" />
                      <div>
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                      </div>
                      <span>{item.label}</span>
                    </article>
                  ))
              ) : (
                <div className="empty-panel">
                  <h4>No activity yet</h4>
                  <p>Create a workspace or board and your latest activity will appear here.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <NotificationPanel notifications={notifications} onMarkAll={markAllRead} onNotificationClick={handleNotificationClick} />
      </div>

      <Modal open={workspaceModalOpen} title={editingWorkspaceId ? "Edit workspace" : "Create workspace"} onClose={() => {
        setWorkspaceModalOpen(false);
        setEditingWorkspaceId(null);
      }}>
        <form className="form-grid" onSubmit={createWorkspace}>
          {showUpgradeControls && !editingWorkspaceId ? (
            <>
              <p className="auth-note">Free plan is capped at 3 owned workspaces. Use upgrade to open Razorpay and unlock more workspaces.</p>
              <button
                type="button"
                className="primary-button"
                disabled={paymentLoading}
                onClick={() => startWorkspaceUpgrade({ ...workspaceForm })}
              >
                {paymentLoading ? "Opening checkout..." : "Upgrade Plan"}
              </button>
            </>
          ) : null}
          <label>
            Workspace name
            <input value={workspaceForm.name} onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea value={workspaceForm.description} onChange={(event) => setWorkspaceForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Visibility
            <select value={workspaceForm.visibility} onChange={(event) => setWorkspaceForm((current) => ({ ...current, visibility: event.target.value }))}>
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>
          <label>
            Logo URL
            <input value={workspaceForm.logoUrl} onChange={(event) => setWorkspaceForm((current) => ({ ...current, logoUrl: event.target.value }))} />
          </label>
          <button className="primary-button">
            {editingWorkspaceId ? "Update workspace" : showUpgradeControls ? "Create after upgrade" : "Create workspace"}
          </button>
        </form>
      </Modal>

      <Modal open={boardModalState.open} title={boardModalState.boardId ? "Edit board" : "Create board"} onClose={() => setBoardModalState({ open: false, workspaceId: "", boardId: null })}>
        <form className="form-grid" onSubmit={createBoard}>
          <label>
            Board name
            <input value={boardForm.name} onChange={(event) => setBoardForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea value={boardForm.description} onChange={(event) => setBoardForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Visibility
            <select value={boardForm.visibility} onChange={(event) => setBoardForm((current) => ({ ...current, visibility: event.target.value }))}>
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>
          <label>
            Accent color
            <input type="color" value={boardForm.background} onChange={(event) => setBoardForm((current) => ({ ...current, background: event.target.value }))} />
          </label>
          <button className="primary-button">{boardModalState.boardId ? "Update board" : "Create board"}</button>
        </form>
      </Modal>
    </Shell>
  );
}
