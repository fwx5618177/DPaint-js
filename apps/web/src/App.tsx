import { EditorProvider, useEditor } from "./state/EditorContext";
import { Menu } from "./components/Menu";
import { Toolbar } from "./components/Toolbar";
import { CanvasView } from "./components/CanvasView";
import { Sidepanel } from "./components/Sidepanel";
import { StatusBar } from "./components/StatusBar";
import { FileBrowser } from "./components/FileBrowser";
import { Gallery } from "./components/Gallery";
import { AboutDialog } from "./components/AboutDialog";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { ContextMenu } from "./components/ContextMenu";
import { UaePreview } from "./components/UaePreview";
import { DitherEditor } from "./components/DitherEditor";
import { Tooltip } from "./components/Tooltip";
import { useUrlParams } from "./hooks/useUrlParams";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useHostBridge } from "./hooks/useHostBridge";
import type { CSSProperties } from "react";

function Workspace() {
  useKeyboardShortcuts();
  useHostBridge();
  useUrlParams();
  const { sidePanelVisible, presentationMode, togglePresentation, splitScreen, settings } = useEditor();
  const style = { "--sidepanel-width": `${settings.sidepanelWidth}px` } as CSSProperties;
  return (
    // `.container` is the legacy root that the ported SCSS positions everything
    // against (menu top, toolbar left, editor centre, sidepanel right, statusbar
    // bottom). #root acts as the old <body>.
    <div
      className={
        "container" +
        (sidePanelVisible && !presentationMode ? " withsidepanel" : "") +
        (presentationMode ? " presentation" : "") +
        (splitScreen ? " split" : "")
      }
      data-testid="app"
      data-presentation={presentationMode ? "true" : "false"}
      style={style}
    >
      {presentationMode && (
        <button
          type="button"
          className="presentation-exit"
          data-testid="presentation-exit"
          title="Exit presentation"
          onClick={togglePresentation}
        >
          ✕
        </button>
      )}
      {!presentationMode && <Menu />}
      {!presentationMode && <Toolbar />}
      <CanvasView />
      {sidePanelVisible && !presentationMode && <Sidepanel />}
      {!presentationMode && <StatusBar />}
      <FileBrowser />
      <Gallery />
      <AboutDialog />
      <PreferencesDialog />
      <ContextMenu />
      <UaePreview />
      <DitherEditor />
      <Tooltip />
    </div>
  );
}

export function App({ autoRestore = false }: { autoRestore?: boolean } = {}) {
  return (
    <EditorProvider width={64} height={48} autoRestore={autoRestore}>
      <Workspace />
    </EditorProvider>
  );
}

export default App;
