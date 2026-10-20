# StarConnecting — complete site + API

This project has two parts:
- The static website (`index.html`, `styles.css`, `app.js`, `config.js`) can be hosted on GitHub Pages.
- The API (`worker/`) runs separately as a Cloudflare Worker and stores listings in Cloudflare D1.

## 1. Keep the live site safe

Make a backup or use a new branch in GitHub before replacing your current files. The API Worker is separate from the website.

## 2. Set the exact API URL

Open `config.js` and set `API_URL` to the exact URL shown on the Cloudflare overview page for your `starconnecting-api` Worker. It should be the base URL only, without `/api/servers`.

## 3. Create and configure the D1 database

In Cloudflare Dashboard:
1. Go to **Workers & Pages → D1 SQL database** (the wording may vary).
2. Create a database named `starconnecting-db`.
3. Open its SQL console and run all SQL in `worker/schema.sql`.
4. Open the `starconnecting-api` Worker settings and add a D1 database binding:
   - Variable name / binding: `DB`
   - Database: `starconnecting-db`
5. Save and deploy the Worker.

If deploying through Wrangler instead, replace the placeholder `database_id` in `worker/wrangler.jsonc` with your real D1 database ID and run the SQL schema against that database.

## 4. Deploy the Worker

Use Cloudflare's Git integration or Wrangler. If using Wrangler from your computer:
1. Install Node.js LTS.
2. Open a terminal in the `worker` directory.
3. Run `npx wrangler login`.
4. Run `npx wrangler d1 list` and copy the real ID for `starconnecting-db` into `wrangler.jsonc`.
5. Run `npx wrangler d1 execute starconnecting-db --remote --file=schema.sql`.
6. Run `npx wrangler deploy`.

Do not deploy the `worker/` directory as the static website root. It is the API project.

## 5. Deploy the static website

Commit `index.html`, `styles.css`, `app.js`, and `config.js` to your GitHub repository. In GitHub Pages, publish from the branch/folder containing those files. Keep the files together in the same directory.

## 6. Verify

Open these URLs using the exact Worker URL:
- `/` should return JSON with `"status":"online"`.
- `/health` should return JSON with `"status":"ok"` and `"databaseConfigured":true`.
- `/api/servers` should return `{"servers":[]}` for an empty database.

Then visit the website, submit a test listing, and refresh the directory. The listing should still be there after refreshing.

## Notes

- The API currently permits browser requests from any origin for ease of initial setup. For a public production deployment, restrict `Access-Control-Allow-Origin` to your exact GitHub Pages domain.
- The project validates input but does not include moderation, rate limiting, CAPTCHA, or an approval queue. Anyone who finds the submission form can submit a listing. Add moderation/rate limiting before relying on it for a large public directory.
