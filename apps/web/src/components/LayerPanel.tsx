import { COMMAND } from "@dpaint/runtime";
import { useEditor } from "../state/EditorContext";

const BLEND_MODES = [
  "normal",
  "lighter",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

const ROW_HEIGHT = 23;

/**
 * Layer list, ported from the legacy `.panel.layers` (layerPanel.js):
 * a `.paneltools` header (opacity / blend / add / delete) above a
 * `.panelcontent` of absolutely-stacked `.layer.info` rows with an eye toggle
 * and a compact action cluster.
 */
export function LayerPanel() {
  const { doc, commit, checkpoint, bus } = useEditor();
  const active = doc.layers[doc.activeLayerIndex];
  const activeHasMask = !!active?.mask;
  const max = doc.layers.length - 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = active as any;

  return (
    <div className="layer-panel" data-testid="layer-panel">
      <div className="paneltools multirow">
        <div className="rangeselect" data-tip="Set transparency of active layer">
          <div className="label">Opacity</div>
          <input
            type="range"
            min={0}
            max={100}
            value={a?.opacity ?? 100}
            onChange={(e) => {
              if (a) a.opacity = Number(e.target.value);
              commit();
            }}
          />
        </div>
        <div className="blendselect">
          <div className="label">Blend</div>
          <select
            value={a?.blendMode ?? "normal"}
            onChange={(e) => {
              if (a) a.blendMode = e.target.value;
              commit();
            }}
          >
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div
          className="button delete"
          role="button"
          data-tip="Delete active layer"
          data-testid="layer-delete-active"
          onClick={() => {
            if (doc.layers.length > 1) {
              doc.removeLayer(doc.activeLayerIndex);
              checkpoint();
            }
          }}
        />
        <div
          className="button add"
          role="button"
          data-tip="Add new layer"
          data-testid="layer-add"
          onClick={() => {
            doc.addLayer();
            checkpoint();
          }}
        />
      </div>

      <div className="panelcontent">
        {doc.layers
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .map(({ layer, index }) => (
            <div
              key={index}
              className={
                "layer info handle" +
                (index === doc.activeLayerIndex ? " active" : "") +
                (layer.visible ? "" : " hidden")
              }
              data-testid={`layer-row-${index}`}
              style={{ top: (max - index) * ROW_HEIGHT }}
              onClick={() => {
                doc.activeLayerIndex = index;
                commit();
              }}
            >
              <span className="layer-name" data-testid={`layer-select-${index}`}>
                {layer.name}
              </span>
              <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                <div
                  className="button icon"
                  role="button"
                  aria-label="Move layer up"
                  data-tip="Move up"
                  data-testid={`layer-up-${index}`}
                  data-disabled={index >= max}
                  onClick={() => {
                    if (index < max) {
                      doc.moveLayer(index, "up");
                      checkpoint();
                    }
                  }}
                >
                  ▲
                </div>
                <div
                  className="button icon"
                  role="button"
                  aria-label="Move layer down"
                  data-tip="Move down"
                  data-testid={`layer-down-${index}`}
                  data-disabled={index <= 0}
                  onClick={() => {
                    if (index > 0) {
                      doc.moveLayer(index, "down");
                      checkpoint();
                    }
                  }}
                >
                  ▼
                </div>
                <div
                  className="button icon"
                  role="button"
                  aria-label="Duplicate layer"
                  data-tip="Duplicate"
                  data-testid={`layer-duplicate-${index}`}
                  onClick={() => {
                    doc.duplicateLayer(index);
                    checkpoint();
                  }}
                >
                  ⧉
                </div>
                <div
                  className="button icon"
                  role="button"
                  aria-label="Merge layer down"
                  data-tip="Merge down"
                  data-testid={`layer-merge-${index}`}
                  data-disabled={index <= 0}
                  onClick={() => {
                    if (index > 0) {
                      doc.mergeDown(index);
                      checkpoint();
                    }
                  }}
                >
                  ⤓
                </div>
                <div
                  className="button icon"
                  role="button"
                  aria-label="Delete layer"
                  data-tip="Delete"
                  data-testid={`layer-remove-${index}`}
                  data-disabled={doc.layers.length <= 1}
                  onClick={() => {
                    if (doc.layers.length > 1) {
                      doc.removeLayer(index);
                      checkpoint();
                    }
                  }}
                >
                  ✕
                </div>
              </div>
              <div
                className="eye"
                role="button"
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
                data-tip="Toggle layer visibility"
                data-testid={`layer-visibility-${index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  layer.visible = !layer.visible;
                  commit();
                }}
              />
            </div>
          ))}
      </div>

      <div className="panelfoot layer-foot">
        <div
          className="button full"
          role="button"
          data-testid="layer-flatten"
          data-disabled={doc.layers.length <= 1}
          onClick={() => {
            if (doc.layers.length > 1) {
              doc.flatten();
              checkpoint();
            }
          }}
        >
          Flatten
        </div>
        {!activeHasMask ? (
          <div
            className="button full"
            role="button"
            data-testid="layer-mask-add"
            data-tip="Add a layer mask"
            onClick={() => bus.trigger(COMMAND.LAYERMASK)}
          >
            +Mask
          </div>
        ) : (
          <>
            <div
              className="button full"
              role="button"
              data-testid="layer-mask-toggle"
              data-tip="Enable/disable mask"
              onClick={() => bus.trigger(COMMAND.TOGGLEMASK)}
            >
              Mask⊘
            </div>
            <div
              className="button full"
              role="button"
              data-testid="layer-mask-apply"
              data-tip="Apply mask to layer"
              onClick={() => bus.trigger(COMMAND.APPLYLAYERMASK)}
            >
              Apply
            </div>
            <div
              className="button full"
              role="button"
              data-testid="layer-mask-delete"
              data-tip="Delete mask"
              onClick={() => bus.trigger(COMMAND.DELETELAYERMASK)}
            >
              −Mask
            </div>
          </>
        )}
      </div>
    </div>
  );
}
