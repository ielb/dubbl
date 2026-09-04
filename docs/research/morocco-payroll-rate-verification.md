# Research: Verification of Moroccan payroll rates against primary sources

Scope: fact-check the CNSS/AMO/IR rates and brackets implemented in `lib/db/schema/payroll.ts`
(the `payrollSettings` CNSS/AMO/TFP columns) and `lib/db/seed-ma-payroll.ts` /
`lib/api/payroll-tax.ts` (`computeCnss`, `computeAmo`,
`computeMoroccanProfessionalExpenseDeduction`, `MA_DEPENDENT_ALLOWANCE_VALUE_CENTS`)
against primary Moroccan regulatory text. Those numbers were originally sourced from
"independent Moroccan payroll providers" (per the PR that introduced them) and had not been
checked against CNSS/DGI/Bulletin Officiel text before this doc. This is a fact-check only —
no code was changed.

Method: web search for primary sources, direct download + `pdftotext` extraction of the
actual government PDFs where reachable, and multi-source secondary corroboration where a
primary document could not be scraped (`cnss.ma` is a client-rendered SPA that returns a
generic FAQ shell for every deep link when fetched without a full browser session, and
`tax.gov.ma` serves a bot-interstitial "Session bloquée" page to non-browser HTTP clients).
All downloaded PDFs are primary or directly-cited-primary documents (Bulletin Officiel,
DGI note circulaire mirror, Ministry of Finance publication, consolidated CGI text) —
none of them are payroll-SaaS blogs restating unsourced numbers.

---

## 1. Is "Loi de Finances 2026 / Law 50-25" real, and does it cover this tax year?

**Verdict: MATCH.** Confirmed directly from the Bulletin Officiel.

Downloaded `https://www.sgg.gov.ma/BO/FR/2873/2025/BO_7465-bis_fr.pdf` (official Bulletin
Officiel site, `sgg.gov.ma` = Secrétariat Général du Gouvernement, the constitutionally
designated publisher of Morocco's official gazette). The PDF header reads:

> BULLETIN OFFICIEL — Nº 7465 bis — 25 joumada II 1447 (16-12-2025)
>
> « Dahir n° 1-25-67 du 19 joumada II 1447 (10 décembre 2025) portant promulgation de la loi
> de finances n° 50-25 pour l'année budgétaire 2026 »

This is the actual promulgation dahir and BO issue number for "Law 50-25" / "Loi de Finances
2026" — the codebase's citation is a real, correctly-identified law, published 16 December
2025, in force for budgetary/tax year 2026 (entered into force 1 January 2026 per its own
terms). The companion DGI explanatory document, "Note Circulaire n° 737 relative aux mesures
fiscales de la Loi de Finances n° 50-25 pour l'année budgétaire 2026," is also real (title
page confirmed, see §7) — the tax.gov.ma URL
`https://www.tax.gov.ma/wps/wcm/connect/e48c5c9d-ae80-4b30-a1b3-80af7ec09be1/NC+737+LF+2026.pdf`
exists and is cited by multiple independent Moroccan press outlets (Infomédiaire, Le Desk,
Médias24-adjacent sites), though it 403/interstitial-blocks non-browser fetches. Content was
obtained via a verbatim mirror hosted by L'Économiste (`leconomiste.com`), a mainstream
Moroccan financial newspaper that routinely republishes DGI circulars in full; the mirror's
page count (74) matches what secondary coverage reports for NC 737.

**Important caveat surfaced by this verification (see §6 and §9): not every number the
codebase attributes to "the 2026 schedule" actually originates in Law 50-25.** The IR
progressive-bracket table (§6) was set by the *previous* year's finance law (Loi de Finances
2025, Law 60-24) and merely continues unchanged into 2026; the professional-expense
deduction (§8) dates to Loi de Finances 2023 (Law 50-22). Law 50-25 itself only changed the
per-dependent deduction (§9) and a few unrelated items (CFC salaried-employee regime, CIMR
retiree pension exemption). This doesn't make the codebase's *numbers* wrong for tax year
2026 — nothing conflicting was enacted for 2026 — but the code comments overstate what Law
50-25 specifically did.

---

## 2. CNSS employee sub-rates (pension 3.96%, AMO 2.26%, CT 0.33%, IPE 0.19%, total 6.74%)

