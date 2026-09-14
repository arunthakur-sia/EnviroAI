// Spot-check the stored forecasts.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const rows = await q(
  `select i.code, f.horizon_years, f.central_rank, f.central_score, f.low, f.high, f.direction
   from index_forecasts f join indices i on i.id = f.index_id
   where f.status = 'current' order by i.code, f.horizon_years`
);
for (const r of rows) {
  console.log(
    `${r.code.padEnd(5)} +${r.horizon_years}y rank=${r.central_rank == null ? "-" : Math.round(r.central_rank)} score=${
      r.central_score == null ? "-" : Number(r.central_score).toFixed(3)
    } range=[${Number(r.low).toFixed(2)}, ${Number(r.high).toFixed(2)}] dir=${r.direction}`
  );
}
const exp = await q(
  `select i.code, substr(f.explanation_en, 1, 130) e from index_forecasts f join indices i on i.id=f.index_id where f.status='current' and f.horizon_years=3 and i.code in ('hdi','gpi','imd')`
);
for (const r of exp) console.log(`\n${r.code}: ${r.e}...`);
db.close();
