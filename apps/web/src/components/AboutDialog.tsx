import { useEditor } from "../state/EditorContext";

/** "About" modal, ported to the legacy `.blanket` + `.modalwindow` chrome. */
export function AboutDialog() {
  const { aboutOpen, closeAbout } = useEditor();
  if (!aboutOpen) return null;
  return (
    <div
      className="modalwindow active about"
      data-testid="about-dialog"
      style={{ width: 750, height: 470, top: "calc(50vh - 235px)", marginLeft: -375 }}
    >
      <div className="caption">
        <div className="handle">About</div>
        <div className="button" data-testid="about-close" onClick={closeAbout}>
          x
        </div>
      </div>
      <div className="inner full">
        <div className="about">
          <img src="/_img/dpaint-about.png" alt="DPaint.js" />
          <div className="text version">version 0.3.0</div>
          <div className="text info">
            Webbased image editor modeled after the legendary
            <br />
            Deluxe Paint with a focus on retro Amiga file formats.
          </div>
          <div className="text copyright link" onClick={() => window.open("https://www.stef.be/")}>
            &copy; 2023-2026 - Steffest
          </div>
          <div
            className="text github link"
            onClick={() => window.open("https://github.com/steffest/dpaint-js")}
          >
            Open Source - Plain JavaScript - Fork me on GitHub
          </div>
          <div className="text nobullshit">Free software: No cookies - No tracking - No ads - No accounts</div>
          <div className="text contrib">
            <i>With contributions from</i>
            Michael Smith, Nicolas Ramz and Rob Coenen
          </div>
        </div>
      </div>
    </div>
  );
}
