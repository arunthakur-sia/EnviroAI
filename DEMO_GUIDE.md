# EnviroAI: demo script

A twenty-five minute path through the product for a Programme Office working on the Saudi environment, water and agriculture agenda. Everything runs locally except the optional AI keys. Content marked Illustrative is a placeholder; say so when you reach it.

## Before the session

```bash
npm run setup                 # fresh clone only
npm run reset-demo:snapshot   # freeze the baseline
npm run start:demo            # production build with the job worker
```

Open `http://localhost:3000` at 1440 by 900 and sign in as the Super Admin account (see the README for seeded accounts). If anything goes sideways, stop the server, run `npm run reset-demo`, start again.

## The path

1. **Home (3 min).** Land on the Scorecard. Show Knowledge of the Week, then the indicator tiles, which count up from seeded values. Hover a card to light the related threads.
2. **Ask EnviroAI (4 min).** Press Ctrl+K. Ask a question about the National Environment Strategy or a water or agriculture indicator. Watch the tool chips, then the cited answer and workspace. Close with Escape, move to another page, reopen: the thread persists. Open any item and use "Ask about this" to scope the question.
3. **Regulatory Overview (4 min).** Open `/regulatory`. Walk the regulators (MEWA, NCEC, NCW, NCVC, MWAN, the Environment Fund) and what each instrument means operationally for a compliance team. State plainly which entries are Illustrative.
4. **Source Library (3 min).** Open `/sources`. Filter the catalogue of public data sources by publisher and theme. Make the point that it points to sources and does not copy their data.
5. **Statistics and International Indices (3 min).** Open an indicator page: chart, narration, CSV export. Then the Indices board, with Saudi Arabia against the GCC.
6. **Trends and Signals (2 min).** Show the Signals Radar and accept one signal. Without an API key the scan uses fixtures, flagged by the AI mock chip.
7. **Institutional Memory (3 min).** Open a document in the reader: Intelligence panel, Ask about this document, Brief me.
8. **Reports (3 min).** Use Extract report from any page, pick an audience, generate the Word document, and show the Sia logo and ascent-line layout in English and Arabic.
9. **A restricted account (1 min).** Sign in as the Reader and show what it cannot see.

## If someone asks

- **Is the data real?** Public institutions and source names are real. Seeded figures and documents are demo content unless they carry a source link, and Illustrative items are placeholders.
- **Does it need an API key?** No. AI Mock Mode answers from retrieved content with real citations. A key turns on live answers and scanning.
- **Arabic?** Every screen works in Arabic with full RTL. Switch language from the top bar.
- **Where does the data live?** One SQLite file and a data folder. See the README for the Railway deployment.
