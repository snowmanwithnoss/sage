import { useEffect, useRef, useState } from "react";
import { authClient } from "./auth";

type Mode = "sign-in" | "sign-up";

type Props = {
  open: boolean;
  /** Optional line shown above the form, e.g. why sign-in is needed. */
  reason?: string;
  onClose: () => void;
};

// Better Auth's default password length rules.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

/** Sign in / sign up modal. Native <dialog> gives focus trapping and Escape-to-close. */
export default function AuthDialog({ open, reason, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      setPassword("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? (mode === "sign-up" ? "Sign up failed" : "Sign in failed"));
      return;
    }
    setPassword("");
    onClose();
  };

  const switchMode = () => {
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
    setError(null);
  };

  const title = mode === "sign-in" ? "Sign in" : "Create account";

  return (
    <dialog
      ref={ref}
      className="auth-dialog"
      aria-labelledby="auth-title"
      // Escape fires `cancel`; let the parent own the open state.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form className="panel panel-dialog" onSubmit={handleSubmit}>
        <h2 id="auth-title">{title}</h2>
        {reason && <p className="dialog-reason">{reason}</p>}
        {mode === "sign-up" && (
          <label>
            Name
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={mode === "sign-up" ? PASSWORD_MIN : undefined}
            maxLength={PASSWORD_MAX}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="link-btn" onClick={switchMode} disabled={submitting}>
            {mode === "sign-in" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
          <button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : title}
          </button>
        </div>
      </form>
    </dialog>
  );
}
