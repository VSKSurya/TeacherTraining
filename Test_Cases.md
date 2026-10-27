# Screen-by-Screen Test Cases

**Interactive HTML edition:** [docs/Test_Cases.html](docs/Test_Cases.html)

**Application:** ERNet Teacher / Student Training Tracker  
**Coverage:** Sign-in, role-based access, dashboards, operational modules, reports, registration, and session behavior  
**Type:** Manual functional and access-control test cases

**Security report:** VAPT-style static review and security test plan are included in sections 18â€“22 below. The interactive edition is [docs/Test_Cases.html](docs/Test_Cases.html).

## Test setup

- Start with a clean browser profile or clear `teacher-training-session` and `teacher-training-users` from local storage. The app will seed demo users on first use.
- All demo accounts use password `demo1@123`:

| User ID | Role |
|---|---|
| Demo1 | Sponsor Admin |
| Demo2 | Schoolnet Super Admin |
| Demo3 | Schoolnet Project Admin |
| Demo4 | State Admin |
| Demo5 | School Admin |
| Demo6 | Trainer |
| Demo7 | Trainee |
| Demo8 | Reporting/Audit User |

- Seed or create representative projects, plans, batches, trainees, attendance, forms, and report data where a case requires records. Empty states are valid when there is no matching data.
- Record **Actual Result**, **Pass/Fail**, and **Defect ID** during execution. These are proposed test cases; they have not been executed.

## 1. Login and session

| ID | Test case / steps | Expected result |
|---|---|---|
| LGN-001 | Open `/login` in a signed-out browser. | Sign-in form displays identity and password fields, Sign in button, open-registration and trainee-ID-recovery links. |
| LGN-002 | Submit with both fields blank. | Required-field validation appears; no session is created. |
| LGN-003 | Sign in as `Demo1` with `demo1@123`. | Authentication succeeds, session is stored, and app navigates to the dashboard. |
| LGN-004 | Sign in with a valid ID using different letter casing and surrounding spaces. | ID matching is case-insensitive and whitespace around the ID is ignored; sign-in succeeds. |
| LGN-005 | Submit a valid ID with an incorrect password. | Sign-in is rejected with the invalid/deactivated account message; no session is stored. |
| LGN-006 | Submit an unknown ID with the demo password. | Sign-in is rejected with the same generic error; no session is stored. |
| LGN-007 | Use Show password, then Hide password. | Password becomes readable, then masked again; entered value is unchanged. |
| LGN-008 | Select each story-slide dot. | Corresponding promotional slide changes and the selected dot exposes pressed state. |
| LGN-009 | Select Forgot password? | The page displays the current guidance message. No reset delivery is initiated by this control. |
| LGN-010 | Sign in as each Demo1â€“Demo8 account. | Correct role dashboard is displayed and the header/profile identifies the signed-in account. |
| LGN-011 | While signed in, refresh the page and open a permitted route directly. | Session persists and the permitted screen loads. |
| LGN-012 | Use profile menu > Logout. Then refresh or revisit a protected route. | Session is cleared and user is returned to sign-in; protected content is not shown. |
| LGN-013 | Deactivate a non-current user through Super Admin Access & Users, then attempt sign-in as that user. If already signed in as that user, revisit/refresh a page. | New sign-in is rejected. On the next session lookup, an inactive account is treated as signed out. |
| LGN-014 | Visit a protected route while signed out, for example `/projects`. | Sign-in screen is shown; protected page content is not accessible. |
| LGN-015 | Sign in with a role that lacks access and enter a restricted URL directly. | User is returned to their own dashboard; restricted module data/actions are not rendered. |

## 2. Role and route access matrix

For each row, sign in with the specified account, inspect the sidebar, open each allowed route, then enter one or more disallowed URLs directly. Verify denied routes return to the roleâ€™s dashboard.

