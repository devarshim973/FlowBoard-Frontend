import { Link } from "react-router-dom";
import { getBoardId, getWorkspaceId } from "../services/helpers";

export default function WorkspaceCard({ workspace, boards, onCreateBoard }) {
  const workspaceId = getWorkspaceId(workspace);

  return (
    <section className="workspace-card" id="boards">
      <div className="workspace-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>{workspace.name || "Untitled Workspace"}</h3>
          <span>{workspace.description || "Build boards, coordinate teams, and ship faster."}</span>
        </div>
        <button className="secondary-button" onClick={() => onCreateBoard(workspaceId)}>
          New board
        </button>
      </div>

      <div className="board-grid">
        {boards.length ? (
          boards.map((board) => {
            const boardId = getBoardId(board);
            return (
              <Link key={boardId} to={`/app/board/${boardId}`} className="board-tile" style={{ "--board-accent": board.background || "#0ea5e9" }}>
                <div className="board-glow" />
                <p>{board.visibility || "Team Board"}</p>
                <h4>{board.name}</h4>
                <span>{board.description || "Jump into lists, cards, updates and delivery progress."}</span>
              </Link>
            );
          })
        ) : (
          <div className="empty-panel">
            <h4>No boards yet</h4>
            <p>Create your first board in this workspace and start organizing cards visually.</p>
          </div>
        )}
      </div>
    </section>
  );
}