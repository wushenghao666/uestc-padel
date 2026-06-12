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
- For a future shared database, keep Cloudflare Pages for hosting and replace the local `localStorage` access in `app.js` with Supabase, Firebase, or Cloudflare-backed API calls.
- Do not rely on the current front-end admin password for public production use. Move admin authentication to a back end or database access rules before storing shared data.
