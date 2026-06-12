# Cloudflare Pages Deployment

This project is a static PWA. It does not need a build step today.

## Recommended Pages Settings

- Project type: Pages
- Source: GitHub repository
- Repository: `wushenghao666/uestc-padel`
- Production branch: `main`
- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `/`
- Root directory: leave empty

## First Deployment

1. Push the latest `main` branch to GitHub.
2. In Cloudflare Dashboard, open `Workers & Pages`.
3. Choose `Create application` -> `Pages` -> `Connect to Git`.
4. Authorize GitHub and select `wushenghao666/uestc-padel`.
5. Use the settings above and deploy.

## Release Notes

- The service worker cache name in `sw.js` should be changed whenever static assets need a forced refresh.
- Shared data is stored through Cloudflare Pages Functions and a D1 binding named `DB`.
- Admin login is checked by the Pages Function. Set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in Cloudflare Pages environment variables before public use.

## D1 Setup

1. In Cloudflare Dashboard, create a D1 database, for example `uestc-padel`.
2. Open the database console and run the SQL in `schema.sql`.
3. Open the Pages project settings, then add a D1 binding:
   - Variable name: `DB`
   - D1 database: the database created above
   - Environment: Production
4. Add Pages environment variables:
   - `ADMIN_PASSWORD`: the administrator password
   - `ADMIN_SESSION_SECRET`: a long random string used to sign admin sessions
5. Redeploy the latest `main` branch.

The app keeps a local cache for fast first paint and offline fallback. If the D1 state is empty on the first connected load and the current browser still has local events, the app seeds D1 from that local cache once.
