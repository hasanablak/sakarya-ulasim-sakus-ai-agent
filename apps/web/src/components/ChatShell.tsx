import type { CSSProperties, ReactNode, RefObject } from "react";
import type { WebchatPublic } from "@sakus/shared";

export function chatThemeStyle(cfg: Pick<WebchatPublic, "tema">): CSSProperties {
  const t = cfg.tema;
  return {
    "--chat-header-bg": t.header_bg,
    "--chat-header-fg": t.header_fg,
    "--chat-fab-bg": t.fab_bg,
    "--chat-fab-fg": t.fab_fg,
    "--chat-panel-bg": t.panel_bg,
    "--chat-user-bg": t.user_bg,
    "--chat-user-fg": t.user_fg,
    "--chat-bot-bg": t.bot_bg,
    "--chat-bot-fg": t.bot_fg,
    "--chat-border": t.border,
    "--chat-width": `${t.panel_width}px`,
  } as CSSProperties;
}

export function ChatShell({
  cfg,
  open,
  onToggle,
  preview,
  embed,
  logRef,
  dockRef,
  children,
  composer,
}: {
  cfg: WebchatPublic;
  open: boolean;
  onToggle: () => void;
  preview?: boolean;
  embed?: boolean;
  logRef?: RefObject<HTMLDivElement | null>;
  dockRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  composer?: ReactNode;
}) {
  const cls = [
    "chat-dock",
    cfg.konum === "sol_alt" ? "is-sol" : "",
    preview ? "is-preview" : "",
    embed ? "is-embed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} style={chatThemeStyle(cfg)} ref={dockRef}>
      {open && (
        <div className="chat-panel">
          <header>
            <strong>{cfg.baslik}</strong>
            <button type="button" className="icon" onClick={onToggle} aria-label="Kapat">
              ×
            </button>
          </header>
          <div className="chat-log" ref={logRef}>
            {children}
          </div>
          {composer}
        </div>
      )}
      <button type="button" className="chat-fab" onClick={onToggle}>
        {open ? cfg.fab_kapat : cfg.fab_ac}
      </button>
    </div>
  );
}
