# Deploying Paper Preflight

The app is a static site: `npm run build` produces `dist/` (HTML, JS, CSS and the pdf.js worker).
It uses relative asset paths (`base: './'`), so the same build works at a domain root and under a
sub-path such as `https://<user>.github.io/<repo>/`. No environment variables or secrets are needed.

## GitHub Pages (GitHub Actions)

The workflow is in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). On every push to
`main` (or a manual run) it installs dependencies, runs the unit tests, builds, runs the Playwright
end-to-end tests and publishes `dist/` with the official Pages actions.

1. Push the repository to GitHub with the default branch named `main`
   (or edit `branches:` in the workflow).
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` or run the workflow from the **Actions** tab ("Deploy to GitHub Pages" → *Run workflow*).
4. When the `deploy` job finishes, the URL is shown on the job and under **Settings → Pages**.

Workflow outline:

```yaml
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:   # checkout → setup-node (.nvmrc) → npm ci → npm test → npm run build
           # → playwright e2e → actions/upload-pages-artifact (path: dist)
  deploy:  # needs: build → actions/deploy-pages
```

A separate [`ci.yml`](.github/workflows/ci.yml) runs the same tests on pull requests without deploying.

Custom domain: add it under **Settings → Pages → Custom domain**. Nothing in the build has to change.

## Cloudflare Pages (alternative)

**Git integration**

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick the repository.
2. Build settings:
   - Framework preset: *None* (or *Vite*)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable `NODE_VERSION` = `22`
3. Save and deploy. Every push to the production branch redeploys; pull requests get preview URLs.

**Direct upload with Wrangler** (no Git connection):

```bash
npm ci && npm run build
npx wrangler pages deploy dist --project-name paper-preflight
```

## Optional: HTTP security headers

The CSP is injected as a `<meta>` tag at build time, which works on any static host. If your host
supports response headers (Cloudflare Pages `_headers`, Netlify, nginx) you can additionally send:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

For Cloudflare Pages, put these in `public/_headers` under a `/*` rule; Vite copies `public/` into `dist/`.
