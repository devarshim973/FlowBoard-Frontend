import { Droppable } from "@hello-pangea/dnd";
import CardItem from "./CardItem";

function List({ list }) {
    return (
        <Droppable droppableId={list.id}>
            {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                    <h2>{list.title}</h2>

                    {list.cards.map((card, index) => (
                        <CardItem key={card.id} card={card} index={index} />
                    ))}

                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    );
}

export default List;
