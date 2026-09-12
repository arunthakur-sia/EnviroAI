import fs from "node:fs";
const f = "C:/npckms/DECISIONS.md";
let s = fs.readFileSync(f, "utf8");
const marker = "\n19. Ask NPC retrieves from the Statistics Hub as first-class sources: `retrieveIndicatorSources()`";
const i = s.lastIndexOf(marker);
const first = s.indexOf("19. Ask NPC retrieves");
if (i > 0 && i > first) {
  s = s.slice(0, i).trimEnd() + "\n";
  fs.writeFileSync(f, s);
  console.log("removed duplicate trailing item 19");
} else {
  console.log("nothing to remove", i, first);
}
