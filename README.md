# Depot Issue Control

A MERN web version of the **Offline WMS — Supply Depot / 10-Minute Issue Control** workbook.
It covers the full flow from unit demand to pick list, staging bay, loading, verification and dispatch,
on a live control board that works on phones and desktops.

> Prototype. Validate against authorised accounting and stock records before operational use.

## What maps to what

| Workbook sheet | In the app |
|---|---|
| UNIT_MASTER, ITEM_MASTER, LOCATION_MASTER | Mongo collections `units`, `items`, `locations`, seeded from `server/seed/masters.json` (extracted from the sheet as-is) |
| STOCK_LEDGER | `stocklots`. Balance and status are computed, not stored |
| DEMAND_ENTRY + ISSUE_PLAN | `demands`. Each demand line carries its pick status, and the pick location / stage lane are joined at read time |
| UNIT_ISSUE | **Units** page and the unit detail screen (pick → stage → load → verify → dispatch) |
| DASHBOARD | **Control Board** |

Every formula from the sheet lives in one place: [`server/logic.js`](server/logic.js).

Beyond the sheet:
- **Issue clock.** Measures the time from "start loading" to "dispatch" against the 10-minute target.
- **FEFO stock issue on dispatch.** Stock is drawn first-expiry-first-out, and dispatch is refused if stock is short.
- **Pick lines lock once loading starts.** "Step back" is allowed until dispatch.
- **Alerts.** Shortfalls, items below reorder level, lots expiring within 30 days, and pick locations missing from the Location Master.

## Data issue found in the source sheet

ITEM_MASTER puts **Dal at S2-R09** and **Edible Oil at S3-R17**, but in LOCATION_MASTER Rack 9 is in Shed 1 and Rack 17 is in Shed 2.
The sheet's ISSUE_PLAN therefore sends pickers to locations that don't exist. The app flags this instead of silently correcting it.

## Run locally

```bash
npm install
cp .env.example .env   # set ADMIN_PASSWORD and JWT_SECRET
npm run dev            # API :5001 + web :5180
```

If `MONGODB_URI` is empty, the API starts a throwaway in-memory MongoDB and seeds demo data, so nothing else needs installing.
The data resets on every restart.

## Deploy (GitHub + Netlify + MongoDB Atlas)

1. Create a free MongoDB Atlas cluster. Add a database user, allow network access from `0.0.0.0/0` (Netlify functions have no fixed IP), and copy the connection string.
2. Push this repo to GitHub and import it in Netlify. The build settings come from `netlify.toml`.
3. In Netlify → Site settings → Environment variables, set:
   - `MONGODB_URI`, the Atlas string, including a database name, e.g. `…mongodb.net/depot-wms?retryWrites=true`
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, the login created on first boot
   - `JWT_SECRET`, from `openssl rand -hex 32`
   - `SEED_DEMO`, set to `false` once you load real data
4. Deploy. The first API request creates the admin user and, if the database is empty, seeds the demo data.

To reset the demo data in Atlas: `MONGODB_URI=… npm run seed -- --wipe`.

## Structure

```
server/            Express app, Mongoose models, formulas (logic.js), seed
netlify/functions  api.js wraps the Express app for Netlify
src/               React (Vite, JSX): pages/, components/, styles/app.css (design tokens)
```

## Design notes

- Olive, khaki and brass palette with a **Day / Night** toggle. Night mode is a separately tuned palette, not an inverted one.
- The stage colours were checked for colour-blind separation in both modes, and every status also has a text label.
- Saira Stencil headings, IBM Plex Sans body text, and Plex Mono for codes, locations and quantities. Fonts are bundled, not loaded from a CDN.
- Times are shown in IST, 24-hour (`14:32 hrs`). Dates use the `01 OCT 2026` format.
- On phones there is a bottom tab bar, 44px touch targets, and a sticky action button on the unit screen.
- No official crests or insignia are included. Add your unit's authorised insignia to `components/ui.jsx` (`BrandMark`) if required.
