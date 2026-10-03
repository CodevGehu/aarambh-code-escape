# Verified game deployment

- Application commit: `de88139e2eb078b9bf50d1ca50a11d37afc62902`.
- Active repository: [CodevGehu/aarambh-code-escape](https://github.com/CodevGehu/aarambh-code-escape).
- Production: [Aarambh Code Escape](https://aarambh-code-escape.vercel.app).
- Immutable deployment: [de88139 release](https://aarambh-code-escape-7qslq20sz-codev4.vercel.app).
- Vercel deployment ID: `dpl_FGJpgGtDGPdML9J3ScrK7FM14kQY`, Ready, in the existing `codev4` project.
- [GitHub Actions run 37150707115](https://github.com/CodevGehu/aarambh-code-escape/actions/runs/37150707115): success.

The final CI run passed all **76 backend tests with zero skips**, the actual HTTP workflow's **88 assertions**, all **4 client tests**, the Vite build and both zero-vulnerability dependency audits. Its strict workflow JSON is also retained as a GitHub Actions artifact. Runtime packages exclude the development-only MongoDB test package.

The CLI deployment used an archive of the exact application commit plus the existing ignored Vercel project link. It excluded local environment files, rehearsal access codes, test databases and unrelated untracked legacy helpers.

After deployment, all **12 production HTTP checks passed**: homepage, organizer page, health and public event status are available; participant identity/questions/progress, organizer team/log listings, workbook export and event configuration reject unauthenticated access; an unknown API path returns 404. `production-smoke.json` records the outcomes and deployed commit.

The production game was already in the **ended** state and was preserved. This release did not start/reset the live competition, seed questions, deliver a test team, revoke a real registration or use real organizer credentials. The organizer must deliberately reset the existing ended event before starting a new run; no production gameplay lifecycle was exercised merely for verification.

The older [Abhishek-debug649/Treasure_Hunt](https://github.com/Abhishek-debug649/Treasure_Hunt) repository's `main` is pushed at `d96a3e4ab5f61e9a4c05100de9e39e17b3a0896a`. It remains a legacy source checkout and did not replace the active Code Escape deployment. Two unrelated bridge-edit helper files in that checkout remain untracked.
