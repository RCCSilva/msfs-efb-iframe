# EFB Iframe App for MSFS 2024

A minimal **Microsoft Flight Simulator 2024 EFB app that shows any web page in an
`<iframe>`**. Point it at a local server (your own map, dashboard, checklist...) or any
URL, load the project with Developer Mode, and it appears as an app inside the EFB.

* Plain JavaScript, **no build step, no npm**.
* One config block (`IFRAME_URL`, app name...) at the top of one file.
* The structure mirrors Asobo's *EFB Template Sample* from the SDK.

```
.
├── EfbIframeAppProject.xml                      ← the file you open in Developer Mode
├── PackageDefinitions/
│   ├── mycompany-efb-iframeapp.xml              ← package definition
│   └── mycompany-efb-iframeapp/ContentInfo/thumbnail.jpg
└── PackageSources/
    └── IframeApp/
        ├── IframeApp.js                         ← the app (edit the CONFIG block)
        └── Assets/app-icon.svg
```

> **Status.** The project structure and the app logic are the ones of a private project
> that was confirmed working in MSFS 2024 (app listed in the EFB, page rendered in the
> frame). This generic, renamed version has not been run in the sim by its author yet.
> If something breaks, please open an issue with the Developer Mode console output.

---

## 1. Install the MSFS 2024 SDK

You need the SDK only to *load and build the project* (Developer Mode ships with the sim).

1. Install **.NET Desktop Runtime 8.0.2 or newer** (the SDK installer requires it).
2. In MSFS 2024: **Options → General → Developers → Developer Mode: ON**.
   A toolbar appears at the top of the screen (you may need to be in a flight).
3. In that toolbar: **Help → Download SDK**. This downloads a `.zip` with an `.msi`.
   Extract it and run the `.msi`. Default install folder: `C:\MSFS 2024 SDK\`.

If the Help menu does not work for you, the same installers are published in a public
manifest — `https://sdk.flightsimulator.com/msfs2024/files/sdk.json`. Take the
`SDK Installer (Core)` entry of the newest `game_versions` item and append its
`value` to `https://sdk.flightsimulator.com/msfs2024/files/`.

You do **not** need the *Samples* package (3+ GB) for this project.

Official docs: <https://docs.flightsimulator.com/msfs2024/> (SDK Overview, EFB Template Sample).

## 2. Configure the app

Edit the `CONFIG` block at the top of `PackageSources/IframeApp/IframeApp.js`:

| Placeholder | Default | What to put |
|---|---|---|
| `IFRAME_URL` | `http://127.0.0.1:8080/` | The page to embed. For a local server use `http://127.0.0.1:<port>/` |
| `APP_NAME` | `Iframe App` | Name shown in the EFB app list (spaces allowed) |
| `INTERNAL_NAME` | `IframeApp` | Internal id, **no spaces**. Must match file/folder names — see §5 |
| `VERSION` | `1.0.0` | Free text |
| `HEALTH_CHECK_URL` | `''` (off) | Optional URL returning HTTP 200 + `Access-Control-Allow-Origin: *`; enables the "server unreachable" notice and auto-reload |
| `SHOW_STATUS_BAR` | `true` | Thin bottom bar with the frame state and URL |

And in `PackageDefinitions/mycompany-efb-iframeapp.xml`:

| Placeholder | What to put |
|---|---|
| `<Title>` | Package title |
| `<Creator>` | Your name or alias (use the same one in all your packages) |
| `mycompany` (file name + 2 paths) | Your company/alias: lowercase `a-z0-9`, no spaces, ≤ 25 chars |

`<Manufacturer/>` stays empty — it is only required for aircraft packages.

## 3. Load it with Developer Mode

1. Start MSFS 2024 with **Developer Mode ON**.
2. Toolbar: **File → Open project…** and pick `EfbIframeAppProject.xml`.
3. The **Project Editor** opens (otherwise: **Tools → Project Editor**).
4. Click **Build All In Project** — *before* starting the flight.
5. Start a flight in an aircraft that has an EFB, open it and select your app.

Developer Mode also asks for a *Default Company Name* / *Default Creator Name* in the
Project Editor. They are per-user settings of the sim (not stored in the XML) and must not
be empty; the company name allows only `a-z` and `0-9`.

**Do not also copy the package to the `Community` / `Community2024` folder** while you are
loading it as a project, or the app may load twice. Build output goes next to the project
file (`Packages/`, `PackagesMetadata/`, `_PackageInt/`; git-ignored).

### Serve something to embed

Any web server works. The quickest, for testing:

```bash
# inside a folder that has an index.html
python -m http.server 8080 --bind 127.0.0.1
```

Edit your page and reopen the app in the EFB — the page is loaded fresh; **no Build and no
simulator restart needed** for page changes. Only changes to `IframeApp.js` or the XML need a
new *Build All In Project*.

## 4. Things that will bite you

* **Names must match** (see §5). If they don't, the sim does not error — the app just does not show up.
* **Don't call it `TemplateApp`**: other EFB add-ons use that name and they collide.
* **Use `127.0.0.1`, not `localhost`**, and plain `http://` for local servers.
* **Pages that forbid framing will stay blank**: `X-Frame-Options: DENY/SAMEORIGIN` or CSP
  `frame-ancestors` make a site refuse to be embedded. Your own server is not affected.
* **Embedded browser is old** (Coherent GT): keep CSS/JS conservative; avoid `calc()`,
  CSS variables, `grid`/`gap`, optional chaining. Leaflet needs
  `window.L_DISABLE_3D = true` *before* it loads.
* **Text glyphs may not render** (e.g. `−`, `◎`): use inline SVG for icons.
* **Don't rewrite the view every frame** (e.g. `map.setView()` at 4 Hz); it shows up as flicker.
* Remote `https://` sites are untested here.

## 5. Renaming the app

Pick your new internal name, e.g. `MyMapApp`. These must all be identical:

| # | Where | Example |
|---|---|---|
| 1 | `INTERNAL_NAME` in the JS | `'MyMapApp'` |
| 2 | JS file name | `PackageSources/MyMapApp/MyMapApp.js` |
| 3 | Folder name | `PackageSources/MyMapApp/` |
| 4 | `<AssetDir>` in the package XML | `PackageSources\MyMapApp\` |
| 5 | `<OutputDir>` in the package XML | `.\html_ui\efb_ui\efb_apps\MyMapApp\` |

Then (these are only consistency, not hard requirements):

* rename the `AssetGroup Name="efb_apps_iframeapp"` if you like;
* if you rename the package (`mycompany-efb-iframeapp`): the XML file name, the two
  `ContentInfo` paths and the `<Package>` line in `EfbIframeAppProject.xml` must follow;
* if you rename the project: the file name and `Name="…"` in `EfbIframeAppProject.xml`.

## License

MIT — see [LICENSE](LICENSE). Not affiliated with Microsoft or Asobo Studio.
"Microsoft Flight Simulator" is a trademark of Microsoft.
