import { useEditor } from "../state/EditorContext";

/** ADF file browser, ported to the legacy `.filebrowser` sidebar chrome. */
export function FileBrowser() {
  const { adfEntries, openAdfEntry, closeAdf } = useEditor();
  if (!adfEntries) return null;
  return (
    <div className="filebrowser active" data-testid="file-browser">
      <div className="caption">
        Open from disk
        <div className="close" data-testid="file-browser-cancel" onClick={closeAdf}>
          x
        </div>
      </div>
      <div className="list" data-testid="file-browser-list">
        {adfEntries.map((entry) => (
          <div
            key={entry.sector}
            className="listitem file image"
            data-testid={`file-browser-entry-${entry.name}`}
            onClick={() => void openAdfEntry(entry.sector, entry.name)}
          >
            {entry.name}
          </div>
        ))}
      </div>
    </div>
  );
}
