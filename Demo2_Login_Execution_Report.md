# Demo2 Login Test Execution Report

## Run details

| Field | Value |
|---|---|
| Execution date | 2026-10-28 (Asia/Kolkata) |
| Application | ERNet Teacher / Student Training Tracker |
| Scope | Demo2 sign-in and immediate role/session behavior |
| Test case source | `Test_Cases.md`, login/session section |
| Environment | Local project; production build executed; browser UI unavailable in this session |
| Test type | Build verification and source inspection; no interactive browser execution |

## Summary

| Result | Count |
|---|---:|
| Passed | 1 |
| Failed | 0 |
| Not run / blocked | 4 |

The passing result is the production build only. Interactive login behavior was not exercised, so this report does not claim that a live Demo2 sign-in passed.

## Executed checks

| Run ID | Case | Result | Evidence |
|---|---|---|---|
| D2-001 | Production build | **PASS** | `npm run build` completed TypeScript compilation and Vite production bundling. Vite reported a large JavaScript chunk (~1,064.78 kB); this is a warning, not a build failure. |
| D2-002 | Demo2 authentication and destination (`LGN-010`) | **NOT RUN** | Browser UI automation was unavailable. Source inspection confirms `Demo2` is seeded active with role `schoolnet-super-admin`; successful sign-in should store the session and navigate to the app base route. This is not runtime evidence. |
| D2-003 | Demo2 session persistence after refresh (`LGN-011`) | **NOT RUN** | Requires interactive browser execution. Source stores the session in local storage and validates the user on lookup. |
| D2-004 | Demo2 permitted route access | **NOT RUN** | Requires interactive browser execution. Source role matrix grants Demo2 the super-admin routes, including Projects, Training Plans, Batches, Attendance, Content Library, Assessments, Certificates, MIS Reports, Holiday Master, and Trainer Repository. |
| D2-005 | Demo2 logout and protected-route behavior (`LGN-012`) | **NOT RUN** | Requires interactive browser execution. |

## Limitations

- The project has no `npm test` script or configured automated test framework.
- Browser UI checks could not be performed because no controllable browser tab was available in this session.
- Source inspection can describe expected behavior but cannot prove the browser completed login, rendered the correct dashboard, or persisted a session.
- No data was changed and no security assessment was performed.

## Overall assessment

The project builds successfully. Demo2 is configured in source as an active Schoolnet Super Admin, and the authentication code accepts the shared demo password. The requested end-to-end Demo2 login remains **unverified** until the login flow is run in a browser.

## References

- Test plan: [`Test_Cases.md`](./Test_Cases.md)
- Authentication and role definitions: [`src/auth.ts`](./src/auth.ts)
- Login screen: [`src/Login.tsx`](./src/Login.tsx)
