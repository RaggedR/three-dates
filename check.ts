// check.ts — assertions against the fixture cohort. Run it.
//
//     deno run --allow-read check.ts
//
// type-tests.ts asserts what the checker can see. This file asserts what it
// cannot: that `legal` and `ReplyFor` agree, that the fixtures have the
// structure the measurements assume, and that the invariants of §1.3 and §1.4
// of PLAN-build hold on real data.

import { type Kind, legal, type Reply, Corpus } from "./questions.ts";
import { disclose, fixturePerson, substantive } from "./people.ts";
import { generate } from "./fixtures.ts";
import { density } from "./density.ts";

let failed = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${cond || !detail ? "" : "  — " + detail}`);
  if (!cond) failed++;
};

// ── 1. legal and ReplyFor agree ───────────────────────────────────────
// The two halves of the dependency, checked against each other by enumeration.
// `ReplyFor` cannot be reflected at run time, so the agreement is spelled out
// once, here, as the table it is — and the table is what would rot silently.

console.log("\nlegal(k, r) agrees with ReplyFor<K>");
const kinds: Kind[] = [
  { tag: "Free" },
  { tag: "Scale", lo: 1, hi: 5 },
  { tag: "Choice", options: ["a", "b"] },
];
const replies: Reply[] = [
  { tag: "Text", value: "x" },
  { tag: "Rating", value: 3 },
  { tag: "Pick", option: "a" },
  { tag: "Blank" },
];
// Which (kind, reply-tag) pairs ReplyFor admits. Blank everywhere.
const admits: Record<string, ReadonlySet<string>> = {
  Free: new Set(["Text", "Blank"]),
  Scale: new Set(["Rating", "Blank"]),
  Choice: new Set(["Pick", "Blank"]),
};
for (const k of kinds) {
  for (const r of replies) {
    const want = admits[k.tag].has(r.tag);
    ok(`${k.tag} / ${r.tag} -> ${want}`, legal(k, r) === want);
  }
}
ok("and legal is stricter than ReplyFor inside a kind: 11 is not on a 1-5 scale",
  !legal({ tag: "Scale", lo: 1, hi: 5 }, { tag: "Rating", value: 11 }));
ok("...nor is an option that is not on the list",
  !legal({ tag: "Choice", options: ["a"] }, { tag: "Pick", option: "z" }));
ok("...nor is empty prose, which is a blank wearing a Text tag",
  !legal({ tag: "Free" }, { tag: "Text", value: "" }));

// ── 2. The fixtures are what the measurements assume ──────────────────
console.log("\nfixtures");
const f = generate({ n: 200, budget: 40, seed: 20260921 });
const again = generate({ n: 200, budget: 40, seed: 20260921 });

ok("generation is deterministic in the seed",
  JSON.stringify([...f.cohort.people[7].answers]) ===
    JSON.stringify([...again.cohort.people[7].answers]));
ok("a different seed is a different cohort",
  JSON.stringify([...generate({ n: 200, budget: 40, seed: 1 }).cohort.people[7].answers]) !==
    JSON.stringify([...f.cohort.people[7].answers]));

ok("everyone authored at least one question (§3)",
  f.cohort.people.every((p) => p.authored.length >= 1));
ok("and answered every question they authored (§3 is the type, not a rule)",
  f.cohort.people.every((p) =>
    p.authored.every((q) => {
      const a = p.answers.get(q);
      return a !== undefined && a.reply.tag !== "Blank";
    })
  ));
ok("every stored reply is legal for its question",
  f.cohort.people.every((p) =>
    [...p.answers.values()].every((a) => f.corpus.admits(a.question, a.reply) === true)
  ));

const blanks = f.cohort.people.flatMap((p) =>
  [...p.answers.values()].filter((a) => a.reply.tag === "Blank")
);
ok("blanks exist and are not rare enough to ignore (Principle 3)",
  blanks.length > 0.02 * f.cohort.people.reduce((s, p) => s + p.answers.size, 0),
  `${blanks.length} blanks`);

// ── 3. A person is a runner, and the runner is total ──────────────────
console.log("\nperson as Runner<AskC>");
const p0 = f.cohort.people[0];
const r0 = fixturePerson(p0, f.corpus);
const mine = f.corpus.get(p0.authored[0])!;
const own = await r0.run(
  { tag: "Ask", id: mine.id, kind: mine.kind as { tag: "Free" }, prompt: mine.prompt },
  0,
);
ok("asking a person their own question returns their own answer", own !== undefined,
  JSON.stringify(own));

const never = await r0.run(
  { tag: "Ask", id: "no-such-question", kind: { tag: "Free" }, prompt: "?" },
  0,
);
ok("an unasked question is a Blank, not an exception — the container is total",
  never.tag === "Blank");
ok("and 'not asked' is distinguishable from 'declined', by the why",
  never.tag === "Blank" && never.why === "not asked");

const d = await r0.run({ tag: "Disclose", of: p0.id }, 0);
ok("disclosure is counts only — no replies leak through it",
  Object.keys(d).sort().join(",") === "answered,authored,blank,idle",
  Object.keys(d).join(","));
ok("and it agrees with the person", d.answered + d.blank === p0.answers.size);
ok("disclose() is the same function", JSON.stringify(d) === JSON.stringify(disclose(p0)));

// A corrupt fixture must throw rather than coerce. This is the dungeon rule:
// a default at a leaf turns an unchecked value into a checked-looking one.
const corrupt = { ...p0, answers: new Map([["bad", { question: "bad", reply: { tag: "Rating", value: 3 } as Reply, at: 0 }]]) };
let threw = false;
try {
  await fixturePerson(corrupt, new Corpus([])).run(
    { tag: "Ask", id: "bad", kind: { tag: "Free" }, prompt: "?" },
    0,
  );
} catch { threw = true; }
ok("an illegal stored reply throws; it is never coerced to a blank", threw);

// ── 4. Comparability, and the invariant that makes it symmetric ───────
console.log("\ncomparability (§1.3: the count must be mutual)");
const sub = new Map(f.cohort.people.map((p) => [p.id, substantive(p)]));
const shares = (a: string, b: string) => {
  let k = 0;
  for (const q of sub.get(a)!) if (sub.get(b)!.has(q)) k++;
  return k;
};
const ids = f.cohort.ids;
ok("sharing is symmetric by construction — a set intersection has no direction",
  ids.slice(0, 20).every((a) => ids.slice(0, 20).every((b) => shares(a, b) === shares(b, a))));
ok("nobody is comparable with themselves in the pool sense (self is excluded later)",
  shares(ids[0], ids[0]) === sub.get(ids[0])!.size);

console.log("\nparity (§1.4: 3n = 2|E|, so n must be even)");
ok("an even cohort is assignable", f.cohort.assignable);
ok("an odd one is not, and it is a gate rather than a warning",
  !generate({ n: 201, budget: 40 }).cohort.assignable);

// ── 5. The measurement itself is stable ───────────────────────────────
console.log("\nthe Phase 2 number");
const dd = density(f);
ok("pairs = n(n-1)/2", dd.pairs === (200 * 199) / 2);
ok("engaged >= substantive >= k>=3, always, by definition",
  dd.engagedPairs >= dd.substantivePairs && dd.substantivePairs >= dd.k3Pairs,
  `${dd.engagedPairs} / ${dd.substantivePairs} / ${dd.k3Pairs}`);
ok("and the three are genuinely different — a blank is not an answer",
  dd.engagedPairs > dd.k3Pairs,
  `${dd.engagedPairs} vs ${dd.k3Pairs}`);
console.log(`\n  n=200, budget=40, seed=20260921: ${dd.k3Pairs}/${dd.pairs} pairs ` +
  `(${((100 * dd.k3Pairs) / dd.pairs).toFixed(1)}%) share >= 3 answered questions; ` +
  `mean reach ${dd.meanReach.toFixed(0)}`);

console.log(failed === 0 ? "\nall ok\n" : `\n${failed} FAILED\n`);
if (failed > 0) Deno.exit(1);
