# GIGW 3.0 and WCAG 2.1 AA assessment

**Assessment date:** 30 October 2026  
**Scope:** Repository source review and production build; no assistive-technology or certified audit was performed.

## Result

The application is **not demonstrated to conform** to GIGW 3.0 or WCAG 2.1 Level AA. The repository contains a comprehensive implementation checklist, but its browser-local check marks are not audit evidence. This review found and corrected several accessibility issues; it does not establish conformance for every page, state, document, or user journey.

## Source changes in this assessment

- Added a keyboard-visible “Skip to main content” link on app routes. Routes whose main landmark did not have an ID now receive the target `main-content` ID.
- Darkened shared muted/secondary text colors used by the app and its MUI themes to improve contrast against the light surfaces used by those components.
- Made keyboard focus outlines darker and included text areas in the shared focus styling.
- Retained the checklist’s explicit notice that its progress is browser-local and does not establish certification.

These source changes are candidate remediations; contrast and keyboard behavior still need browser testing across all themes, components, routes, and responsive states.

## Findings that prevent a passing claim

| Area | Finding | Evidence needed to close |
| --- | --- | --- |
| WCAG 1.4.3 Contrast (Minimum) | Previously, `#71839a` on white measured about 3.88:1, below 4.5:1 for normal text. The shared muted color was darkened; many independent component colors and status colors still require a complete rendered contrast audit. | Automated and manual foreground/background review, including hover, focus, disabled, and status states. |
| WCAG 2.1 keyboard and screen-reader support | Source styles provide visible focus and this review adds a skip link. No full keyboard-only or screen-reader run was performed. | Keyboard-only testing and screen-reader checks on every major workflow, dialogs, tables, and validation errors. |
| Authentication and access control | `src/auth.ts` implements demo authentication in the browser and contains a shared demo password; role/session state is client-controlled. It is not suitable evidence of secure authentication or authorization for a production service. | Server-side identity, authorization enforcement, session protection, security testing, and documented operational controls. |
| Policy and contact content | The login links now open Privacy Policy and Consent Form pages, each marked “Coming soon.” Approved policy content, contact information, and feedback processes remain absent from the evidence reviewed. | Publish approved, accurate privacy/consent content, plus complete contact/feedback information. |
| GIGW hosting and certification | The configured public URL is on `github.io`. No eligible government domain ownership or STQC certification evidence is present in this repository. | Confirm the applicable ownership/domain rules with the sponsoring organization and provide required audit/certification evidence. |
| Full GIGW quality/security requirements | Many requirements depend on institutional ownership, governance, content review, downloadable-file processes, security operations, and evidence outside the frontend. | Map each applicable checklist item to an owner, evidence artifact, and review date; obtain the required security and quality approvals. |

## Verification performed

- Repository source inspection of shared layout, color tokens, authentication, and login links.
- Production build: `npm run build` passed after the login-page cleanup and skip-link target normalization (TypeScript plus Vite production bundle). Vite emitted a bundle-size advisory for the 1,132.61 kB main JavaScript chunk.
- No automated WCAG scanner, browser interaction audit, screen-reader audit, or STQC review has been performed as part of this assessment.

## Official references

- [Guidelines for Indian Government Websites (GIGW)](https://guidelines.india.gov.in/guidelines/)
- [GIGW 3.0 Manual (PDF)](https://cdnbbsr.s3waas.gov.in/s3c92a10324374fac681719d63979d00fe/uploads/2023/05/2023051731.pdf)
- [WCAG 2.1 Recommendation](https://www.w3.org/TR/WCAG21/)
- [STQC Website Quality Certification](https://www.stqc.gov.in/website-quality-certification-0)
