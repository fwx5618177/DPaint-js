import { useEditor } from "../state/EditorContext";

/** Layer list with visibility toggles and add/remove. */
export function LayerPanel() {
  const { doc, commit } = useEditor();
  return (
    <div className="layer-panel" data-testid="layer-panel">
      <div className="layer-panel-header">Layers</div>
      <ul className="layer-list">
        {doc.layers
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .map(({ layer, index }) => (
            <li
              key={index}
              className={"layer-row" + (index === doc.activeLayerIndex ? " active" : "")}
              data-testid={`layer-row-${index}`}
            >
              <button
                type="button"
                className="layer-visibility"
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
                data-testid={`layer-visibility-${index}`}
                onClick={() => {
                  layer.visible = !layer.visible;
                  commit();
                }}
              >
                {layer.visible ? "👁" : "—"}
              </button>
              <button
                type="button"
                className="layer-name"
                data-testid={`layer-select-${index}`}
                onClick={() => {
                  doc.activeLayerIndex = index;
                  commit();
                }}
              >
                {layer.name}
              </button>
              <button
                type="button"
                className="layer-remove"
                aria-label="Delete layer"
                data-testid={`layer-remove-${index}`}
                disabled={doc.layers.length <= 1}
                onClick={() => {
                  doc.removeLayer(index);
                  commit();
                }}
              >
                ✕
              </button>
            </li>
          ))}
      </ul>
      <button
        type="button"
        className="layer-add"
        data-testid="layer-add"
        onClick={() => {
          doc.addLayer();
          commit();
        }}
      >
        + Add layer
      </button>
    </div>
  );
}
