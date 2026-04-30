import { Draggable } from "@hello-pangea/dnd";

function CardItem({ card, index }) {
    return (
        <Draggable draggableId={card.id} index={index}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    {card.text}
                </div>
            )}
        </Draggable>
    );
}

export default CardItem;
