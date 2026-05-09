import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BoardColumn from "../components/BoardColumn";
import Modal from "../components/Modal";
import Shell from "../components/Shell";
import { boardApi, cardApi, commentApi, listApi, notificationApi } from "../services/api";
import { formatDate, getCardId, getListId, groupCardsByList, unwrapItems, unwrapSingleItem } from "../services/helpers";
import { useAuth } from "../state/AuthContext";

const nextStatusMap = {
  TO_DO: "IN_PROGRESS",
  IN_PROGRESS: "IN_REVIEW",
  IN_REVIEW: "DONE",
  DONE: "TO_DO"
};

export default function BoardPage() {
  const { boardId } = useParams();
  const { token, userId } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [comments, setComments] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [message, setMessage] = useState("");
  const [listModalOpen, setListModalOpen] = useState(false);
  const [cardModalState, setCardModalState] = useState({ open: false, listId: "" });
  const [editCardModalState, setEditCardModalState] = useState({ open: false, card: null });
  const [commentModalState, setCommentModalState] = useState({ open: false, card: null });
  const [listForm, setListForm] = useState({ name: "", color: "#0ea5e9" });
  const [cardForm, setCardForm] = useState({ listId: "", title: "", description: "", priority: "LOW", status: "TO_DO", dueDate: "" });
  const [editCardForm, setEditCardForm] = useState({ title: "", description: "", priority: "LOW", status: "TO_DO", dueDate: "" });
  const [commentForm, setCommentForm] = useState({ content: "" });
  const [draggedCard, setDraggedCard] = useState(null);

  async function loadBoardComments(nextCards) {
    if (!nextCards.length) {
      setComments([]);
      return;
    }

    const commentSnapshots = await Promise.all(
      nextCards.map((card) =>
        commentApi.getByCard(getCardId(card), token, userId).catch(() => ({ content: [] }))
      )
    );

    const cardTitlesById = new Map(
      nextCards.map((card) => [String(getCardId(card)), card.title || "Untitled card"])
    );

    const nextComments = commentSnapshots
      .flatMap((item) => unwrapItems(item))
      .map((comment) => ({
        ...comment,
        cardTitle: cardTitlesById.get(String(comment.cardId)) || "Untitled card"
      }))
      .sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 8);

    setComments(nextComments);
  }

  useEffect(() => {
    if (!token || !userId) return;

    async function loadBoard() {
      const errors = [];
      const [boardResult, listResult, cardResult, unreadResult] = await Promise.allSettled([
        boardApi.getById(boardId, token, userId),
        listApi.getByBoard(boardId, token, userId),
        cardApi.getByBoard(boardId, token, userId),
        notificationApi.unreadCount(userId, token, userId)
      ]);

      if (boardResult.status === "fulfilled") {
        setBoard(unwrapSingleItem(boardResult.value));
      } else {
        setBoard(null);
        errors.push(`Board: ${boardResult.reason?.message || "Failed to load"}`);
      }

      if (listResult.status === "fulfilled") {
        setLists(unwrapItems(listResult.value));
      } else {
        setLists([]);
        errors.push(`Lists: ${listResult.reason?.message || "Failed to load"}`);
      }

      let nextCards = [];
      if (cardResult.status === "fulfilled") {
        nextCards = unwrapItems(cardResult.value);
        setCards(nextCards);
      } else {
        setCards([]);
        errors.push(`Cards: ${cardResult.reason?.message || "Failed to load"}`);
      }

      if (unreadResult.status === "fulfilled") {
        setNotificationCount(Number(unreadResult.value) || 0);
      } else {
        setNotificationCount(0);
        errors.push(`Alerts: ${unreadResult.reason?.message || "Failed to load"}`);
      }

      try {
        await loadBoardComments(nextCards);
      } catch (error) {
        setComments([]);
        errors.push(`Comments: ${error.message || "Failed to load"}`);
      }

      setMessage(errors.join(" | "));
    }

    loadBoard();
  }, [boardId, token, userId]);

  useEffect(() => {
    if (!token || !userId || !cards.length) return;

    const refreshComments = setInterval(() => {
      loadBoardComments(cards).catch(() => {
        // Keep the current board story visible if a background refresh fails.
      });
    }, 15000);

    return () => clearInterval(refreshComments);
  }, [cards, token, userId]);

  const groupedLists = useMemo(() => groupCardsByList(lists, cards), [lists, cards]);

  async function createList(event) {
    event.preventDefault();
    try {
      const created = await listApi.create({ boardId: Number(boardId), name: listForm.name, color: listForm.color }, token, userId);
      setLists((current) => [...current, created]);
      setListModalOpen(false);
      setListForm({ name: "", color: "#0ea5e9" });
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createCard(event) {
    event.preventDefault();
    const selectedListId = Number(cardModalState.listId || cardForm.listId);

    if (!selectedListId) {
      setMessage("Select a valid list before creating a card.");
      return;
    }

    if (!cardForm.title.trim()) {
      setMessage("Card title is required.");
      return;
    }

    try {
      const payload = {
        listId: selectedListId,
        boardId: Number(boardId),
        title: cardForm.title.trim(),
        description: cardForm.description.trim(),
        priority: cardForm.priority,
        status: cardForm.status,
        ...(cardForm.dueDate ? { dueDate: `${cardForm.dueDate}T00:00:00` } : {})
      };
      const created = await cardApi.create(payload, token, userId);
      setCards((current) => [...current, created]);
      setCardModalState({ open: false, listId: "" });
      setCardForm({ listId: "", title: "", description: "", priority: "LOW", status: "TO_DO", dueDate: "" });
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function quickStatus(card) {
    try {
      const updated = await cardApi.updateStatus(getCardId(card), nextStatusMap[card.status || "TO_DO"] || "TO_DO", token, userId);
      setCards((current) => current.map((item) => (getCardId(item) === getCardId(card) ? updated : item)));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleDragStart(event, card) {
    setDraggedCard(card);
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  async function handleDrop(event, list) {
    event.preventDefault();
    if (!draggedCard) return;

    const cardId = getCardId(draggedCard);
    const listId = getListId(list);

    if (draggedCard.listId === listId) return;

    try {
      const targetPosition = (groupedLists.find((item) => getListId(item) === listId)?.cards.length || 0) + 1;
      const updated = await cardApi.move(cardId, listId, targetPosition, token, userId);
      setCards((current) => current.map((item) => (getCardId(item) === cardId ? updated : item)));
      setDraggedCard(null);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleEditCard(card) {
    setEditCardModalState({ open: true, card });
    setEditCardForm({
      title: card.title || "",
      description: card.description || "",
      priority: card.priority || "LOW",
      status: card.status || "TO_DO",
      dueDate: card.dueDate ? card.dueDate.split("T")[0] : ""
    });
  }

  function handleAddComment(card) {
    setCommentModalState({ open: true, card });
    setCommentForm({ content: "" });
  }

  async function handleDeleteCard(card) {
    if (!confirm("Are you sure you want to delete this card?")) return;
    try {
      await cardApi.delete(getCardId(card), token, userId);
      setCards((current) => current.filter((item) => getCardId(item) !== getCardId(card)));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteList(list) {
    if (!confirm(`Delete list "${list.name || "Untitled List"}"?`)) return;
    try {
      const listId = getListId(list);
      await listApi.delete(listId, token, userId);
      setLists((current) => current.filter((item) => getListId(item) !== listId));
      setCards((current) => current.filter((item) => item.listId !== listId));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteBoard() {
    if (!confirm(`Delete board "${board?.name || "this board"}"?`)) return;
    try {
      await boardApi.delete(Number(boardId), token, userId);
      navigate("/app");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateCard(event) {
    event.preventDefault();
    const cardId = getCardId(editCardModalState.card);
    try {
      const updated = await cardApi.update(cardId, {
        title: editCardForm.title,
        description: editCardForm.description,
        priority: editCardForm.priority,
        status: editCardForm.status,
        dueDate: editCardForm.dueDate ? `${editCardForm.dueDate}T00:00:00` : null
      }, token, userId);
      setCards((current) => current.map((item) => (getCardId(item) === cardId ? updated : item)));
      setEditCardModalState({ open: false, card: null });
      setEditCardForm({ title: "", description: "", priority: "LOW", status: "TO_DO", dueDate: "" });
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createComment(event) {
    event.preventDefault();
    const selectedCard = commentModalState.card;
    const cardId = getCardId(selectedCard);

    if (!cardId) {
      setMessage("Select a valid card before adding a comment.");
      return;
    }

    if (!commentForm.content.trim()) {
      setMessage("Comment text is required.");
      return;
    }

    try {
      const created = await commentApi.create({
        cardId,
        authorId: Number(userId),
        content: commentForm.content.trim()
      }, token, userId);

      setComments((current) => [
        {
          ...created,
          cardTitle: selectedCard?.title || "Untitled card"
        },
        ...current
      ].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      }).slice(0, 8));

      setCommentModalState({ open: false, card: null });
      setCommentForm({ content: "" });
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <Shell
      title={board?.name || "Board Surface"}
      subtitle={board?.description || "Move lists, track cards, and keep comments visible."}
      notificationCount={notificationCount}
      actions={(
        <div className="inline-actions">
          <button className="primary-button" onClick={() => setListModalOpen(true)}>New list</button>
          <button className="danger-button" onClick={handleDeleteBoard}>Delete board</button>
        </div>
      )}
    >
      {message ? <div className="feedback-banner">{message}</div> : null}

      <section className="board-layout">
        <div className="board-scroll">
          {groupedLists.map((list) => (
            <BoardColumn key={getListId(list)} list={list} onCreateCard={(selectedList) => {
              const listId = getListId(selectedList);
              setCardModalState({ open: true, listId });
              setCardForm((current) => ({ ...current, listId }));
            }} onQuickStatus={quickStatus} onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver} onEditCard={handleEditCard} onDeleteCard={handleDeleteCard} onDeleteList={handleDeleteList} onAddComment={handleAddComment} />
          ))}
        </div>

        <aside className="insight-rail" id="timeline">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Board Story</p>
                <h3>Recent discussion</h3>
              </div>
            </div>
            <div className="timeline-list">
              {comments.length ? comments.map((comment) => (
                <article key={comment.commentId ?? comment.id} className="timeline-row">
                  <div className="timeline-dot" />
                  <div>
                    <h4>{comment.cardTitle || "Card comment"}</h4>
                    <p>{comment.content || comment.message || "Comment activity captured."}</p>
                  </div>
                  <span>{formatDate(comment.updatedAt || comment.createdAt)}</span>
                </article>
              )) : (
                <div className="empty-panel">
                  <h4>No comments loaded</h4>
                  <p>Add comments on cards and they will surface here as board context.</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <Modal open={listModalOpen} title="Create list" onClose={() => setListModalOpen(false)}>
        <form className="form-grid" onSubmit={createList}>
          <label>
            List name
            <input value={listForm.name} onChange={(event) => setListForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            List color
            <input type="color" value={listForm.color} onChange={(event) => setListForm((current) => ({ ...current, color: event.target.value }))} />
          </label>
          <button className="primary-button">Create list</button>
        </form>
      </Modal>

      <Modal open={cardModalState.open} title="Create card" onClose={() => setCardModalState({ open: false, listId: "" })}>
        <form className="form-grid" onSubmit={createCard}>
          <label>
            Title
            <input value={cardForm.title} onChange={(event) => setCardForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <div className="modal-inline-note">
            Adding to list <strong>#{cardModalState.listId || cardForm.listId}</strong>
          </div>
          <label>
            Description
            <textarea value={cardForm.description} onChange={(event) => setCardForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Priority
            <select value={cardForm.priority} onChange={(event) => setCardForm((current) => ({ ...current, priority: event.target.value }))}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label>
            Status
            <select value={cardForm.status} onChange={(event) => setCardForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="TO_DO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={cardForm.dueDate} onChange={(event) => setCardForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </label>
          <button className="primary-button modal-submit">Create card</button>
        </form>
      </Modal>

      <Modal open={editCardModalState.open} title="Edit card" onClose={() => setEditCardModalState({ open: false, card: null })}>
        <form className="form-grid" onSubmit={updateCard}>
          <label>
            Title
            <input value={editCardForm.title} onChange={(event) => setEditCardForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea value={editCardForm.description} onChange={(event) => setEditCardForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Priority
            <select value={editCardForm.priority} onChange={(event) => setEditCardForm((current) => ({ ...current, priority: event.target.value }))}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label>
            Status
            <select value={editCardForm.status} onChange={(event) => setEditCardForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="TO_DO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={editCardForm.dueDate} onChange={(event) => setEditCardForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </label>
          <button className="primary-button">Update card</button>
        </form>
      </Modal>

      <Modal open={commentModalState.open} title="Add comment" onClose={() => setCommentModalState({ open: false, card: null })}>
        <form className="form-grid" onSubmit={createComment}>
          <div className="modal-inline-note">
            Commenting on <strong>{commentModalState.card?.title || "selected card"}</strong>
          </div>
          <label>
            Comment
            <textarea
              value={commentForm.content}
              onChange={(event) => setCommentForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="Write your comment here"
            />
          </label>
          <button className="primary-button">Add comment</button>
        </form>
      </Modal>
    </Shell>
  );
}