| ID | Account | Expected visible menus / route access |
|---|---|---|
| ACL-001 | Demo1 Sponsor Admin | Dashboard, Projects, MIS Reports; no operational administration modules. |
| ACL-002 | Demo2 Schoolnet Super Admin | Dashboard, Projects, Training Plans, Batches, Attendance, Content Library, Assessments, Certificates, MIS Reports, Holiday Master, Trainer Repository. |
| ACL-003 | Demo3 Schoolnet Project Admin | Same operational modules as Super Admin except Holiday Master. |
| ACL-004 | Demo4 State Admin | Dashboard, Projects, Training Plans, Batches, Attendance, MIS Reports, Trainer Repository. |
| ACL-005 | Demo5 School Admin | Dashboard, Projects, Training Plans, Batches, Attendance, Content Library, Trainer Repository. |
| ACL-006 | Demo6 Trainer | Dashboard, Projects, Batches, Attendance, Content Library, Trainer Repository. |
| ACL-007 | Demo7 Trainee | Dashboard, Projects, Training Plans, Content Library, Assessments, Certificates. |
| ACL-008 | Demo8 Reporting/Audit User | Dashboard, Projects, MIS Reports; no operational administration modules. |
| ACL-009 | Each signed-in role | Registration Requests is accessible to Super Admin, Project Admin, State Admin, School Admin, and Trainer; Sponsor Admin, Trainee, and Reporting/Audit User return to their dashboard. |
| ACL-010 | Any signed-in role | `/register` and `/recover-trainee` remain reachable as public support flows. |

## 3. Dashboard and shared navigation

| ID | Test case / steps | Expected result |
|---|---|---|
| DSH-001 | Sign in as each demo role: Demo1â€“Demo8. | Demo2/3 see the Schoolnet dashboard; Demo4 State, Demo5 School, Demo6 Trainer, Demo7 Trainee dashboards; Demo1 and Demo8 see the shared phasewise dashboard. |
| DSH-002 | On shared phasewise dashboard, switch Teacher/Student audience and select phases. | Selected audience/phase is reflected in the displayed overview and controls. |
| DSH-003 | Apply dashboard filters, then clear filters. | Filtered content updates; clear action resets all dashboard filters. |
| DSH-004 | Collapse and expand the sidebar; repeat at a narrow viewport. | Navigation collapses/expands, controls remain usable, and content does not become inaccessible. |
| DSH-005 | On State Admin dashboard, filter authorized states, drill state â†’ district â†’ block â†’ cluster â†’ school â†’ batch, then use breadcrumbs. | Rows and hierarchy level update at each step; breadcrumbs return to the selected level; empty levels show a clear empty message. |
| DSH-006 | On School Admin dashboard, filter by UDISE code and select a school where available. | Dashboard metrics and school details reflect the selected/filtered school; no linked school is explained as an empty assignment. |
| DSH-007 | On Schoolnet dashboard, select an authorized project. | Project-level metrics and lists update; unauthorized projects are not available. |
| DSH-008 | Open the profile menu and select My Profile; close the profile dialog. | The profile dialog opens with current account details and closes using its close control. |
| DSH-009 | On screens that expose the theme selector, switch Light/Dark and inspect the active state. | The selected option is marked active/pressed and the supported UI changes theme. |

## 4. Projects (`/projects`)

| ID | Test case / steps | Expected result |
|---|---|---|
| PRJ-001 | Open Projects from an authorized account. | Projects page loads and lists available projects or a clear empty state. |
| PRJ-002 | Search/filter projects using available controls. | Only matching projects remain; clearing the filter restores the full list. |
| PRJ-003 | Open a project and inspect its phases/details. | Selected project details and phase information match the chosen record. |
| PRJ-004 | As Demo2 or Demo3, select an unconfigured Odoo catalog project and choose Configure project. Save without an internal code, then with valid project dates, code, and valid phase data. | Missing/duplicate code, invalid date ranges, incomplete phases, or duplicate phase sequence is rejected; valid configuration is saved and appears in the project list. |
| PRJ-005 | Open Projects as Demo1, Demo4â€“Demo8 and inspect assigned project visibility and editing controls. | Projects are scoped by role/assignment; only Super Admin and Project Admin can configure portal projects. |
| PRJ-006 | Edit a configured project and associate active training plans; remove an association and save. | Associations reflect the saved selection; inactive plans cannot be linked unless the Super Admin explicitly enables the inactive-plan option. |

## 5. Training Plans (`/training-plans`)