**Verdict: MATCH**, via consistent multi-source secondary corroboration (CNSS's own site
could not be scraped for a rate table — see method note above).

Five independent Moroccan payroll/HR-consulting sources, all dated 2026, agree exactly:

- Upsilon Consulting — <https://www.upsilon-consulting.com/cotisations-cnss-2026-taux-assiettes/> — cites legal basis "Dahir 1-72-184" (the 1972 dahir establishing the CNSS social-security regime) for the pension/CT branches and "Loi 65-00" (the AMO base-coverage code) for AMO.
- Sahl Compta — <https://sahlcompta.ma/blog/cnss-amo-maroc-2026> — same breakdown, same legal citations.
- ClicPaie.ma — <https://clicpaie.ma/blogs/les-cotisations-cnss-au-maroc/>
- Humantal — <https://humantal.ma/ressources/taux-cnss-2026>
- A separate query surfaced a source describing the same branches grouped differently
  ("prestations sociales court terme" 0.52% employee / 1.05% employer, "long terme" 3.96%
  employee / 7.93% employer) — 0.52% = 0.33% (CT) + 0.19% (IPE), and 1.05% = 0.67% (CT) +
  0.38% (IPE), which cross-checks the CT/IPE split used in the codebase against a
  differently-grouped independent figure.

Employee total 3.96 + 2.26 + 0.33 + 0.19 = 6.74% — arithmetic matches the codebase's
6.74% employee-side total exactly.

IPE's specific rate and legal basis (Loi n° 03-14, in force 1 December 2014, "première
assurance chômage au Maroc") is independently confirmed by L'Usine Nouvelle:
<https://www.usinenouvelle.com/article/l-indemnite-pour-perte-d-emploi-premiere-assurance-chomage-au-maroc-entre-en-vigueur-ce-1er-decembre.N300030>,
which states the employee/employer split is 0.19%/0.38% (0.57% combined), capped at the
CNSS ceiling.

---

## 3. CNSS employer sub-rates (AF 6.40%, pension 7.93%, AMO 4.11%, TFP 1.60%, CT 0.67%, IPE 0.38%, total 21.09%)

**Verdict: MATCH**, same sources as §2 (Upsilon, Sahl Compta, ClicPaie, Humantal all publish
this exact employer-side table for 2026). Employer total 6.40 + 7.93 + 4.11 + 1.60 + 0.67 +
0.38 = 21.09% — matches exactly. Combined with §2, total CNSS+AMO is 6.74% + 21.09% =
27.83% of gross, matching every source found, including CNSS-adjacent secondary coverage of
the CNSS "régime de sécurité sociale" overall cost.

---

## 4. The 6,000 MAD monthly ceiling and its scope (pension/CT/IPE only)

**Verdict: MATCH** — the 6,000 MAD/month ceiling is current as of today (2026), and its
scope (pension + CT + IPE only, i.e. the "long terme" + "court terme" branches) matches the
codebase's `cnssMonthlyCeilingCents` usage in `computeCnss` (only `pension`, `ct`, `ipe` go
through `cappedWageSlice`; `allocationsFamiliales`, `amo`, `tfp` are uncapped).

Every 2026-dated source checked states this explicitly, e.g. Upsilon Consulting: "Les
branches avec plafond (prestations sociales court et long terme) sont plafonnées à 6 000
MAD/mois, tandis que les allocations familiales, l'AMO et la taxe de formation
professionnelle s'appliquent sur la totalité du salaire sans plafond."

**Forward-looking risk, not a current error:** a CNSS ceiling increase from 6,000 to 8,000
MAD is under active discussion as part of Morocco's broader pension reform (government
reform project presented 12 May 2026; Parliament vote expected October 2026; proposed
effective date 1 January 2027 if adopted) — see La Vie Éco:
<https://www.lavieeco.com/affaires/cnss-le-salaire-plafond-pour-les-cotisations-passera-de-6-000-a-8-000-dh-19641/>
and OjraWeb: <https://blog.ojraweb.com/cotisations-cnss-le-plafond-a-8000-dirhams-se-precise/>.
This is a proposal under study by CNSS's Comité de gestion, not yet enacted — 6,000 MAD
remains correct for now, but this is a rate that could legitimately change again within the
next year and should be flagged for re-verification around Q4 2026 / Q1 2027, not treated as
permanently settled.

