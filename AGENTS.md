# Repository Guidelines

## Project Structure & Module Organization

The application is a Vite and React project written in TypeScript. Keep UI code in `src/`, static files in `public/`, and documentation in `docs/`. Reusable text prompts live in `prompts/`. The production build is generated in `dist/` and is ignored by Git.

## Build, Test, and Development Commands

- `npm ci` installs the exact dependencies from `package-lock.json`.
- `npm run dev` starts the local Vite development server.
- `npm run build` runs the TypeScript project build and creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.

There is no separate test script configured. Run `npm run build` to type-check and build before submitting changes.

## Coding Style & Naming Conventions

Use TypeScript and React conventions already present in `src/`: components use descriptive PascalCase names, utility modules use concise camelCase names, and styles stay in CSS files near their feature. Follow the existing formatting in adjacent files and avoid adding dependencies when current packages suffice.

## Testing Guidelines

No automated test framework is configured yet. Validate changes with `npm run build`; document any manual checks needed for UI behavior in the pull request. Add regression coverage when a test framework is introduced.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects (for example, `Add training report filter`). Pull requests should explain the purpose, summarize changes, list checks performed, link related issues when available, and include screenshots for visual changes.

## Security & Configuration

Do not commit credentials, tokens, or machine-specific configuration. Store secrets in environment variables or ignored local configuration files, and provide sanitized examples when configuration is needed.
