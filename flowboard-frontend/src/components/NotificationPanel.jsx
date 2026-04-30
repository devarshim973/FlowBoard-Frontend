import { formatDate } from "../services/helpers";

export default function NotificationPanel({ notifications, onMarkAll }) {
  return (
    <section className="panel" id="notifications">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Notifications</p>
          <h3>Team pulse</h3>
        </div>
        <button className="secondary-button" onClick={onMarkAll}>
          Mark all read
        </button>
      </div>

      <div className="notification-list">
        {notifications.length ? (
          notifications.map((item) => (
            <article key={item.notificationId ?? item.id} className="notification-row">
              <div className={`dot ${item.isRead || item.read ? "read" : "unread"}`} />
              <div>
                <h4>{item.title || item.notificationType || item.type || "Notification"}</h4>
                <p>{item.message || item.content || "FlowBoard update received."}</p>
              </div>
              <span>{formatDate(item.createdAt || item.updatedAt)}</span>
            </article>
          ))
        ) : (
          <div className="empty-panel">
            <h4>No notifications yet</h4>
            <p>Assignments, due reminders, mentions and activity will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