I was not able to reach an actual `cnss.ma` page reproducing the rate table directly (the
site returns a generic `/fr/faq` shell for every specific FAQ deep link when fetched
programmatically, including via a real browser session through Playwright — this looks like
client-side routing that depends on interaction state rather than a scrapable URL). This
section therefore rests on tier-2 (multi-source, legally-cited secondary) rather than
tier-1 confirmation, though the consistency across five independent sources plus the
absence of any contradicting figure anywhere in searches makes this a low-risk gap.

---

## 5. AMO uncapped status (both sides)

**Verdict: MATCH.** Every source in §2/§3 states AMO (2.26% employee / 4.11% employer, 6.37%
combined) applies to the full, uncapped gross salary — legal basis cited as "Loi 65-00" (the
2002 law instituting the AMO base health-coverage scheme). No source found suggests any
wage ceiling on AMO. This matches `computeAmo()` in `lib/api/payroll-tax.ts`, which applies
`employeeRateBp`/`employerRateBp` to the full `periodWage` with no ceiling parameter at all
(unlike `computeCnss`, which takes `monthlyCeilingCents`).

---

## 6. IR progressive brackets (0% to 40,000; 10% 40k–60k; 20% 60k–80k; 30% 80k–100k; 34% 100k–180k; 37% above 180k)

**Verdict: MATCH on the numbers — but the codebase's attribution of this table to "Loi de
Finances 2026 / Law 50-25" is incorrect.** This exact bracket table was set by **Loi de
Finances 2025 (Law 60-24)**, effective 1 January 2025, not by Law 50-25/LF2026.

Primary source: `https://www.finances.gov.ma/Publication/dgi/2024/synthetique-mesures-fiscaleslF2025.pdf`
— "NOTE SYNTHETIQUE DES MESURES FISCALES DE LA LOI DE FINANCES N° 60-24 POUR L'ANNEE
BUDGETAIRE 2025," hosted on the Ministry of Finance's own domain (`finances.gov.ma`), an
undisputed primary government source. It gives the exact before/after table:

| Tranches (avant LF2025) | Taux | Tranches (après LF2025, i.e. current) | Taux | Somme à déduire |
|---|---|---|---|---|
| 0 à 30 000 | 0% | **0 à 40 000** | **0%** | 0 |
| 30 001 à 50 000 | 10% | **40 001 à 60 000** | **10%** | 4 000 |
| 50 001 à 60 000 | 20% | **60 001 à 80 000** | **20%** | 10 000 |
| 60 001 à 80 000 | 30% | **80 001 à 100 000** | **30%** | 18 000 |
| 80 001 à 180 000 | 34% | **100 001 à 180 000** | **34%** | 22 000 |
| Au-delà de 180 000 | 38% | **Au-delà de 180 000** | **37%** | 27 400 |

The right-hand column (post-LF2025) is exactly the six brackets implemented in
`MA_IR_BRACKETS_2026` in `lib/db/seed-ma-payroll.ts` — 0/40k, 10%/60k, 20%/80k, 30%/100k,
34%/180k, 37%/above — confirmed bracket-for-bracket and rate-for-rate.

Confirmation that LF2026 did **not** touch this table again: NC 737 (the DGI's own 2026
circular, §1 above) explicitly frames its IR section as building on "la réforme adoptée en
2025 [qui] a permis de réduire la charge fiscale des salariés suite à la révision du barème
de cet impôt" (i.e., referring back to the 2025 reform as already-done), and its own list of
2026 IR measures (§7 below) is limited to the per-dependent deduction, a CIMR
retiree-pension exemption, and the CFC salaried-employee regime — Article 73-I (the
progressive barème itself) does not appear among the articles LF2026 amended. Also directly
confirmed in the Bulletin Officiel text (`bo7465bis.txt`): the only "Article 73" amendment
present is "Article 73. – II. – Taux spécifiques" (a different paragraph, covering CFC and
other flat rates), not paragraph I (the salary barème).

Net effect: the numbers implemented are correct **for tax year 2026** (the 2025 brackets
remain in force, unchanged), but the code comment "2026 schedule (Loi de Finances 2026 / Law
50-25 ... note circulaire n°737)" should more accurately read "in force for 2026; brackets
set by Loi de Finances 2025 (Law 60-24), continued unchanged by LF2026."

---

## 7. NC 737 exists and covers what the codebase implies it covers

