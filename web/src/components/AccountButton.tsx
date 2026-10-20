import { useEffect, useRef, useState } from "react";
import { LogoutIcon, PersonIcon } from "./icons";

type Props = {
  pending: boolean;
  user: { name: string; email: string } | null;
  onSignIn: () => void;
  onSignOut: () => void;
};

/** Avatar circle in the search pill; tap for a small account menu (or sign in). */
export default function AccountButton({ pending, user, onSignIn, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!user) setOpen(false);
  }, [user]);

  if (pending) return <span className="avatar avatar-pending" aria-hidden />;

  if (!user) {
    return (
      <button type="button" className="avatar avatar-signed-out" aria-label="Sign in" title="Sign in" onClick={onSignIn}>
        <PersonIcon size={22} />
      </button>
    );
  }

  const initial = (user.name.trim() || user.email).charAt(0).toUpperCase();
  return (
    <div className="account" ref={wrapRef}>
      <button
        type="button"
        className="avatar"
        aria-label={`Account: ${user.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <span className="avatar avatar-lg" aria-hidden>
              {initial}
            </span>
            <span className="account-text">
              {user.name && <span className="account-name">{user.name}</span>}
              <span className="account-email">{user.email}</span>
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogoutIcon size={20} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
