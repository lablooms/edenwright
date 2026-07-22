import { useAppStore } from "../store";
import "./toasts.css";

/** Bottom-right toast stack — warm, direct, auto-dismissing (§3.4). */
export function Toasts() {
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;
  return (
    <div className="ew-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="ew-toast"
          data-kind={toast.kind}
          onClick={() => dismissToast(toast.id)}
          title="Dismiss"
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
