import { formatDate, getCardId } from "../services/helpers";

export default function BoardColumn({ list, onCreateCard, onQuickStatus, onDragStart, onDrop, onDragOver, onEditCard, onDeleteCard, onDeleteList, onAddComment }) {
  return (
    <section className="board-column" onDrop={(e) => onDrop(e, list)} onDragOver={onDragOver}>
      <div className="column-head">
        <div>
          <p className="eyebrow">List</p>
          <h3>{list.name || "Untitled List"}</h3>
        </div>
        <div className="column-actions">
          <span>{list.cards.length} cards</span>
          <button className="link-button danger-link" onClick={() => onDeleteList(list)}>
            Delete list
          </button>
        </div>
      </div>

      <div className="card-stack">
        {list.cards.map((card) => (
          <article
            key={getCardId(card)}
            className="task-card"
            draggable
            onDragStart={(e) => onDragStart(e, card)}
          >
            <div className="task-card-head">
              <span className={`priority priority-${(card.priority || "LOW").toLowerCase()}`}>
                {card.priority || "LOW"}
              </span>
              <div className="task-card-actions">
                <button className="link-button" onClick={() => onEditCard(card)}>Edit</button>
                <span className="action-separator">,</span>
                <button className="link-button" onClick={() => onDeleteCard(card)}>Delete</button>
                <span className="action-separator">,</span>
                <button className="link-button" onClick={() => onAddComment(card)}>Comment</button>
                <span className="action-separator">,</span>
                <button className="link-button" onClick={() => onQuickStatus(card)}>
                  Next status
                </button>
              </div>
            </div>

            <h4>{card.title}</h4>
            <p>{card.description || "No description added yet."}</p>

            <div className="task-meta">
              <span>Status: {card.status || "TO_DO"}</span>
              <span>Due: {formatDate(card.dueDate)}</span>
            </div>
          </article>
        ))}

        <button className="ghost-panel" onClick={() => onCreateCard(list)}>
          + Add card
        </button>
      </div>
    </section>
  );
}
