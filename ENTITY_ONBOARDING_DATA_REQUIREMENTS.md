# Entity Onboarding: Data We Need From You

Written for: the focal point at an entity (ministry, authority, centre, company) that wants to connect to EnviroAI.

This is the checklist of organisation data we need to set up your entity. Each item says what we need, why, the format we accept and whether it blocks go-live. Field names match the platform's data model, so what you send loads without reshaping.

## How to read this

| Tag | Meaning |
|---|---|
| **Required** | We cannot go live without it. |
| **Recommended** | The platform works without it, but the module stays empty or weak. |
| **Optional** | Adds depth. Send it when you have it. |

**Rules that apply to everything below**

1. **Bilingual.** Every name, title, description and mandate is needed in English and Arabic. If only one language exists, say so. We can machine-translate, but the record is then flagged as machine-translated in the interface.
2. **Classification.** Tag every document, indicator and expert with a classification level (see section 10). Anything untagged defaults to the level you choose in section 1.
3. **Provenance.** For every document, indicator value and fact, give the source (publisher, year, link or file reference). Unsourced figures are shown as unverified.
4. **Formats.** Structured data as `.xlsx` or `.csv` (UTF-8). Documents as `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.md` or `.txt`. Scanned PDFs are accepted and processed with OCR, but text PDFs give better search and citation quality.
5. **One owner per item.** Every record needs a named owner on your side who can answer questions about it.

---

## 1. Entity profile (Required)

| Field | Detail |
|---|---|
| Name (EN / AR) | Full legal name |
| Short name (EN / AR) | Acronym used day to day, e.g. MEWA, NCEC |
| Kind | `ministry`, `agency`, `authority`, `company`, `international` or `other` |
| Logo | SVG preferred, otherwise PNG with transparent background. Both full-colour and white versions |
| Website | Official URL |
| Primary contact | Name, title, email, phone |
| Technical contact | The person who handles access, SSO and data transfers |
| Data owner / sponsor | Executive who approves what we load |
| Default classification | The level applied to untagged content |
| Brand colours | Primary and accent hex codes, if you want the tenant themed |
| Preferred language and numerals | `en` or `ar`; Western or Arabic-Indic digits |

## 2. Organisation structure (Required)

One row per unit. Parents must appear before children.

| Field | Detail |
|---|---|
| Unit code | Short unique code |
| Name (EN / AR) | |
| Level | `secretary_general`, `sector`, `office`, `department` or `section` |
| Parent unit code | Blank for the top unit |
| Head | Name, title (EN / AR) and email. Tell us if the head is not a platform user |
| Description (EN / AR) | One paragraph |
| Mandate (EN / AR) | Official mandate text and the public source URL, if any |
| Responsibilities (EN / AR) | Bullet list |
| Key projects | Short note |
| Active | Yes or no (retired units are kept for history) |

Also send the current organisation chart (PDF or image) so we can check the import against it.

## 3. People and access (Required)

One row per person who will use the platform.

| Field | Detail |
|---|---|
| Work email | Must match your allowed sign-up domain |
| Name (EN / AR) | |
| Position (EN / AR) | |
| Unit code | |
| Role | `Super Admin`, `Knowledge Admin`, `Department Head`, `Expert Verifier`, `Contributor`, `Reader` or `HR Admin`. Tell us if you need a custom role |
| Clearance level | Highest classification the person may open |
| Department scope | `all` or a list of unit codes |
| Unit membership | `head`, `deputy` or `member`, with start date |
| Delegate | Delegate user and dates, for leave cover |

We do not need passwords. Accounts are created by invitation, or through your identity provider if you want SSO (section 12).

**Decisions we need from you:** who the Super Admin is, who may export data, and which roles may see HR Knowledge. HR risk data is sensitive and is restricted to the HR Admin role.

## 4. Strategy and performance (Required if you want the Strategy Hub)