| ID | Test case / steps | Expected result |
|---|---|---|
| PLN-001 | Open Training Plans as each allowed role. | Plans page loads with plans available to that role or a clear empty state. |
| PLN-002 | Filter plans by available project/phase/status controls. | Plan list and summary reflect selected filters; reset restores defaults. |
| PLN-003 | Open a plan and inspect its learning structure/schedule. | Plan details, modules, days, and linked project are internally consistent. |
| PLN-004 | Use the Training Plan form to create a plan with missing required values, then complete it and save; edit the saved plan. | Missing required fields are rejected; a valid plan is saved, listed, and editable. Confirm role permissions using the rendered authorization state. |
| PLN-005 | Inspect plan modules/days and attempt invalid date/order or duplicate plan code values where applicable. | Invalid structure is rejected or clearly reported; saved plan details remain consistent after reload. |

## 6. Batches (`/batches`)

| ID | Test case / steps | Expected result |
|---|---|---|
| BAT-001 | Open Batches as an authorized role. | Batch list loads or shows an empty state. |
| BAT-002 | Apply project, phase, state, district, school/UDISE, plan, trainer, and status filters individually and in combination. | Results match the selected filter combination; clearing filters restores results. |
| BAT-003 | Create/edit a batch with required values missing, invalid dates/capacity, and valid values. | Invalid input is rejected with useful validation; valid batch is saved and displayed. |
| BAT-004 | Use the batch import control with a valid workbook and then a malformed or unsupported workbook. | Valid workbook rows follow the configured import policy; unreadable or invalid workbook is rejected with a useful message and does not create malformed batches. |
| BAT-005 | Open a batch and navigate to its registration/attendance-related actions. | Actions use the selected batch and preserve its identity/context. |

## 7. Registration Requests (`/registration-requests`)

| ID | Test case / steps | Expected result |
|---|---|---|
| REG-001 | Open as each allowed operational role; repeat as Sponsor Admin and Trainee. | Authorized roles see request management; unauthorized roles return to their dashboard. |
| REG-002 | Download Excel template and open it. | Download completes and template contains supported trainee columns. |
| REG-003 | Choose a batch and upload a valid `.xlsx` trainee file. | File is validated against the selected batch; valid rows show pending approval/import preview and IDs as applicable. |
| REG-004 | Upload a workbook with missing required values, duplicate identifiers, invalid contacts, and a non-XLSX file. | Row-level validation identifies problems; invalid file type is rejected; invalid rows are not imported. |
| REG-005 | Import a workbook containing both valid and invalid rows and choose Import valid rows. | Only valid rows import; result counts and row statuses are accurate. |
| REG-006 | Open/close registration, set before/after-day windows, and set capacity; save. | Settings validate nonnegative whole days and valid capacity; saved settings persist and are anchored to batch Day 1. |
| REG-007 | Manually change registration state without entering a reason, then enter a reason and save. | Manual open/close requires the reason; saved change is reflected in the batch controls. |
| REG-008 | Review pending requests and approve, reject, and withdraw using available actions. | Each action updates status once, displays feedback, and persists after reload. |
| REG-009 | Filter requests by batch/status/search and clear filters. | Matching requests display and reset returns all in-scope requests. |

## 8. Trainer Repository (`/trainers`)

| ID | Test case / steps | Expected result |
|---|---|---|
| TNR-001 | Open repository as authorized roles. | Trainer profiles load or an empty state is shown. |
| TNR-002 | As an administrator, add/edit a profile with unique trainer code, name, category, optional linked login, contact, competencies, and location. Submit missing required values, then valid values. | Trainer code and name are required; valid profile saves and is shown. State selection controls district options, and district controls school/service-area options. |
| TNR-003 | As a trainer, open the repository and inspect the linked profile; edit allowed profile fields. | Trainer sees their linked record; administrator-only fields/actions remain unavailable. |
| TNR-004 | Select a future calendar date and add availability; enter status, optional times, and remarks. Try edit/delete for a past date. | Availability saves for future dates; past-date entries cannot be edited/deleted. Confirmed assignment conflicts are visibly identified. |

## 9. Attendance (`/attendance`)

| ID | Test case / steps | Expected result |
|---|---|---|
| ATT-001 | Open Attendance, choose project, batch, and training date. | Trainees for the selected batch/date load; date defaults and business timezone behavior are correct. |
| ATT-002 | Attempt to select a future training date. | Future date is unavailable or rejected. |
| ATT-003 | Mark trainees Present/Absent and save. | Saved states and confirmation appear; records remain tied to the trainee, batch, and date after reload. |
| ATT-004 | Try saving with a trainee status unset. | Save is disabled or validation identifies missing attendance. |
| ATT-005 | Download attendance template and upload a valid workbook. | Template downloads; workbook is parsed and rows are previewed with correct trainee/date/status mapping. |
| ATT-006 | Upload invalid, duplicate, or partially valid attendance rows. | Validation identifies row errors; import valid rows imports only eligible rows and reports outcomes. |
| ATT-007 | Amend an already saved attendance value as a non-Super Admin. | Amendment is blocked. |
| ATT-008 | Amend saved attendance as Super Admin without a reason, then with a reason. | Save is blocked without a reason; authorized amendment saves with audit/context feedback when reason is provided. |

