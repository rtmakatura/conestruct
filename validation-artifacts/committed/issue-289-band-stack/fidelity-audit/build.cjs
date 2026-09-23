// Assemble fidelity-audit.md: the hand-written head (method, headline,
// the extra-elements table), the measured delta table from analyze.cjs,
// and the fix plan + checkpoint.  Also a capture summary, so the doc
// states what it measured without the 1 MB JSON riding along.
const fs = require("fs");
const dir = __dirname;
const cap = JSON.parse(fs.readFileSync(dir + "/capture.json", "utf8"));
let summary = "\n## The captures\n\n| state | width | settled | text nodes | boxes | page height | horizontal overflow |\n|---|---|---|---|---|---|---|\n";
let texts = 0;
for (const [w, wd] of Object.entries(cap.widths))
  for (const [s, d] of Object.entries(wd.states)) {
    texts += d.texts.length;
    summary += `| ${s} | ${w} | ${d.settled} | ${d.texts.length} | ${d.boxes.length} | ${d.scrollH} px | ${d.scrollW > d.innerW ? `yes (${d.scrollW})` : "none"} |\n`;
  }
summary += `\nRun at ${cap.ranAt}. ${texts} text nodes in total. Body base in every capture: \`${cap.widths["1440"].states.S1.bodyFont}\`.\n`;
const head = fs.readFileSync(dir + "/head.md", "utf8").replace("1,221 text nodes", `${texts.toLocaleString("en-US")} text nodes`);
const deltas = fs.readFileSync(dir + "/deltas.md", "utf8");
const tail = fs.readFileSync(dir + "/tail.md", "utf8");
fs.writeFileSync(dir + "/fidelity-audit.md", head + summary + deltas + tail);
console.log("written", (head + summary + deltas + tail).length, "chars");
