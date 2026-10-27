# Test Cases Execution Report

## Run details

| Field | Value |
|---|---|
| Execution date | 2026-10-27 (Asia/Kolkata) |
| Application | Teacher Training Dashboard |
| Source revision | `0fd0aef` with the working-tree changes present during this run |
| Environment | Local Vite production preview at `http://127.0.0.1:4173/TeacherTraining/`, Microsoft Edge InPrivate |
| Data | Existing demo data and synthetic invalid inputs only |
| Execution type | Production build plus manual, read-only UI checks and negative-input checks |

## Summary

| Result | Count |
|---|---:|
| Passed | 9 |
| Failed | 0 |
| Not run / blocked | Remaining automated, functional, and VAPT cases |

â€œPassedâ€ means the specific local behavior listed below matched its expected result. It does not mean the whole test plan or a penetration test passed.

## Executed cases

| Run ID | Test case | Result | Evidence |
|---|---|---|---|
| RUN-001 | Production build | **PASS** | `npm run build` completed successfully, including TypeScript and Vite production compilation. |
| RUN-002 | LGN-003 â€” sign in with the Demo1 account | **PASS** | The prefilled demo credentials opened the Sponsor Admin dashboard. The signed-in session remained active while navigating to routes. |
| RUN-003 | PRJ-001 â€” open Projects | **PASS** | Projects screen rendered with the seeded project record. No data was edited. |
| RUN-004 | RPT-001 â€” open Batch Performance Report | **PASS** | Report screen, filters, and table rendered. It showed 750 records, 10 rows on the first page, and page 1 of 75 with Next available. |
| RUN-005 | RPT-001 â€” open Attendance Report | **PASS** | Report screen, filters, and table rendered. It showed 62,700 records, 10 rows on the first page, and page 1 of 6,270 with Next available. |
| RUN-006 | RPT-001 / pagination behavior â€” Assessment & Feedback Report | **PASS** | Screen and Result type filter rendered with 3 submissions. Pagination was absent for this result set (10 or fewer). The removed introductory copy was not present in the accessible page content. Right alignment of Result type was not reliably verifiable in this run. |
| RUN-007 | RPT-001 / pagination behavior â€” Training Summary | **PASS** | Screen rendered with 5 plans and no pagination for this result set (10 or fewer). |
| RUN-008 | REC-002 â€” recovery when API is not configured | **PASS** | With synthetic `vapt-test@example.invalid`, the page displayed the expected â€œnot configuredâ€ administrator guidance and did not enter an OTP step. |
| RUN-009 | OPN-004 â€” unknown registration batch code | **PASS** | Synthetic `INVALID-VAPT-CODE` produced the expected no-match warning. No registration request was submitted. |
| RUN-010 | ACL-009 / SEC-002 â€” Demo1 directly opens `/attendance` | **PASS (UI gate only)** | The Attendance page did not render; dashboard content appeared instead. This only checks client-side route behavior and does not prove server-side authorization. |

The summary count excludes the build row: 9 application cases were checked. RUN-006 and RUN-007 include the requested pagination threshold observation for result sets below 11 rows. The two large reports demonstrated pagination above 10 rows.

## Not run

- The project does not define an `npm test` script or a configured automated test framework, so there was no automated case suite to execute.
- Most cases in `Test_Cases.md` require role-by-role sessions, controlled mutations, dedicated test fixtures, import files, or configured backend services. They were not exercised in this run.
- The VAPT page-level cases `SEC-001`â€“`SEC-016` and code-level cases `CODE-*` were not performed as a full assessment. Only the limited route-gate observation in RUN-010 was checked.
- Recovery OTP success, expiry, replay, enumeration, and throttling need a controlled recovery service. No such service was configured.
- Server-side access control, API authorization, deployed TLS and response headers, rate limiting, and production behavior cannot be established from this local browser run.
- Result type visual alignment could not be confirmed reliably at the available browser viewport; this item remains unverified.

## Build note

Vite reported that the generated JavaScript bundle is larger than its 500 kB advisory threshold (largest generated JS asset approximately 1,021.58 kB). This was a warning; the build succeeded. Consider code splitting or lazy-loading report routes if bundle size is a performance concern.

## Overall assessment

The build and nine listed local checks passed. No failure was observed in those checks. This result is **not a VAPT clearance** and does not supersede the static security finding documented in `Test_Cases.md`: client-side demo authentication and route checks are not a trusted security boundary for real or shared records. Complete the marked security cases against a properly configured, authorized staging environment before treating security as verified.

## Related test plan

- Source test cases and VAPT plan: [`Test_Cases.md`](./Test_Cases.md)
- HTML test-case copy: [`docs/Test_Cases.html`](./docs/Test_Cases.html)

