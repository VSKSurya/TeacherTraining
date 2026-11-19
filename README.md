# ERNet Dashboard (React)

React + TypeScript + MUI recreation of the Phasewise Dashboard, Content Library, and MIS Reports.

The app uses the shared sidebar, topbar, and footer. MIS report pages share the `ReportTable` and `ReportFilterPanel` components, while retaining their report-specific columns, filters, dialogs, and pagination.

## Routes

- `/login` — ERNet sign-in screen
- `/holiday-master` — Holiday calendar and access administration (Demo1 administrator)
- `/` — Phasewise dashboard
- `/content-library` — Content Library
- `/reports/batch-performance` — Batch Performance
- `/reports/training-summary` — Training Summary
- `/reports/attendance-report` — Attendance Report

## Development

- `npm install` — install dependencies
- `npm run dev` — start the Vite development server
- `npm run build` — type-check and build the production bundle
- `npm run preview` — serve the production bundle locally

Set `VITE_BUSINESS_TIME_ZONE` to an IANA time zone (for example, `Asia/Kolkata`) to define the business date used by daily attendance. The attendance page defaults to `Asia/Kolkata` when the variable is not set.

### Consent service

Set `VITE_CONSENT_API` to the consent service base URL. The service must provide:

- `GET /status?userId=...`, returning `{ "status": "Accepted" | "Pending", "version": "2026-01", "acceptedAt": "..." }` (or the same values inside a `record` object).
- `POST /accept`, receiving `{ "userId": "...", "status": "Accepted", "version": "2026-01", "acceptedAt": "..." }` and returning `{ "accepted": true, "acceptedAt": "..." }` (or `{ "success": true }`).

The backend must authenticate the signed-in trainee and authorize the supplied user ID. Excel-imported trainees remain Pending until the service confirms an accepted record for the current consent version. In local Vite development, consent acceptance is stored in the browser for demo use when `VITE_CONSENT_API` is unset; production requires the configured service and blocks dashboard access if it cannot verify or save consent.