**Verdict: MATCH for what it does cover (per-dependent deduction, §9); the barème (§6) and
professional-expense deduction (§8) are NOT covered by NC 737** — see above. Title page of
the mirrored document (verbatim, `leconomiste.com` PDF):

> NOTE CIRCULAIRE N° 737 RELATIVE AUX MESURES FISCALES DE LA LOI DE FINANCES N° 50-25 POUR
> L'ANNEE BUDGETAIRE 2026

Its table of contents (§ "II- MESURES SPECIFIQUES A L'IMPOT SUR LE REVENU") lists exactly
four IR measures for 2026: (1) per-dependent deduction increase, (2) CIMR
retiree-complementary-pension exemption, (3) CFC salaried-employee regime revision, (4) a
50% abattement on definitive cessation of activity for certain professionals. The barème and
professional-expense deduction are not among them, consistent with §6/§8's findings that
those predate LF2026.

---

## 8. Professional-expense deduction — 35% below 78,000 MAD, 25% above, capped at 35,000 MAD/year

**Verdict: NUMBERS MATCH (rate values, threshold, cap) but the CALCULATION METHOD
implemented is WRONG — this is a real bug, not just a sourcing nuance.**

### 8a. The rate/threshold/cap figures themselves: MATCH, sourced to LF2023 (Law 50-22)

Primary text — Article 59-I of the Code Général des Impôts, extracted directly from a
765-page consolidated CGI PDF (`https://casainvest.ma/sites/default/files/2026-02/Code%20impo%CC%82ts%202026.pdf`,
a mirror hosted by Casablanca-Settat's regional investment center, but reproducing the CGI
text with inline footnotes citing the exact amending finance-law article for each clause —
tier-2 but strongly primary-adjacent):

> A.- 35% pour les personnes ne relevant pas des catégories professionnelles visées aux B et
> C ci-après, dont le revenu brut annuel imposable n'excède pas soixante dix huit mille
> (78 000) dirhams. Ce taux est fixé à 25% pour les personnes dont le revenu brut annuel
> imposable est supérieur à soixante dix huit mille (78 000) dirhams, sans que cette
> déduction puisse excéder trente-cinq mille (35 000) dirhams.
>
> — footnotes: "Article 6 de la loi de finances n° 50-22 pour l'année budgétaire 2023"

So 35%, 25%, 78,000 MAD, and the 35,000 MAD cap are all correct and current, but they
originate in **Loi de Finances 2023 (Law 50-22)**, not LF2026 — another case (like §6) of a
correct-for-2026 number being attributed by the code comments to the wrong finance law.
Confirmed independently by a secondary source with an explicit before/after table:
<https://www.cielmaroc.ma/actualites/loi-de-finances-2023-revision-du-taux-dabattement-des-frais-professionnels-pour-les-titulaires-des-revenus-salariaux-article-59-i-a-et-b-du-cgi>
("Loi de Finances 2023 : Révision du taux d'abattement des frais professionnels... Article
59-I-A et B du CGI" — previous rate was a flat 20% for both bands; LF2023 introduced the
35%/25% split and raised the cap from 30,000 to 35,000 MAD).

### 8b. The calculation method implemented in `computeMoroccanProfessionalExpenseDeduction`: CONTRADICTS the law

`lib/api/payroll-tax.ts` computes this as a **marginal/tiered** deduction — 35% of the
portion of gross up to 78,000 MAD, *plus* 25% of the portion above 78,000 MAD, then caps the
sum at 35,000 MAD:

```ts
const belowThreshold = Math.min(gross, MA_PROFESSIONAL_EXPENSE_THRESHOLD_CENTS);
const aboveThreshold = Math.max(0, gross - MA_PROFESSIONAL_EXPENSE_THRESHOLD_CENTS);
const deduction =
  Math.round((belowThreshold * MA_PROFESSIONAL_EXPENSE_RATE_BELOW_BP) / 10000) +
  Math.round((aboveThreshold * MA_PROFESSIONAL_EXPENSE_RATE_ABOVE_BP) / 10000);
return Math.min(deduction, MA_PROFESSIONAL_EXPENSE_CAP_CENTS);
```