## 10. Content Library (`/content-library`)

| ID | Test case / steps | Expected result |
|---|---|---|
| LIB-001 | Open library as an authorized role. | Resource list loads or a clear no-resources state appears. |
| LIB-002 | Search/filter resources by available category, type, or keyword. | Only matching resources remain; clearing search restores the list. |
| LIB-003 | Open resources in each supported preview type (document, image, audio/video, or link as available). | Preview/open behavior matches file type; broken or unsupported resources show clear feedback. |
| LIB-004 | Attempt to access library as a role without permission. | Library content is not rendered; user is returned to dashboard. |

## 11. Assessments and Feedback (`/assessments`)

| ID | Test case / steps | Expected result |
|---|---|---|
| ASM-001 | Open `/assessments` as Demo2â€“Demo7, then as Demo1 and Demo8. | Schoolnet Super Admin, Project Admin, State Admin, School Admin, Trainer, and Trainee can access the screen through route permissions; Sponsor Admin and Reporting/Audit User return to dashboard. |
| ASM-002 | As a manager, create a native form with required fields/questions and save. | Valid form is linked to selected plan/day/stage and appears in the forms list. |
| ASM-003 | Save a form with missing title, invalid rules, or incomplete required question data. | Validation blocks invalid configuration and identifies required values. |
| ASM-004 | As a trainee, open an assigned form and submit with required answers missing. | Required-answer validation prevents submission unless the form allows unanswered items. |
| ASM-005 | Submit a valid form; inspect grading, attempt limit, and completion state. | Completion is recorded once, score/pass status follows configured rules, and attempts respect limit. |
| ASM-006 | Start a timed form and let timer expire. | Timer reaches zero, submission is disabled or handled according to expiry rules, and status is accurate. |
| ASM-007 | Open an external/integrated linked form and return to record completion. | Link opens safely in a separate context; return flow records completion only after submit. |
| ASM-008 | View form results as manager and as a role with limited scope. | Results are shown only for authorized scope; no cross-assignment data is exposed. |

## 12. Holiday Master (`/holiday-master`)

| ID | Test case / steps | Expected result |
|---|---|---|
| HOL-001 | Open as Super Admin, Project Admin, and signed-out visitor. | Super Admin sees administration; Project Admin sees access-denied gate; signed-out visitor sees sign-in-required gate. |
| HOL-002 | Add national holiday with valid name/date and optional note. | Holiday appears as active, national, and All India. |
| HOL-003 | Add state holiday with state/district/school scope; omit required data and retry. | Incomplete scope is rejected; complete record appears with selected location. |
| HOL-004 | Enter invalid date, duplicate holiday, and date through calendar picker. | Invalid/duplicate dates are handled with validation; picker and text entry remain synchronized. |
| HOL-005 | Filter calendar by All, National, State; toggle Show inactive. | Rows reflect scope/status filters and empty results show a clear message. |
| HOL-006 | Edit, deactivate, and reactivate a holiday. | Updated details/status persist and inactive records appear when requested. |
| HOL-007 | Add a user, change a role, deactivate/reactivate account, and inspect audit log. | User changes persist; deactivated user cannot sign in; audit log captures actor/action/details. Current Super Admin cannot deactivate its own required admin account. |
| HOL-008 | Attempt to access by direct URL with an unauthorized signed-in role. | Access gate is shown and no holiday/user controls are available. |

## 13. Reports

Run each case for `/reports/batch-performance`, `/reports/training-summary`, `/reports/attendance-report`, and `/reports/assessment-feedback` where available to the signed-in role.

