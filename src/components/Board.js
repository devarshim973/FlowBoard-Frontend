import { DragDropContext } from "@hello-pangea/dnd";
import List from "./List";
import { useState } from "react";

function Board() {
    const [lists, setLists] = useState([
        { id: "1", title: "To Do", cards: [{ id: "c1", text: "Task 1" }] },
        { id: "2", title: "In Progress", cards: [] },
        { id: "3", title: "Done", cards: [] }
    ]);

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const sourceList = lists.find(l => l.id === result.source.droppableId);
        const destList = lists.find(l => l.id === result.destination.droppableId);

        const movedCard = sourceList.cards[result.source.index];

        sourceList.cards.splice(result.source.index, 1);
        destList.cards.splice(result.destination.index, 0, movedCard);

        setLists([...lists]);
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div style={{display: "flex", gap: "10px"}}>
                {lists.map(list => (
                    <List key={list.id} list={list} />
                ))}
            </div>
        </DragDropContext>
    );
}

export default Board;