But the actual Article 59-I-A text quoted above is a **threshold/cliff rule, not a marginal
one**: it says the rate is 35% *for persons whose annual gross taxable income does not
exceed 78,000 MAD* and 25% *for persons whose income is above 78,000 MAD* — i.e. one flat
rate applied to the **entire** income, chosen by which side of 78,000 MAD the person's total
income falls on, not "35% of the first 78,000 plus 25% of the rest."

This was independently confirmed by a Moroccan payroll-calculation walkthrough
(ClicPaie, <https://clicpaie.ma/blogs/frais-professionnels-maroc-2026/>) with two explicit
worked examples:

- Annual gross 100,000 MAD (> 78,000 → 25% band): deduction = 100,000 × 25% = **25,000 MAD**
  (not 78,000×35% + 22,000×25% = 32,800 MAD, which is what the codebase's formula would
  produce).
- Annual gross 150,000 MAD: 150,000 × 25% = 37,500 MAD, capped at the 35,000 MAD ceiling →
  **35,000 MAD**.

Concretely, for a 100,000 MAD/year salary the codebase currently computes a deduction of
32,800 MAD (via `belowThreshold*35% + aboveThreshold*25%`), when the law — as read literally,
and as every payroll calculator checked implements it — allows only 25,000 MAD. That
overstates the deduction by 7,800 MAD/year for this example, which understates taxable
income and understates the IR withheld. The error only appears for employees whose annual
gross exceeds 78,000 MAD (~6,500 MAD/month, a very ordinary salary level in Morocco), so this
is not an edge case — it affects a large share of the salaried population this feature is
meant to serve.

Note the odd but real "cliff" this produces under the correct law: someone earning exactly
78,000 MAD gets a 27,300 MAD deduction (35% × 78,000); someone earning 78,001 MAD gets only
19,500.25 MAD (25% × 78,001) before the cap consideration — a discontinuous drop right at the
threshold. This is unusual tax design but is what the primary text and every secondary
source checked describe; it is not a transcription artifact.

**This is the one item in this verification that needs a code fix, not just a comment
fix — see §10.**

---

## 9. Per-dependent deduction: 600 MAD/person/year, capped at 6 dependents (3,600 MAD/year)

**Verdict: MATCH, and this is the one figure in the IR section that genuinely does originate
in Law 50-25 / LF2026, confirmed by TWO primary documents.**

1. **Bulletin Officiel n° 7465 bis** (`bo7465bis.pdf`, official gazette text of the law
   itself, §1 above), the actual amending text of Article 74-I of the CGI:

   > « Article 74. – I. – Il est déduit ........................ une somme de six cents
   > (600) dirhams par personne ........................ article. « Toutefois
   > ....................................... dépasser trois mille six cents (3600) dirhams. »

2. **NC 737** (the DGI's own explanatory circular on the same law), which spells out the
   before/after in full prose:

   > Dans le cadre des mesures sociales visant à réduire la charge fiscale sur les
   > contribuables, la LF 2026 a modifié les dispositions de l'article 74-I du CGI, en vue
   > d'augmenter le montant annuel de la réduction de l'impôt sur le revenu pour les charges
   > de famille, **de 500 à 600 dirhams par personne à charge du contribuable**. Le plafond
   > de cette réduction a également été relevé **de 3000 à 3600 dirhams, en maintenant ainsi
   > l'avantage de ladite réduction pour six (6) personnes à charge du contribuable**.
   >
   > Date d'effet : ... les dispositions de l'article 74-I du CGI sont applicables aux
   > revenus acquis à compter du 1er janvier 2026.

This exactly matches `MA_DEPENDENT_ALLOWANCE_VALUE_CENTS = 60000` (600 MAD) and the
codebase's comment "up to 6 dependents (i.e. max 3,600 MAD/year)" in the task description —
600 × 6 = 3,600, and NC 737 explicitly confirms the cap was set to preserve the 6-dependent
ceiling when the per-person amount rose. Also cross-confirmed by the historical progression
in the finances.gov.ma LF2025 synthesis (§6): 360 MAD/person (pre-2025) → 500 MAD/person
(LF2025) → 600 MAD/person (LF2026, current) — a consistent, sourced chain rather than an
isolated number.

Effective date confirmed as 1 January 2026 by NC 737 directly, so this applies to the full
2026 tax year, matching `MA_IR_TAX_YEAR = 2026` in `seed-ma-payroll.ts`.

---

## 10. Overall verdict

**Not fully safe to run real payroll on as-is.** One concrete calculation bug needs fixing
before this should process real Moroccan paychecks; everything else checks out numerically,
with two sourcing/comment corrections recommended for maintainability but no other
functional changes needed.

### Needs to change (functional bug)

- **`computeMoroccanProfessionalExpenseDeduction` in `lib/api/payroll-tax.ts` implements
  the wrong formula.** It currently computes a marginal/tiered deduction (35% of income up
  to 78,000 MAD + 25% of the excess). Article 59-I-A of the CGI (confirmed via the
  consolidated code text and independently via a worked ClicPaie example, §8) requires a
  threshold/cliff rule instead: apply 35% to the *entire* annual gross if it is ≤ 78,000
  MAD, or apply 25% to the *entire* annual gross if it is > 78,000 MAD, then cap the result
  at 35,000 MAD. The current implementation overstates the deduction (and understates IR
  withheld) for every employee earning more than 78,000 MAD/year — a materially common case,
  not an edge case. This should be fixed before Moroccan payroll is used for real
  withholding.

### No numeric change needed, but code comments overstate the LF2026 attribution

- The IR bracket table (`MA_IR_BRACKETS_2026`, §6) is numerically correct for 2026 but was
  actually set by **Loi de Finances 2025 (Law 60-24)**, not Law 50-25/LF2026. Recommend
  updating the comment in `lib/db/seed-ma-payroll.ts` to cite LF2025/Law 60-24 as the source
  of the bracket table, and LF2026/Law 50-25/NC 737 only for the per-dependent deduction.
- The professional-expense deduction's rate/threshold/cap values (35%/25%/78k/35k, §8) are
  numerically correct but date to **Loi de Finances 2023 (Law 50-22)**, not LF2026. No code
  comment currently misattributes this specifically, but if one is added when fixing the
  bug above, it should cite LF2023/Law 50-22.

### Confirmed correct, no action needed

- CNSS employee sub-rates (pension 3.96%, AMO 2.26%, CT 0.33%, IPE 0.19%, total 6.74%) — §2.
- CNSS employer sub-rates (allocations familiales 6.40%, pension 7.93%, AMO 4.11%, TFP
  1.60%, CT 0.67%, IPE 0.38%, total 21.09%) — §3.
- The 6,000 MAD/month ceiling and its scope (pension/CT/IPE only; AMO, allocations
  familiales, and TFP uncapped) — §4, §5.
- All six IR bracket thresholds and rates (0%/40k, 10%/60k, 20%/80k, 30%/100k, 34%/180k,
  37%/above) — §6.
- Per-dependent deduction: 600 MAD/person/year, capped at 3,600 MAD (6 dependents) — §9.
- "Loi de Finances 2026 / Law 50-25" and "note circulaire n° 737" are both real, correctly
  identified, and cover tax year 2026 — §1, §7.

### Open questions / gaps for a future pass

- Could not directly scrape `cnss.ma`'s own rate-table page (client-rendered SPA; every
  deep-linked FAQ URL, fetched both via `curl` and via a real Playwright browser session,
  redirects to a generic `/fr/faq` shell rather than rendering the specific answer). CNSS
  sub-rates (§2/§3) rest on 5-way independent secondary corroboration rather than a
  first-party CNSS page. Someone with interactive browser access to `cnss.ma`, or a Moroccan
  CNSS "guide de l'employeur" PDF (CNSS publishes one periodically), could close this gap.
- Could not directly download the actual `tax.gov.ma`-hosted NC 737 PDF (bot-blocked); relied
  on a verbatim newspaper mirror (L'Économiste) instead. The content is consistent with every
  other secondary description of NC 737 found and its title page/TOC match what's publicly
  reported about it, so this is treated as reliable, but it is technically once-removed from
  the DGI's own server.
- The CNSS monthly ceiling (6,000 MAD) is under active review for a possible increase to
  8,000 MAD as part of a broader pension reform moving through Parliament in late 2026,
  targeted for 1 January 2027 if adopted (§4). This isn't a current error but is a rate that
  should be re-checked in Q4 2026/Q1 2027 rather than assumed permanently settled.
- Did not verify the CT/PSCT/PSLT branch names or CNSS's own official terminology
  character-for-character against a CNSS-published document (only against secondary sources
  that themselves cite Dahir 1-72-184 and Loi 65-00) — low risk given five-way agreement, but
  not tier-1 confirmed.