| ID | Test case / steps | Expected result |
|---|---|---|
| RPT-001 | Open each report route as a role with MIS Reports access and as a role without it. | Authorized role sees the requested report; unauthorized role returns to dashboard. |
| RPT-002 | Apply each reportâ€™s filters and then reset them. | Table/chart values update to matching records and reset restores default report scope. |
| RPT-003 | Change page/page size and sort columns where supported. | Visible rows and pagination totals reflect the selected settings. |
| RPT-004 | Open a rowâ€™s View/details action (notably Attendance Report). | Detail dialog displays the selected rowâ€™s values and closes through close button/backdrop as supported. |
| RPT-005 | Load report with no matching data. | Empty state is clear; no stale rows from a prior filter/report are shown. |
| RPT-006 | Open the feedback report entry from MIS navigation. | Link behavior is consistent with the current interface; confirm the destination because the manual notes this may be a menu link rather than a dedicated route. |

## 14. Open Registration (`/register`)

| ID | Test case / steps | Expected result |
|---|---|---|
| OPN-001 | Open `/register`, enter an existing batch code with registration open. | Batch details, date/window, venue/trainer, and remaining capacity (when configured) display; registration form appears. |
| OPN-002 | Submit without a name or without both email and phone; then submit malformed email. | Name and at least one contact method are required; invalid email is rejected by the browser/form validation. |
| OPN-003 | Submit a valid request within the window and under capacity. | A pending request is saved and the screen explains that the request requires review; the form resets. |
| OPN-004 | Try an unknown batch code, closed registration, out-of-window date, or full-capacity batch. | No request is saved; an explanatory warning/closed message is shown. |
| OPN-005 | Submit same email or phone twice for the same batch; try contact details matching two different trainee records. | Duplicate request is rejected; conflicting email/mobile identity is rejected with guidance to contact the administrator. |

## 15. Recover Trainee ID (`/recover-trainee`)

| ID | Test case / steps | Expected result |
|---|---|---|
| REC-001 | With `VITE_TRAINEE_RECOVERY_API` configured, submit a registered email/mobile contact. | App calls the configured `/request-otp` endpoint; on a successful response with request ID it displays the OTP entry step and neutral confirmation. |
| REC-002 | Submit while the recovery API is not configured or the request endpoint fails. | No OTP step is entered; an explicit configuration/service error is displayed. |
| REC-003 | Enter an invalid or expired OTP. | App calls `/verify-otp`, shows the returned/fallback error, and does not show a Trainee ID. |
| REC-004 | Enter a valid OTP and receive `verified` plus `traineeId` from the service. | Trainee ID appears only after successful verification; Login and Continue to registration links are available. |
| REC-005 | Select Use a different contact. | OTP state is cleared and contact-entry step returns. |

## 16. Cross-screen and responsive checks

| ID | Test case / steps | Expected result |
|---|---|---|
| UX-001 | Navigate between allowed modules using sidebar and page links. | Correct module loads, active navigation is clear, and session remains intact. |
| UX-002 | Use browser back/forward after module navigation and modal/dialog flows. | Navigation returns to the expected screen without stale or inaccessible overlays. |
| UX-003 | Test login, tables, forms, dialogs, and navigation at desktop, tablet, and 320px viewport widths. | Content remains readable and controls are reachable without unintended horizontal clipping. |
| UX-004 | Keyboard-only navigate and submit forms; inspect visible focus and labels. | Interactive controls are keyboard reachable, focus is visible, and fields have usable accessible names. |
| UX-005 | Refresh after changes in modules that persist locally (projects, access/holidays, trainer data, attendance, etc.). | Saved local data remains after refresh in the same browser profile. Verify records remain scoped to the account and selected entity. |

## 17. Not currently verifiable from the UI alone

- Password reset delivery is not implemented by the Forgot password control; it currently shows an informational message.
- Trainee ID recovery requires `VITE_TRAINEE_RECOVERY_API` and a functioning OTP service. Without it, recovery should show the configuration message.
- The sidebar includes Assessments and Certificates labels, but only the `/assessments` route is wired in the current app; no standalone certificates route is registered.
- Feedback Report navigation should be checked against the rendered menu destination because the app/manual describe the feedback report route/menu differently.
- Role data is persisted in browser local storage for this demo app; these cases do not establish server-side identity or authorization guarantees.

## Execution record

| Run date | Build/version | Environment/browser | Tester | Passed | Failed | Blocked |
|---|---|---|---|---:|---:|---:|
|  |  |  |  |  |  |  |

## 18. VAPT report summary

