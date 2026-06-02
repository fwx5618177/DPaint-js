import { useState, type ReactNode } from "react";
import { useEditor } from "../state/EditorContext";
import { Palette } from "./Palette";
import { ColorPicker } from "./ColorPicker";
import { LayerPanel } from "./LayerPanel";
import { FramesPanel } from "./FramesPanel";
import { BrushPanel } from "./BrushPanel";
import { EffectsPanel } from "./EffectsPanel";
import { ReducePanel } from "./ReducePanel";
import { BitplanesPanel } from "./BitplanesPanel";

// Legacy panel definitions (sidepanel.js): label, expanded height and default
// collapsed state. The legacy layout engine positioned each panel absolutely
// with an explicit `top` and `height`; we reproduce that exactly so the ported
// `_sidepanel.scss` (which assumes absolute `.inner`/`.panelcontent`) applies
// verbatim instead of being fought by a flow layout.
const COLLAPSED_HEIGHT = 21;

interface PanelDef {
  name: string;
  label: string;
  height: number;
  collapsed?: boolean;
  render: () => ReactNode;
}

/** A collapsible side panel, matching the legacy `.panel > .caption/.inner/.sizer`. */
function Panel({
  def,
  top,
  collapsed,
  onToggle,
}: {
  def: PanelDef;
  top: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { toggleSidePanel } = useEditor();
  const height = collapsed ? COLLAPSED_HEIGHT : def.height;
  return (
    <div
      className={`panel ${def.name}${collapsed ? " collapsed" : ""}`}
      data-testid={`panel-${def.name}`}
      style={{ top, height }}
    >
      <div className="caption" onClick={onToggle}>
        <i />
        {def.label}
        <div
          className="close info"
          data-tip="Close side panels"
          onClick={(e) => {
            e.stopPropagation();
            toggleSidePanel();
          }}
        >
          x
        </div>
      </div>
      <div className="inner">{def.render()}</div>
      <div className="sizer" />
    </div>
  );
}

/** Image info panel (legacy `.panel.info`): dl/dt/dd lines. */
function InfoPanelInner() {
  const { doc, version } = useEditor();
  void version;
  const line = (label: string, value: ReactNode) => (
    <dl>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
  return (
    <div data-testid="info-panel">
      {line("Width", `${doc.width}px`)}
      {line("Height", `${doc.height}px`)}
      {line("Layers", doc.layers.length)}
      {line("Colours", doc.colorCount())}
    </div>
  );
}

/** Grid / rulers panel (legacy `.panel.grid` — yes/no toggles). */
function GridPanelInner() {
  const { showGrid, toggleGrid, showRulers, toggleRulers } = useEditor();
  const yesno = (on: boolean, toggle: () => void, label: string, testid: string) => (
    <div className="rangeselect">
      <label>{label}</label>
      <div
        className={`yesno${on ? " selected" : ""}`}
        data-testid={testid}
        aria-pressed={on}
        onClick={toggle}
      >
        <div className="option">Yes</div>
        <div className="option">No</div>
      </div>
    </div>
  );
  return (
    <div data-testid="grid-panel">
      {yesno(showGrid, toggleGrid, "Grid", "grid-toggle")}
      {yesno(showRulers, toggleRulers, "Rulers", "rulers-toggle")}
    </div>
  );
}

/** Right sidepanel, ported from the legacy `.sidepanel > .panelcontainer` DOM. */
export function Sidepanel() {
  // Legacy default open/collapsed state and per-panel heights (sidepanel.js).
  const PANELS: PanelDef[] = [
    { name: "info", label: "Info", height: 110, collapsed: true, render: () => <InfoPanelInner /> },
    { name: "frames", label: "Frames", height: 130, render: () => <FramesPanel /> },
    { name: "layers", label: "Layers", height: 180, render: () => <LayerPanel /> },
    { name: "brush", label: "Brush", height: 210, render: () => <BrushPanel /> },
    { name: "color", label: "Color", height: 142, render: () => <ColorPicker /> },
    { name: "palette", label: "Palette", height: 210, render: () => <Palette /> },
    { name: "grid", label: "Grid", height: 80, collapsed: true, render: () => <GridPanelInner /> },
    { name: "reduce", label: "Reduce Colors", height: 230, collapsed: true, render: () => <ReducePanel /> },
    { name: "effects", label: "Effects", height: 230, collapsed: true, render: () => <EffectsPanel /> },
    { name: "bitplanes", label: "Bit planes", height: 120, collapsed: true, render: () => <BitplanesPanel /> },
  ];

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PANELS.map((p) => [p.name, !!p.collapsed])),
  );

  // Stack the panels with explicit `top`s, exactly like the legacy layout engine.
  let top = 0;
  const positioned = PANELS.map((p) => {
    const isCollapsed = collapsed[p.name];
    const out = { def: p, top, collapsed: isCollapsed };
    top += isCollapsed ? COLLAPSED_HEIGHT : p.height;
    return out;
  });

  return (
    <div className="sidepanel active" data-testid="sidepanel">
      <div className="panelcontainer">
        {positioned.map((p) => (
          <Panel
            key={p.def.name}
            def={p.def}
            top={p.top}
            collapsed={p.collapsed}
            onToggle={() => setCollapsed((c) => ({ ...c, [p.def.name]: !c[p.def.name] }))}
          />
        ))}
        {/* absolute panels carry no intrinsic height; a spacer gives the
            scroll container its content height (legacy relied on the JS engine). */}
        <div className="panelspacer" style={{ height: top }} />
      </div>
      <div className="panelsizer" />
    </div>
  );
}
