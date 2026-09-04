# French UI coverage

Run `npm run i18n:coverage` to see translation progress for the ten dashboard modules in issue #15.

The report uses two intentionally simple signals:

- **Localized screens** counts `page.tsx` files that call `useTranslations()` or `getTranslations()`.
- **Catalog parity** verifies that each module has matching leaf keys in `messages/en.json` and `messages/fr.json`.

This is a file-level progress metric, not proof that every visible string on a screen is translated. A screen can still contain hardcoded copy while it is being migrated. Treat the report as a prioritization tool and use locale-switch QA to verify completed screens.

The current implementation prioritizes the persistent module navigation and primary landing screens, plus the launch-critical Payroll settings, employees, runs, filing documents, TVA declaration, and Tax periods workflows. Deeper detail, analytics, and specialist screens remain visible as untranslated in the report until they are migrated.