**Assessment type:** Repository-scope static source review of security-relevant paths with page-level security test design. This is not a completed dynamic penetration test. No application was exercised, no production environment was probed, and no external service was contacted. The report reflects repository revision `0fd0aef` and checked-in deployment configuration reviewed on 2026-10-27.

**Result:** 1 high-severity finding, 0 medium, 0 low. The high rating is a production-readiness blocker if the application is used with real or shared records. The current code appears to keep operational data in each browser's local storage, so this review does not claim compromise of a centralized database. Runtime hosting headers, production identity, and recovery-service behavior remain unverified.

### Finding VAPT-001 â€” Client-side demo authentication does not provide a security boundary

- **Severity:** High (conditional on handling real/shared records); **confidence:** High; **classification:** CWE-602, client-side enforcement of security.
- **Evidence:** `src/auth.ts:28` embeds `demo1@123`; `src/auth.ts:75â€“83` seeds eight active identities across all roles; `src/auth.ts:118â€“133` loads and saves role/session state in browser `localStorage` and checks the shared password; `src/App.tsx:25,78` gates routes in client code; `src/Login.tsx:46,48` pre-fills the demo user and password. The same shared password is present in this document and `USER_MANUAL.md`.
- **Impact:** A visitor can sign in as a seeded administrative role and access that role's UI. Browser-local operational records and role state can be read or changed by the browser user. No central service holding those records was found in the reviewed source.
- **Remediation:** Keep shared demo identities and credentials in a demo-only build. For real users or records, authenticate with a trusted identity service and enforce every data read/write and role permission on a server. Treat client-side routes and `localStorage` only as UI state, never as authorization.
- **Retest:** Verify the production bundle has no demo credential or privileged seeded users; tamper with local role/session state and confirm protected server operations still reject the request.

### Security-control and code review

| Area | Static review result | Evidence / follow-up |
|---|---|---|
| Authentication and sessions | **Finding VAPT-001.** Shared credential, active demo accounts, and session are browser controlled. | `src/auth.ts`, `src/App.tsx`, `src/Login.tsx`. Server-side identity is not present in the reviewed repository. |
| Authorization and roles | Route, menu, and component checks execute in the client. They are usability controls only. | `src/auth.ts`, `src/App.tsx`; no backend authorization layer found. |
| Data confidentiality and integrity | Operational records, user roles, and audit history are stored in same-origin `localStorage`. A visitor with access to that browser can inspect or alter them. | Components and stores under `src/`; no shared business-data API found. This is a browser-local demo design. |
| Public registration | Registration is open by design and writes requests to browser-local data. It does not create a central request visible to another user/browser. | `src/components/OpenRegistration.tsx`; check whether public registration meets product expectations before relying on it operationally. |
| Trainee recovery | Recovery delegates OTP issuance and verification to optional `VITE_TRAINEE_RECOVERY_API`; the checked-in Pages workflow does not set that variable. | `src/components/RecoverTraineeId.tsx`, `.github/workflows/deploy.yml`. Endpoint security, expiry, throttling, and contact matching need service-side review. |
| HTML output and file parsing | Reviewed rich HTML output is constructed from static source markup or escaped certificate fields; spreadsheet import paths parse XML. No exploitable untrusted HTML source-to-sink was validated in this static pass. | `src/components/DashboardParts.tsx`, `src/sourceMarkup.ts`, `src/components/CertificateTemplates.tsx`, `src/excelUpload.ts`, `src/components/Batches.tsx`, `src/components/Attendance.tsx`. Retain payload tests in the test plan. |
| Secrets and dependencies | No server secrets or backend service configuration appear in the reviewed project; `package.json` has no test script. Dependency vulnerability status was not assessed. | `package.json`, `.github/workflows/deploy.yml`. Run dependency and build-pipeline review separately before production. |
| Hosting headers and transport | Not established by source review. Static workflow publishes the app, but HTTP response headers and runtime HTTPS behavior were not checked. | Requires approved runtime/hosting verification. |

### Page-by-page security review

