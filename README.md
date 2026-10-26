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
