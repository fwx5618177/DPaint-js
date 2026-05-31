import { EditorProvider } from "./state/EditorContext";
import { MenuBar } from "./components/MenuBar";
import { Toolbar } from "./components/Toolbar";
import { Palette } from "./components/Palette";
import { CanvasView } from "./components/CanvasView";
import { LayerPanel } from "./components/LayerPanel";
import { StatusBar } from "./components/StatusBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function Workspace() {
  useKeyboardShortcuts();
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
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}

export function App() {
  return (
    <EditorProvider width={64} height={48}>
      <Workspace />
    </EditorProvider>
  );
}

export default App;
