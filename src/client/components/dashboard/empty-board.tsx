import { UI_MESSAGES } from "../../constants/dashboard";

export function EmptyBoard() {
  return (
    <div className="empty-board sunken-panel">
      <p>{UI_MESSAGES.EMPTY_BOARD}</p>
      <small>{UI_MESSAGES.EMPTY_BOARD_HELP}</small>
    </div>
  );
}
