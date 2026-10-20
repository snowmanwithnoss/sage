import { useEffect } from "react";

export type SnackbarMessage = {
  id: number;
  text: string;
  kind: "error" | "info";
};

type Props = {
  message: SnackbarMessage | null;
  onDismiss: () => void;
};

const INFO_MS = 4000;
const ERROR_MS = 7000;

/** Material-style snackbar at the bottom; auto-hides. */
export default function Snackbar({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, message.kind === "error" ? ERROR_MS : INFO_MS);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div
      key={message.id}
      className={`snackbar snackbar-${message.kind}`}
      role={message.kind === "error" ? "alert" : "status"}
    >
      <span>{message.text}</span>
      <button type="button" className="snackbar-action" onClick={onDismiss}>
        {message.kind === "error" ? "Dismiss" : "OK"}
      </button>
    </div>
  );
}
