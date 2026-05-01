import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import Modal from "../components/Modal";
import NotificationPanel from "../components/NotificationPanel";
import Shell from "../components/Shell";
import WorkspaceCard from "../components/WorkspaceCard";
import { boardApi, notificationApi, paymentApi, workspaceApi } from "../services/api";
import { getWorkspaceId, unwrapItems } from "../services/helpers";
import { useAuth } from "../state/AuthContext";

export default function DashboardPage() {
  const FREE_WORKSPACE_LIMIT = 3;
  const { token, userId } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [boardsByWorkspace, setBoardsByWorkspace] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [boardModalState, setBoardModalState] = useState({ open: false, workspaceId: "" });
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

      try {
        const workspaceResponse = await workspaceApi.getMine(token, userId);
        const nextWorkspaces = unwrapItems(workspaceResponse);
        setWorkspaces(nextWorkspaces);

        const groupedBoards = {};
        for (const workspace of nextWorkspaces) {
          const workspaceId = getWorkspaceId(workspace);
          try {
            const privateBoards = await boardApi.getPrivate(workspaceId, token, userId);
            groupedBoards[workspaceId] = unwrapItems(privateBoards);
          } catch (error) {
            groupedBoards[workspaceId] = [];
            errors.push(`Boards for workspace ${workspace.name || workspaceId}: ${error.message}`);
          }
        }
        setBoardsByWorkspace(groupedBoards);
      } catch (error) {
        setWorkspaces([]);
        setBoardsByWorkspace({});
        errors.push(`Workspaces: ${error.message}`);
      }

      try {
        const notificationResponse = await notificationApi.getByRecipient(userId, token, userId);
        setNotifications(unwrapItems(notificationResponse));
      } catch (error) {
        setNotifications([]);
        errors.push(`Notifications: ${error.message}`);
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
    setWorkspaceForm({ name: "", description: "", visibility: "PRIVATE", logoUrl: "https://placehold.co/120x120/png" });
    return created;
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

  async function createBoard(event) {
    event.preventDefault();
    try {
      const workspaceId = Number(boardForm.workspaceId);
      const created = await boardApi.create({ workspaceId, name: boardForm.name, description: boardForm.description, visibility: boardForm.visibility, background: boardForm.background }, token, userId);
      setBoardsByWorkspace((current) => ({ ...current, [workspaceId]: [created, ...(current[workspaceId] || [])] }));
      setBoardModalState({ open: false, workspaceId: "" });
      setBoardForm({ workspaceId: "", name: "", description: "", visibility: "PRIVATE", background: "#0ea5e9" });
      navigate(`/app/board/${created.boardId ?? created.id}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllRead(userId, token, userId);
      setNotificationCount(0);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true, read: true })));
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <Shell
      title="Workspace Command"
      subtitle="Track your delivery pulse, open boards fast, and orchestrate team movement."
      notificationCount={notificationCount}
      membershipLabel={activeSubscription ? "Premium" : "Collaborator"}
      actions={<button className="primary-button" disabled={paymentLoading} onClick={() => {
        if (requiresWorkspaceUpgrade) {
          startWorkspaceUpgrade();
          return;
        }

        setWorkspaceModalOpen(true);
      }}>{workspaceActionLabel}</button>}
    >
      <section className="metrics-grid">
        <MetricCard title="Workspaces" value={workspaces.length} hint="Personal and team spaces" />
        <MetricCard title="Boards" value={Object.values(boardsByWorkspace).flat().length} hint="Across all active workspaces" tone="green" />
        <MetricCard title="Unread Alerts" value={notificationCount} hint="Assignments and reminders" tone="orange" />
        <MetricCard title="Plan" value={activeSubscription ? "Premium" : "Free"} hint={activeSubscription ? "Unlimited workspaces unlocked" : `${ownedWorkspaceCount}/${FREE_WORKSPACE_LIMIT} owned workspaces used`} />
      </section>

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
      {showUpgradeControls ? (
        <div className="feedback-banner">
          <strong>Upgrade required.</strong> Free plan allows 3 owned workspaces.
          <button
            type="button"
            className="primary-button"
            disabled={paymentLoading}
            onClick={() => startWorkspaceUpgrade()}
            style={{ marginLeft: "12px" }}
          >
            {paymentLoading ? "Opening checkout..." : "Upgrade Now"}
          </button>
        </div>
      ) : null}

      <div className="dashboard-grid">
        <div className="dashboard-main" id="boards">
          {workspaces.length ? (
            workspaces.map((workspace) => {
              const workspaceId = getWorkspaceId(workspace);
              return <WorkspaceCard key={workspaceId} workspace={workspace} boards={boardsByWorkspace[workspaceId] || []} onCreateBoard={(selectedWorkspaceId) => {
                setBoardModalState({ open: true, workspaceId: selectedWorkspaceId });
                setBoardForm((current) => ({ ...current, workspaceId: selectedWorkspaceId }));
              }} />;
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

        <NotificationPanel notifications={notifications} onMarkAll={markAllRead} />
      </div>

      <Modal open={workspaceModalOpen} title="Create workspace" onClose={() => setWorkspaceModalOpen(false)}>
        <form className="form-grid" onSubmit={createWorkspace}>
          {showUpgradeControls ? (
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
          <button className="primary-button">{showUpgradeControls ? "Create after upgrade" : "Create workspace"}</button>
        </form>
      </Modal>

      <Modal open={boardModalState.open} title="Create board" onClose={() => setBoardModalState({ open: false, workspaceId: "" })}>
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
          <button className="primary-button">Create board</button>
        </form>
      </Modal>
    </Shell>
  );
}
