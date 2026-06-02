import { useEffect, useState } from "react";
import { useEditor } from "../state/EditorContext";

/** One entry in gallery.json: either an artwork or a section header. */
export interface GalleryItem {
  url?: string;
  title?: string;
  artist?: string;
  artistUrl?: string;
  year?: string | number;
  image?: string;
  description?: string;
  cycle?: boolean;
  generatePalette?: boolean;
}

/**
 * Curated artwork gallery, ported from the legacy file browser. Fetches
 * `gallery/gallery.json`, lists the artworks, and opens the chosen one by URL
 * (zoom-to-fit, optional palette cycling / palette generation), updating the
 * page URL the way the original did.
 */
export function Gallery() {
  const { galleryOpen, toggleGallery, openImageUrl, zoomFit, toggleColorCycle, paletteFromImage } =
    useEditor();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!galleryOpen || items) return;
    let cancelled = false;
    fetch("gallery/gallery.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: GalleryItem[]) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [galleryOpen, items]);

  if (!galleryOpen) return null;

  const openItem = async (item: GalleryItem) => {
    if (!item.url) return;
    const ok = await openImageUrl(item.url);
    if (!ok) return;
    zoomFit();
    if (item.generatePalette) paletteFromImage();
    if (item.cycle) toggleColorCycle();
    // Reflect the opened artwork in the address bar (matches legacy behaviour).
    if (typeof window !== "undefined" && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.delete("gallery");
      url.searchParams.set("file", item.url);
      url.searchParams.set("zoom", "1");
      if (item.cycle) url.searchParams.set("play", "1");
      else url.searchParams.delete("play");
      if (item.generatePalette) url.searchParams.set("palette", "1");
      else url.searchParams.delete("palette");
      window.history.pushState({}, "", url);
    }
    toggleGallery();
  };

  return (
    <div className="filebrowser gallery active" data-testid="gallery">
      <div className="caption">
        Gallery
        <button
          type="button"
          className="close"
          data-testid="gallery-close"
          data-tip="Close Gallery"
          onClick={toggleGallery}
        >
          x
        </button>
      </div>
      <div className="list" data-testid="gallery-list">
        {error && <div className="gallery-error">No gallery available.</div>}
        {items?.map((item, i) =>
          item.url ? (
            <button
              type="button"
              key={i}
              className="item"
              data-testid={`gallery-item-${i}`}
              onClick={() => void openItem(item)}
            >
              <span
                className="thumb"
                style={item.image ? { backgroundImage: `url('${item.image}')` } : undefined}
              />
              <span className="fileinfo">
                <span className="title">{item.title}</span>
                {item.artistUrl ? (
                  <a className="artist" href={item.artistUrl} target="_blank" rel="noreferrer">
                    {item.artist}
                  </a>
                ) : (
                  <span className="artist">{item.artist}</span>
                )}
                <span className="year">{item.year}</span>
              </span>
            </button>
          ) : (
            <div className="section" key={i}>
              {item.title ? <div className="title">{item.title}</div> : null}
              <div className="description">{item.description}</div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