| Screen / route | Security review focus | Status |
|---|---|---|
| Login and session | Demo credentials, account enumeration, session persistence/logout, direct route bypass, localStorage tampering. | VAPT-001 confirmed in source; dynamic cases not run. |
| Role dashboards and navigation | Administrative role switching, hidden menu vs direct route, cross-role data visibility. | Client-only route and role checks found; dynamic cases not run. |
| Projects and Training Plans | Tenant/project scoping, unauthorized create/edit/delete, malformed stored data. | Browser-local persistence and client role checks; no server boundary in repository. |
| Batches and Registration Requests | Unauthorized import/export/edit, open-registration data handling, batch linkage and role scoping. | Browser-local persistence; dynamic cases not run. |
| Trainer Repository and trainer views | Profile/contact data visibility, ownership checks, role switching. | Client-only filters and local storage; dynamic cases not run. |
| Attendance | Unauthorized attendance changes/exclusions, duplicate imports, audit alteration. | Records/audit are browser local; no central audit boundary in source. |
| Content Library | Public resource exposure, import parsing, malformed archive handling. | Static paths inspected; dynamic upload/fuzz testing not run. |
| Assessment and Feedback | Trainee record visibility, edit permissions, feedback confidentiality. | Local browser storage and client role checks; dynamic cases not run. |
| Holiday Master and access administration | Privileged mutation and audit tampering. | Admin gate and audit trail run in the client and use localStorage. |
| Certificates | Unauthorized issue/revoke, template injection, external links. | Client-side role gating; certificate text fields are escaped in generated HTML. Dynamic cases not run. |
| MIS and four report routes | Cross-role data leakage, report filter scope, export contents, pagination/large data. | Reports derive from browser-local records; role route gate is client-side. Dynamic cases not run. |
| Open Registration | Abuse, duplicate requests, input validation, availability/capacity checks. | Public page is intentionally unauthenticated; writes to same-browser local data. No rate limiting or server intake exists in reviewed source. |
| Recover Trainee ID | Contact enumeration, OTP expiry/replay/throttling, response leakage. | External service is optional and absent from repository; service tests are pending. |

## 19. VAPT page-level security test cases

Run only against a local/staging build and a test recovery service. These cases are **Not Run** until an execution record is filled in. Do not use real personal data.

| ID | Test case / steps | Expected result |
|---|---|---|
| SEC-001 | Open `/projects`, `/attendance`, `/holiday-master`, and `/reports/batch-performance` while signed out. | Protected routes show sign-in and no protected data or actions are rendered. |
| SEC-002 | Sign in with each demo role and directly request routes outside its role menu, including reports, access administration, certificates, and trainer repository. | Disallowed roles cannot read or perform protected operations. Record that current client-only handling is not a server authorization test. |
| SEC-003 | In a disposable browser profile, change `teacher-training-session` role/user fields in localStorage and reload a protected route. | A production-ready system must reject tampering at its trusted API; UI hiding alone is insufficient. |
| SEC-004 | Sign in, sign out, use browser back, and reopen a protected URL in the same profile. | Logout invalidates server session and protected data stays inaccessible; no sensitive cached screen is restored. |
| SEC-005 | Attempt access as inactive/deactivated user, including after an existing session is open. | Server rejects the identity on subsequent requests and access revocation takes effect. |
| SEC-006 | As each role, inspect Projects and Training Plans using direct routes and crafted project IDs. Attempt cross-project reads and create/update/delete actions. | Server checks project scope and role for every operation; changing UI state or identifiers grants no access. |
| SEC-007 | On Batches and Registration Requests, try direct editing/import/export and altered batch or trainee IDs under a low-privilege role. | Only authorized roles can perform operations; data is scoped to authorized project/batch. |
| SEC-008 | On Trainer Repository, dashboards, and Attendance, change trainer/batch/trainee identifiers and attempt to view or change another ownerâ€™s records. | Ownership and role are enforced by the trusted service; audit events cannot be altered by editing browser storage. |
| SEC-009 | Submit registration with oversized fields, HTML/script payloads, duplicate contacts, closed/unknown batch IDs, and repeated requests. | Inputs are bounded/validated; unsafe markup is rendered as text; server enforces duplicate, capacity, and abuse controls. |
| SEC-010 | Import malformed, oversized, deeply nested, or invalid XLSX/XML in Batches and Attendance. | Import is rejected safely with bounded resource use; no script runs and no partial/truncated records are saved. |
| SEC-011 | On Content Library, upload malformed archives and files containing HTML/script-like text; open imported content. | Archive limits and type validation apply; imported text is not executed as HTML/script. |
| SEC-012 | On Assessment and Feedback, Holiday Master, and certificates, use low-privilege roles and attempt direct writes, certificate revoke/reissue, and audit modification. | Unauthorized writes are denied server-side; immutable/auditable changes record the authenticated actor. |
| SEC-013 | Export data from all four reports while signed in as each role; compare rows/columns and try tampered filters. | Exports contain only the callerâ€™s authorized data and do not leak hidden columns or other project records. |
| SEC-014 | On Open Registration, repeat submissions and test missing/invalid contact, capacity boundaries, unusual Unicode, and script-like strings. | Server validates and rate-limits submissions, handles duplicates/capacity consistently, and safely encodes values. |
| SEC-015 | Against a controlled recovery service, request OTP for known/unknown contacts; test expiry, replay, brute-force limits, wrong contact, and concurrent requests. | Responses do not enumerate registered users; OTPs expire, are one-time, rate-limited, bound to the contact/request, and never disclose a trainee ID before verification. |
| SEC-016 | Inspect deployed response headers and transport in approved staging: HTTPS redirect, CSP, frame/content-type/referrer policies, and cache behavior for sensitive pages. | Hosting policy is appropriate and documented. This cannot be confirmed from the source repository alone. |