| Item | Detail |
|---|---|
| Strategy edition | Code, name (EN / AR), period from and to, status (`live`, `draft`, `archived`), summary, source document |
| Strategy tree | Every node: type (pillar, objective, initiative, project, etc.), code, title and description (EN / AR), parent, owner, status, start and end dates, budget, funding source |
| Alignment | Links to national frameworks, e.g. Vision 2030 and the National Environment Strategy |
| Owner and leads | Owning person or external entity per node |
| Stakeholders | Entities involved per node, and their role |
| Dependencies | Which nodes depend on which |
| Lineage | Which node replaced or evolved from which, if editions changed |
| KPIs | Per node: name (EN / AR), unit, direction (`up_good` or `down_good`), baseline value and year, target value and year, frequency, methodology, owner |
| KPI actuals | Per KPI and period: actual value, target for the period, source |
| Status updates | Latest narrative status per node, with author and date |

Budget currency: tell us which currency your figures use.

## 5. Statistics and indicators (Required for Data and Insights)

**Indicator catalogue** (one row per indicator):

| Field | Detail |
|---|---|
| Code | Unique, stable |
| Name and definition (EN / AR) | |
| Unit and decimals | |
| Frequency | Monthly, quarterly, annual, etc. |
| Direction | `up_good` or `down_good` |
| Category | Water, agriculture, climate, etc. |
| Owning unit | |
| Source and methodology (EN / AR) | Publisher, how it is calculated |
| Classification | |
| Headline | Mark the indicators for the home scorecard |
| Publish calendar | Expected release dates |
| Dimensions | Breakdowns such as region, sector or gender, and their allowed values |

**Indicator values** (one row per value): indicator code, period, value, dimension key (`total` when none), status (`final`, `provisional`, `estimate`), source document, note.

**Releases:** title (EN / AR), release date, indicators covered, linked document, summary.

Excel files with a header row are fine. We map columns with you, and a dry run reports rows imported and rejected before anything is committed.

## 6. Documents and knowledge (Required: at least a starter set)

Send the reports, strategies, policies, procedures, studies and decks that the platform should be able to search and cite.

For each file give:

| Field | Detail |
|---|---|
| File | The original |
| Title (EN / AR) | If missing, we generate one and flag it |
| Knowledge type | Report, strategy, policy, procedure, study, minutes, lesson, etc. |
| Owner and owning unit | |
| Original language | `en` or `ar` |
| Publish year | |
| Classification | |
| Visibility | `all_staff`, or an allow-list of units or people |
| Status | `draft`, `in_review` or `published` |
| Version label and effective date | For policies and procedures |
| Review cycle (months) | So review reminders can be scheduled |
| Supersedes | The document this one replaces |
| Verified by and date | If someone has already vetted it |

A spreadsheet manifest with one row per file is the easiest way to send this. Please send the final version only, not working drafts, unless the draft is the only version.

**Do not send** personal data, contracts with named individuals or anything you are not cleared to share with the platform's users.

## 7. Regulatory data (Recommended)

| Item | Detail |
|---|---|
| Regulators | Name (EN / AR), mandate, website |
| Regulations | Title (EN / AR), issuing regulator, reference number, issue and effective dates, status (in force, draft, repealed), scope, official source URL, the full text or a link |
| Timeline events | Key dates: issued, amended, repealed, upcoming compliance deadlines |
| Obligations | Who must comply, with what, by when, and the penalty if any |

## 8. People as knowledge: experts (Recommended)

For each expert, internal or external:

| Field | Detail |
|---|---|
| Name and position (EN / AR) | |
| Organisation (EN / AR) | |
| Type | `org_employee` or external |
| Country | ISO code, for external experts |
| Bio (EN / AR) | |
| Contact | Email, phone, preferred contact protocol |
| Languages | |
| Years of experience | |
| Education and certifications | |
| Domains and skills | From your taxonomy |
| Engagements and publications | Title, year, link |
| Availability | `available`, `limited` or `unavailable` |
| Visibility | Classification of the profile |
| Consent | Confirmation that the person agrees to be listed |

