import { EditorProvider } from "./state/EditorContext";
import { MenuBar } from "./components/MenuBar";
import { Toolbar } from "./components/Toolbar";
import { Palette } from "./components/Palette";
import { CanvasView } from "./components/CanvasView";
import { LayerPanel } from "./components/LayerPanel";
import { FramesPanel } from "./components/FramesPanel";
import { StatusBar } from "./components/StatusBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useHostBridge } from "./hooks/useHostBridge";

function Workspace() {
  useKeyboardShortcuts();
  useHostBridge();
  return (
    <div className="app" data-testid="app">
      <MenuBar />
      <div className="workspace">
        <Toolbar />
        <main className="stage">
          <CanvasView />
        </main>
        <aside className="sidepanel">
          <Palette />
          <LayerPanel />
          <FramesPanel />
        </aside>
      </div>
      <StatusBar />
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
