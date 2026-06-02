import { useEditor } from "../state/EditorContext";

/** Preferences, ported to the legacy `.contentpanel` chrome (contentpanel.js). */
export function PreferencesDialog() {
  const { preferencesOpen, closePreferences, settings, updateSetting } = useEditor();
  if (!preferencesOpen) return null;
  return (
    <div className="contentpanel active" data-testid="preferences-dialog">
      <div className="panelcontainer">
        <div className="caption noicon">
          Preferences
          <div className="close" data-testid="preferences-close" onClick={closePreferences}>
            x
          </div>
        </div>
        <section>
          <h4>Touch</h4>
          <span className="checkbox">
            <label>
              <input
                type="checkbox"
                data-testid="pref-touchRotate"
                checked={settings.touchRotate}
                onChange={(e) => updateSetting("touchRotate", e.target.checked)}
              />
              <span>Rotate on Pinch/zoom</span>
            </label>
          </span>
          <span className="checkbox">
            <label>
              <input
                type="checkbox"
                data-testid="pref-penOnlyAllowColorPicker"
                checked={settings.penOnlyAllowColorPicker}
                onChange={(e) => updateSetting("penOnlyAllowColorPicker", e.target.checked)}
              />
              <span>Allow Color Picker in Pen-Only mode</span>
            </label>
          </span>
          <h4>Advanced</h4>
          <span className="checkbox">
            <label>
              <input
                type="checkbox"
                data-testid="pref-useMultiPalettes"
                checked={settings.useMultiPalettes}
                onChange={(e) => updateSetting("useMultiPalettes", e.target.checked)}
              />
              <span>Use Multi Palettes</span>
            </label>
          </span>
          <div className="subpanel flex">
            <div className="label">Side panel width</div>
            <input
              type="number"
              min={120}
              max={400}
              data-testid="pref-sidepanelWidth"
              value={settings.sidepanelWidth}
              onChange={(e) => updateSetting("sidepanelWidth", Number(e.target.value))}
            />
          </div>
        </section>
      </div>
      <div className="panelsizer" />
    </div>
  );
}