External experts must have consented to being listed. We do not publish contact details without it.

## 9. Lessons, decisions and institutional memory (Optional, high value)

| Item | Detail |
|---|---|
| Lessons learned | Title, context, what happened, root cause, what to do differently, project or programme, date, owner |
| Decisions | Decision, date, decision-maker, rationale, alternatives considered, linked documents |
| Process maps | Process name, owner, steps, inputs and outputs, systems used |
| Operating model | Roles, committees, governance forums, meeting cadence |
| Handover notes | For people leaving or rotating: responsibilities, key contacts, open items, where files live |
| Frequently asked questions | Common questions and their approved answers |

## 10. Classification and taxonomy (Required)

| Item | Detail |
|---|---|
| Classification scheme | Your levels, number and name (EN / AR), and the meaning of each. The default scheme is public, internal, confidential and restricted; send yours if it differs |
| Handling rules | Which levels may be summarised by AI, exported or shown in search snippets |
| Taxonomy | Your controlled vocabulary: topics, sectors, themes, knowledge types. Terms in EN / AR, with parent terms |
| Glossary | Acronyms and domain terms with definitions, so search and the analyst read your language correctly |

## 11. External sources to track (Optional)

| Item | Detail |
|---|---|
| Source list | Publisher, title, URL, data type, update frequency, licence |
| International indices | Which indices, peer countries and peer groups matter to you |
| Signals to watch | Topics, keywords and entities for the horizon-scanning feed |

We link to public sources. We do not copy their data unless the licence allows it.

## 12. Technical and security (Required)

| Item | Detail |
|---|---|
| Identity provider | Entra ID, Okta, Google or other. Metadata URL if you want SSO |
| Email domain | Allowed sign-up domain(s) |
| Hosting and residency | Where data must live. State any in-Kingdom requirement |
| Network | IP allow-lists, proxy rules, firewall changes needed to reach the platform |
| Data transfer method | Secure upload, SFTP, shared drive or API. Name the system if you want a recurring sync |
| Data refresh | How often each dataset changes, and who sends the update |
| AI use | Whether AI analysis is permitted on your data, and for which classification levels. If a Claude or other external model API is used, we need your approval of that data flow |
| Retention | How long records and audit logs must be kept |
| Compliance | Frameworks you must satisfy, e.g. NCA controls, PDPL |
| Security review | Contact for your security team and the form they require |
| Backup and recovery | Recovery expectations |

## 13. Governance and contacts (Required)

| Item | Detail |
|---|---|
| Executive sponsor | Name and title |
| Day-to-day lead | Name and title |
| Data stewards | One per unit that supplies data |
| Verification route | Who approves content before it shows as verified |
| Escalation contact | For incidents and data errors |
| Support hours and language | |

---

## Delivery plan

| Phase | You send | Sections |
|---|---|---|
| 1. Setup | Entity profile, structure, users, classification, security answers | 1, 2, 3, 10, 12, 13 |
| 2. Core content | Strategy, indicators, starter documents | 4, 5, 6 |
| 3. Enrichment | Regulatory, experts, lessons, sources | 7, 8, 9, 11 |
| 4. Steady state | Scheduled refreshes and new documents | 5, 6 |

## Quality bar before we load

- Every row has an English and an Arabic name, or is marked as single-language.
- Codes are unique and never reused.
- Dates are ISO format (`2026-03-31`) and periods are explicit (`2025`, `2025-Q3`, `2025-09`).
- Numbers carry no thousands separators or text units in the value cell. Put the unit in the unit column.
- No password, token or personal identity number appears in any file.
- Every file has a named owner and a classification.

## Templates

Ask us for the spreadsheet templates for sections 2, 3, 4, 5, 6 and 8. Each has the exact column headers, a worked example row and a validation sheet that flags missing or malformed values before you send it.