## 20. Code-level test cases

| ID | Test case / steps | Expected result |
|---|---|---|
| CODE-001 | Inspect production build artifacts for `demo1@123`, Demo1â€“Demo8 seeded accounts, and any real credentials. | No shared credentials or privileged demo identities are present in production artifacts. |
| CODE-002 | Review all protected data reads/writes and direct routes against a server-side authorization matrix. | Every API operation validates authenticated identity, role, and project/record scope; client checks are not sole enforcement. |
| CODE-003 | Tamper with every `teacher-training-*` localStorage value (invalid JSON, wrong types, cross-role records) and reload relevant screens. | UI handles corrupt data without crashing or trusting it for security decisions; authoritative records come from the service. |
| CODE-004 | Submit script markup in names, feedback, trainer profile fields, registration, imported spreadsheet cells, and certificate templates. | Values render as inert text; generated HTML escapes all untrusted fields and URLs are restricted to safe schemes. |
| CODE-005 | Inspect every `dangerouslySetInnerHTML`, `innerHTML`, dynamic URL, and `window.open` call; trace inputs to output. | No untrusted value reaches an executable HTML/URL sink without context-appropriate sanitization and validation. |
| CODE-006 | Test XLSX/XML processing with malformed relationships, huge row counts, invalid shared strings, and archive bombs. | Parser rejects invalid input and enforces file, decompression, row, and memory limits. |
| CODE-007 | Review exported CSV cells beginning with `=`, `+`, `-`, or `@` and values containing quotes/newlines. | CSV export quotes correctly and neutralizes spreadsheet formula injection. |
| CODE-008 | Verify CI installs locked dependencies, builds from a clean checkout, deploys only intended artifacts, and does not expose build secrets. | Build/deployment has reproducible dependencies and least-privilege credentials; no secrets are embedded in static output. |
| CODE-009 | Resolve `VITE_TRAINEE_RECOVERY_API` in a controlled build and verify protocol, allowed origin, response schema, and failure paths. | Endpoint is explicit, HTTPS-only, and service-side controls are tested; absent config fails closed without leaking contact data. |
| CODE-010 | Verify configured hosting security headers and caching against a representative deployed build. | CSP and other header policy are compatible with app functionality and prevent unneeded caching of sensitive responses. |

## 21. VAPT execution record

The cases in sections 19â€“20 are a security test plan, not evidence of successful runtime tests. Record an approved local/staging execution here.

| Run date | Build/revision | Environment | Tester | Passed | Failed | Blocked | Evidence/defect IDs |
|---|---|---|---|---:|---:|---:|---|
|  |  |  |  |  |  |  |  |

## 22. Assessment limitations and release gate

- Static source inspection only; no dynamic VAPT, dependency audit, automated test suite, browser session, API test, or hosting-header check was run.
- Production identity provider, database/API, network rules, backup/retention, hosting configuration, and recovery OTP service were not available in this repository review.
- Before using this application for real or shared personal/training data, implement server-side identity/authorization and shared data storage, remove demo credentials from production, then execute sections 19â€“20 in authorized staging and remediate VAPT-001.
- Dependency vulnerability assessment and deployment configuration verification are recommended follow-up activities; no vulnerability status is inferred from package versions alone.

