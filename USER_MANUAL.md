# Teacher / Student Training Tracker — User Manual

## 1. About this manual

This guide explains how to sign in, what each role sees on its dashboard, and what the available menus are for. The application has eight demo roles. Menu items are filtered by role, so a menu listed for one role may not appear for another.

## 2. Sign in

1. Open the application and go to the **Sign in** screen. If you are already on another page and signed out, the app returns you to sign in.
2. Enter the demo user ID from the table below. The screen calls this field “Email address or mobile number,” but the demo accounts use the IDs shown here.
3. Enter the demo password: `demo1@123`.
4. Select **Sign in**. The application opens the dashboard for that account’s role.
5. To leave the account, use the sign-out control in the application header.

| Demo ID | Role | Dashboard |
|---|---|---|
| `Demo1` | Sponsor Admin | Phasewise Dashboard |
| `Demo2` | Schoolnet Super Admin | Schoolnet Dashboard |
| `Demo3` | Schoolnet Project Admin | Schoolnet Dashboard |
| `Demo4` | State Admin | State Admin Dashboard |
| `Demo5` | School Admin | School Admin Dashboard |
| `Demo6` | Trainer | Trainer Dashboard |
| `Demo7` | Trainee | Trainee Dashboard |
| `Demo8` | Reporting/Audit User | Phasewise Dashboard |

The demo IDs and password are for demonstration only. The sign-in page also provides **Open registration** for users with a batch registration link and **Forgot your Trainee ID? Recover it with OTP** for trainee ID recovery. “Forgot password?” currently displays an informational message; it does not perform a password reset.

## 3. Dashboard screens by role

The diagrams below show the main screen areas and the purpose of each role’s dashboard. Actual figures and rows depend on the training data, assignments, and permissions available to the account.

### Sponsor Admin — Demo1

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: Dashboard / account controls            │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ Phasewise training overview                     │
│ MIS Reports     │ Progress, project phases, filters and summaries │
└─────────────────┴────────────────────────────────────────────────┘
```

Use this dashboard for an overall phasewise view. Sponsor Admin has Projects and MIS Reports in addition to Dashboard.

### Schoolnet Super Admin — Demo2

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: Schoolnet Dashboard                     │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ Cross-project training delivery and operations  │
│ Training Plans  │ Coverage / progress / delivery summaries        │
│ Batches         │ Filters and operational follow-up                │
│ Attendance      │                                                │
│ ...             │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

The Schoolnet dashboard monitors delivery across projects. Super Admin also has the Holiday Master menu for national and state holiday calendars.

### Schoolnet Project Admin — Demo3

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: Schoolnet Dashboard                     │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ Project-level training delivery overview        │
│ Training Plans  │ Progress / batches / attendance / follow-up      │
│ ...             │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

The dashboard is the Schoolnet operational view, with access scoped to the project work assigned to the account. This role does not have Holiday Master.

### State Admin — Demo4

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: State Admin Dashboard                   │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ State training coverage and outcomes            │
│ Training Plans  │ State → district → block → cluster → school     │
│ Batches         │ Drill-down, filters and interventions           │
│ Attendance      │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

Use the geographic drill-down and authorized state filter to review training status and follow-up needs at progressively smaller levels.

### School Admin — Demo5

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: School Admin Dashboard                  │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ School overview and training metrics            │
│ Training Plans  │ Schedule | attendance and learning status       │
│ Batches         │ Pending actions                                  │
│ Attendance      │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

The school view includes eligible teacher/student counts when a roster is configured, registered trainees, batches, attendance, assessments, certificates, training schedule, and pending actions. If the account has no assigned school, the dashboard explains that no school is linked.

### Trainer — Demo6

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: Trainer Dashboard                       │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ Assigned batches and upcoming sessions         │
│ Batches         │ Training delivery tasks and attendance status   │
│ Attendance      │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

Use the dashboard to see your assigned schedule and delivery tasks. Attendance is available for recording and reviewing attendance for a batch and training date.

### Trainee — Demo7

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: Trainee Dashboard                      │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ Your training, learning tasks and records       │
│ Training Plans  │ Progress / learning materials / milestones      │
│ Content Library │ Assessment and certificate information         │
└─────────────────┴────────────────────────────────────────────────┘
```

