# DPaint.js
Webbased image editor modeled after the legendary [Deluxe Paint](https://en.wikipedia.org/wiki/Deluxe_Paint) with a focus on retro Amiga file formats.
Next to modern image formats, DPaint.js can read and write Amiga icon files and IFF ILBM images.

![DPaint.js Logo](./_img/dpaint-logo.png?raw=true)

Online version available at https://dpaint.app

![DPaint.js UI](./_img/ui.png?raw=true)

## Main Features
 - Fully Featured image editor with a.o.
   - Layers
   - Selections
   - Masking
   - Transformation tools
   - Effects and filters
   - Multiple undo/redo
   - Copy/Paste from any other image program or image source
   - Customizable dither tools
   - Color Cycling
   - Frame based animation
 - Heavy focus on colour reduction with fine-grained dithering options
 - Amiga focus
   - Read/write/convert Amiga icon files (all formats)
   - Read and write IFF ILBM images (all formats including HAM6, HAM8, SHAM and 24-bit)
   - Read and write IFF ANIM files (Amiga animation format)
   - Read and write directly from Amiga Disk Files (ADF)
   - Embedded Amiga Emulator to preview your work in the real Deluxe Paint.
   - Limit the palette to 12 bit for Amiga OCS/ECS mode, or 9 bit for Atari ST mode.
 - Deluxe Paint Legacy
   - Supports PBM files as used by the PC version of Deluxe Paint (Thanks to [Michael Smith](https://github.com/michaelshmitty))
   - Supports Deluxe Paint Atari ST compression modes (Thanks to [Nicolas Ramz](https://github.com/warpdesign))

## Free and Open
It runs in your browser, works on any system and works fine on touch-screen devices like iPads.  
It is written in 100% plain JavaScript and has no dependencies.  
It's 100% free, no ads, no tracking, no accounts, no nothing.  
All processing is done in your browser, no data is sent to any server.  

The only part that is not included in this repository is the Amiga Emulator Files.
(The emulator is based on the [Scripted Amiga Emulator](https://github.com/naTmeg/ScriptedAmigaEmulator))

## Architecture (TypeScript + React monorepo)
The project is being migrated to a TypeScript + React **pnpm monorepo**. The
framework-agnostic logic lives in reusable `packages/*`, and the editor UI lives
in `apps/web` as a React + Vite application.

```
.
├── packages/
│   ├── core/         @dpaint/core — commands/events enums, typed EventBus, user settings
│   ├── util/         @dpaint/util — colour maths, CRC32, BinaryStream, text helpers
│   └── fileformats/  @dpaint/fileformats — ByteRun1/PackBits codec + format detection
├── apps/
│   └── web/          @dpaint/web — React + TypeScript paint application (Vite)
└── legacy/           the original plain-JS app, quarantined as migration reference
    ├── _script/      legacy ES6 source (being ported package by package)
    ├── _style/ _img/ _font/ _data/   legacy assets
    ├── tests/        the original Playwright end-to-end suite
    └── index.html    legacy entry point
```

The repository root now holds only workspace configuration plus the three
top-level areas (`packages/`, `apps/`, `legacy/`).

### Prerequisites
- Node.js ≥ 20
- [pnpm](https://pnpm.io/) 9 (`corepack enable` will provide it)

### Common commands (run from the repo root)
| Command | Description |
| --- | --- |
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start the React app (`apps/web`) in dev mode |
| `pnpm test` | Run the whole Vitest suite across every package |
| `pnpm typecheck` | Type-check every package and the app |
| `pnpm build` | Type-check the packages and build the web app to `apps/web/dist` |
| `pnpm coverage` | Run the suite with V8 coverage |

Tests are written with [Vitest](https://vitest.dev/) (plus
[Testing Library](https://testing-library.com/) for the React components).
The migrated code currently ships **151 passing tests at ~87% coverage**.

### Implemented in the React app
- Multi-layer raster document with alpha compositing
- Tools: pencil, line, rectangle (outline/filled), ellipse (outline/filled),
  flood fill, and colour picker
- 16-colour palette with foreground/background swatches and swap
- Layer panel (add / remove / reorder-by-activation / visibility toggle)
- Undo / redo (bounded history of document snapshots) with `Ctrl`/`Cmd`+`Z`
- Project save / load to a JSON `.dpaint.json` format
- Keyboard shortcuts for tools, zoom, colour swap, and undo/redo

### Legacy app
The original plain-JS app now lives under `legacy/` (`dpaint-legacy` workspace
package). Run it with:

| Command | Description |
| --- | --- |
| `pnpm legacy:start` | Serve the legacy app at http://localhost:8080 |
| `pnpm legacy:build` | Build the legacy app to `legacy/dist` |
| `pnpm legacy:test` | Run the original Playwright end-to-end suite |

It is kept as a reference while the TypeScript port proceeds module by module.

## Documentation
Documentation can be found at https://dpaint.app/docs/

## Running offline
Dpaint.js is a web application, not an app that you install on your computer.
That being said: DPaint.js has no online dependencies and runs fine offline if you want.
One caveat: you have to serve the index.html file from a webserver, not just open it in your browser.  
A quick way to do this is - for example - using the [Spark](https://github.com/rif/spark/releases) app.  
[Download the binary](https://github.com/rif/spark/releases) for your platform, drop the Spark executable in the folder where you downloaded the Dpaint.js source files and run it.
If you then point your browser to http://localhost:8080/ it should work.    
But any webserver will do, you can also use the one built into Python for example.  ( `python -m http.server` )
Or - if you have the node.js runtime installed - you can use packages like:  
 - serve: `npx serve` in the DPaint.js folder 
 - http-server: `npx http-server` in the DPaint.js folder

If you are using Chrome, you can also "install" dpaint.js as app.  
![image](https://github.com/user-attachments/assets/fa4a1e8b-4e45-4fe1-9d77-8b1e3364e867)  
It will then show up your Chrome apps and work offline.  


## Contributing
Current version is still alpha.  
I'm sure there are bugs and missing features.  
Bug reports and pull requests are welcome.

### Planned Features
Planned for a future release if there's a need for it.
  - Support for non-square pixel modes such as HiRes and Interlaced
  - PSD import and export
  - SpriteSheet support
  - Commodore 64 graphics modes
  - Animated Brushes
      
## Browser Quirks
Please note that the **Brave** browser is using "[farbling](https://brave.com/privacy-updates/4-fingerprinting-defenses-2.0/#2-fingerprinting-protections-20-farbling-for-great-good)" that introduces random image noise in certain conditions.
They claim this is to protect your privacy.
Although I totally understand the sentiment, In my opinion a browser should not actively alter the content of a webpage or intentionally break functionality.  
But hey, who am I to speak, it's a free world.
Just be aware that if you are using Brave, you will run into issues, so please "lower your shields" for this app in Brave or use another browser.

## Color Cycling
Dpaint.js supports Color-Cycling - a long lost art of "animating" a static image by only rotating some colors in the palette.
See an example here:  


https://github.com/user-attachments/assets/427bbecc-d38f-4120-ba0d-83c7f1249722



[Open the layered source file of the above image directly in Dpaint.js](https://www.dpaint.app/?file=gallery/2026/the-vision-layered.json&play=true)



