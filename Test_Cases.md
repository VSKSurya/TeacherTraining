# Screen-by-Screen Test Cases

**Interactive HTML edition:** [docs/Test_Cases.html](docs/Test_Cases.html)

**Application:** ERNet Teacher / Student Training Tracker  
**Coverage:** Sign-in, role-based access, dashboards, operational modules, reports, registration, and session behavior  
**Type:** Manual functional and access-control test cases

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
| LGN-010 | Sign in as each Demo1–Demo8 account. | Correct role dashboard is displayed and the header/profile identifies the signed-in account. |
| LGN-011 | While signed in, refresh the page and open a permitted route directly. | Session persists and the permitted screen loads. |
| LGN-012 | Use profile menu > Logout. Then refresh or revisit a protected route. | Session is cleared and user is returned to sign-in; protected content is not shown. |
| LGN-013 | Deactivate a non-current user through Super Admin Access & Users, then attempt sign-in as that user. If already signed in as that user, revisit/refresh a page. | New sign-in is rejected. On the next session lookup, an inactive account is treated as signed out. |
| LGN-014 | Visit a protected route while signed out, for example `/projects`. | Sign-in screen is shown; protected page content is not accessible. |
| LGN-015 | Sign in with a role that lacks access and enter a restricted URL directly. | User is returned to their own dashboard; restricted module data/actions are not rendered. |

## 2. Role and route access matrix

For each row, sign in with the specified account, inspect the sidebar, open each allowed route, then enter one or more disallowed URLs directly. Verify denied routes return to the role’s dashboard.

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
| DSH-001 | Sign in as each demo role: Demo1–Demo8. | Demo2/3 see the Schoolnet dashboard; Demo4 State, Demo5 School, Demo6 Trainer, Demo7 Trainee dashboards; Demo1 and Demo8 see the shared phasewise dashboard. |
| DSH-002 | On shared phasewise dashboard, switch Teacher/Student audience and select phases. | Selected audience/phase is reflected in the displayed overview and controls. |
| DSH-003 | Apply dashboard filters, then clear filters. | Filtered content updates; clear action resets all dashboard filters. |
| DSH-004 | Collapse and expand the sidebar; repeat at a narrow viewport. | Navigation collapses/expands, controls remain usable, and content does not become inaccessible. |
| DSH-005 | On State Admin dashboard, filter authorized states, drill state → district → block → cluster → school → batch, then use breadcrumbs. | Rows and hierarchy level update at each step; breadcrumbs return to the selected level; empty levels show a clear empty message. |
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
| PRJ-005 | Open Projects as Demo1, Demo4–Demo8 and inspect assigned project visibility and editing controls. | Projects are scoped by role/assignment; only Super Admin and Project Admin can configure portal projects. |
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
| ASM-001 | Open `/assessments` as Demo2–Demo7, then as Demo1 and Demo8. | Schoolnet Super Admin, Project Admin, State Admin, School Admin, Trainer, and Trainee can access the screen through route permissions; Sponsor Admin and Reporting/Audit User return to dashboard. |
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
| RPT-002 | Apply each report’s filters and then reset them. | Table/chart values update to matching records and reset restores default report scope. |
| RPT-003 | Change page/page size and sort columns where supported. | Visible rows and pagination totals reflect the selected settings. |
| RPT-004 | Open a row’s View/details action (notably Attendance Report). | Detail dialog displays the selected row’s values and closes through close button/backdrop as supported. |
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