Use this personal dashboard to follow your training and learning records. The corresponding menus provide the project and plan context, learning resources, assessments, and certificates.

### Reporting/Audit User — Demo8

```text
┌─────────────────┬────────────────────────────────────────────────┐
│ Sidebar         │ Header: Dashboard                               │
│ Dashboard       ├────────────────────────────────────────────────┤
│ Projects        │ Phasewise overview                              │
│ MIS Reports     │ Read/review reports for audit and monitoring    │
└─────────────────┴────────────────────────────────────────────────┘
```

This role has a reporting-oriented menu: Dashboard, Projects, and MIS Reports.

## 4. Menu guide

| Menu | What it is for |
|---|---|
| **Dashboard** | Role-specific summary of training activity, progress, and follow-up items. |
| **Projects** | View and manage project information and phases, subject to role permissions. |
| **Training Plans** | View and maintain training plans and their learning structure. |
| **Batches** | Import, schedule, filter, and maintain project training batches. Batch filters include project, phase, state, district, school/UDISE, plan, trainer, and status. |
| **Attendance** | Select a project, batch, and training date, then record or review trainee attendance. Future training dates cannot be selected. |
| **Content Library** | Browse and open learning resources. Supported previews include common media and document formats supplied by the library. |
| **Assessments** | Access assessment-related learning information. This menu is present for Super Admin, Project Admin, and Trainee; the current app does not expose it as a standalone route. |
| **Certificates** | Access certificate-related information. This menu is present for Super Admin, Project Admin, and Trainee; the current app does not expose it as a standalone route. |
| **MIS Reports** | Open report pages: Batch Performance, Training Summary, Attendance Report, and Feedback Report. The first three have dedicated report routes; Feedback Report is a menu link in the current interface. |
| **Holiday Master** | Maintain national and state holidays used for training operations. Available to Schoolnet Super Admin. |
| **Trainer Repository** | Maintain trainer profiles and declared availability; profiles can include contact, competency, location, and availability details. |

### Registration support screens

Some operational screens are opened by direct navigation or links rather than a standard sidebar menu:

- **Registration Requests**: authorized operational roles can import trainees from an Excel template, control a batch’s registration window/capacity, and review, approve, reject, or withdraw requests.
- **Open Registration**: public/batch-link registration entry point.
- **Recover Trainee ID**: trainee ID recovery flow using OTP.

## 5. Menu availability by role

| Role | Menus shown |
|---|---|
| Sponsor Admin | Dashboard, Projects, MIS Reports |
| Schoolnet Super Admin | Dashboard, Projects, Training Plans, Batches, Attendance, Content Library, Assessments, Certificates, MIS Reports, Holiday Master, Trainer Repository |
| Schoolnet Project Admin | Dashboard, Projects, Training Plans, Batches, Attendance, Content Library, Assessments, Certificates, MIS Reports, Trainer Repository |
| State Admin | Dashboard, Projects, Training Plans, Batches, Attendance, MIS Reports, Trainer Repository |
| School Admin | Dashboard, Projects, Training Plans, Batches, Attendance, Content Library, Trainer Repository |
| Trainer | Dashboard, Projects, Batches, Attendance, Content Library, Trainer Repository |
| Trainee | Dashboard, Projects, Training Plans, Content Library, Assessments, Certificates |
| Reporting/Audit User | Dashboard, Projects, MIS Reports |

## 6. Useful notes

- If sign-in fails, check the demo ID and password and confirm the account is active.
- Empty charts, counts, and lists may mean that no matching data is available or that the account has no assignment for that area.
- Some dashboard data and demo accounts are stored in the browser. Use the same browser profile to see the same locally saved demo data.
- Use the sidebar menu to move between modules. On narrow screens, the sidebar can be collapsed and expanded.

---

**Document scope:** prepared from the project’s current interface and role/menu configuration. The screens and available actions may change as the application evolves.
