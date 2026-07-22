import { Button } from "@edenwright/ui";

import { useAppStore } from "../store";
import "./modal-host.css";

/** Designed modal dialogs (trust dialog, plugin modals — §9.2, §9.3). */
export function ModalHost() {
  const modalRequest = useAppStore((state) => state.modalRequest);

  if (!modalRequest) return null;
  const { options, resolve } = modalRequest;

  const choose = (id: string | null) => {
    useAppStore.setState({ modalRequest: null });
    resolve(id);
  };

  return (
    <div
      className="ew-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) choose(null);
      }}
    >
      <div
        className="ew-modal"
        role="dialog"
        aria-modal="true"
        aria-label={options.title}
      >
        <h2 className="ew-modal__title">{options.title}</h2>
        <p className="ew-modal__body">{options.body}</p>
        <div className="ew-modal__actions">
          {options.actions.map((action) => (
            <Button
              key={action.id}
              variant={action.primary ? "primary" : "ghost"}
              onClick={() => choose(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
