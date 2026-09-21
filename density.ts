// density.ts — Phase 2's measurement, and the first honest number in the project.
//
// For how many pairs is there any shared question at all?
//
// If two people have never answered a question in common, the engine has
// nothing to compare, and no information-gain argument can manufacture
// something to compare. Every claim downstream — the counter, the narrowing
// loop, the 3-factor — rests on a comparability graph, and this file measures
// it before a single model runs.
//
// Three numbers, not one, because they fall away sharply from each other:
//
//   engaged    both were SHOWN some question in common (blanks included)
//   substantive both ANSWERED some question in common (blanks excluded)
//   k>=3       both answered at least three in common
//
// `engaged` flatters. `substantive` is the one the matcher can use. The third
// is there because one shared question is a coin flip dressed as evidence, and
// the gap between the second and third is the honest size of the market.

import { type Fixture, generate } from "./fixtures.ts";
import { substantive, engaged } from "./people.ts";

export interface Density {
  readonly n: number;
  readonly pairs: number;
  readonly engagedPairs: number;
  readonly substantivePairs: number;
  readonly k3Pairs: number;
  readonly meanShared: number;
  readonly medianShared: number;
  /** Per-person: how many others they share >=3 substantive answers with.
   *  This is the pool size the counter will report, before any compatibility
   *  judgement at all — an upper bound on everybody's count. */
  readonly meanReach: number;
  readonly minReach: number;
  readonly reachBelow3: number;
  readonly corpusSize: number;
  readonly meanAnswered: number;
  readonly blankRate: number;
}

export function density(f: Fixture): Density {
  const people = f.cohort.people;
  const n = people.length;
  const sub = people.map(substantive);
  const eng = people.map(engaged);

  let engagedPairs = 0, substantivePairs = 0, k3Pairs = 0;
  let sharedTotal = 0;
  const shared: number[] = [];
  const reach = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let e = 0, s = 0;
      // Iterate the smaller set; at density 0.25 over 200 questions this is
      // the difference between seconds and minutes at n = 1000.
      const [a, b] = eng[i].size < eng[j].size ? [eng[i], eng[j]] : [eng[j], eng[i]];
      for (const q of a) if (b.has(q)) e++;
      const [c, d] = sub[i].size < sub[j].size ? [sub[i], sub[j]] : [sub[j], sub[i]];
      for (const q of c) if (d.has(q)) s++;
      if (e > 0) engagedPairs++;
      if (s > 0) substantivePairs++;
      if (s >= 3) { k3Pairs++; reach[i]++; reach[j]++; }
      sharedTotal += s;
      shared.push(s);
    }
  }
  shared.sort((x, y) => x - y);

  let answered = 0, blanks = 0;
  for (const p of people) {
    for (const a of p.answers.values()) {
      if (a.reply.tag === "Blank") blanks++; else answered++;
    }
  }

  const pairs = (n * (n - 1)) / 2;
  return {
    n,
    pairs,
    engagedPairs,
    substantivePairs,
    k3Pairs,
    meanShared: sharedTotal / pairs,
    medianShared: shared[Math.floor(shared.length / 2)],
    meanReach: reach.reduce((a, b) => a + b, 0) / n,
    minReach: Math.min(...reach),
    reachBelow3: reach.filter((x) => x < 3).length,
    corpusSize: f.corpus.size,
    meanAnswered: answered / n,
    blankRate: blanks / (answered + blanks),
  };
}

const pct = (x: number, of: number) => `${((100 * x) / of).toFixed(1)}%`;

export function report(d: Density): void {
  console.log(`
  cohort               ${d.n} people, ${d.corpusSize} questions
  pairs                ${d.pairs}
  mean answers/person  ${d.meanAnswered.toFixed(1)}  (blank rate ${(100 * d.blankRate).toFixed(1)}%)

  shared ANY (engaged) ${d.engagedPairs}  ${pct(d.engagedPairs, d.pairs)}
  shared ANY answered  ${d.substantivePairs}  ${pct(d.substantivePairs, d.pairs)}
  shared >= 3 answered ${d.k3Pairs}  ${pct(d.k3Pairs, d.pairs)}
  mean shared / pair   ${d.meanShared.toFixed(2)}   median ${d.medianShared}

  reach (>=3 shared)   mean ${d.meanReach.toFixed(1)}   min ${d.minReach}
  people with reach<3  ${d.reachBelow3}  ${pct(d.reachBelow3, d.n)}   <- cannot be assigned at all`);
}

if (import.meta.main) {
  const arg = (k: string, dflt: number) => {
    const hit = Deno.args.find((a) => a.startsWith(`--${k}=`));
    return hit === undefined ? dflt : Number(hit.split("=")[1]);
  };
  const has = (k: string) => Deno.args.some((a) => a.startsWith(`--${k}=`));
  const base = {
    density: arg("density", 0.25),
    authoredEach: arg("authored", 1),
    dims: arg("dims", 6),
    seed: arg("seed", 20260921),
    ...(has("budget") ? { budget: arg("budget", 40) } : {}),
  };

  if (Deno.args.includes("--sweep")) {
    // The asymptotic, as a table. Fixed FRACTION beside fixed BUDGET, same
    // seed, same everything else. One of these two columns is what a market
    // actually does as it grows and the other is wishful.
    console.log(`\n  budget = 40 questions per person, held fixed as the corpus grows`);
    console.log(`\n     n   corpus   ans/person   pairs>=3 shared   mean shared   mean reach   reach<3`);
    for (const n of [50, 100, 200, 500, 1000, 2000]) {
      const d = density(generate({ ...base, n, budget: arg("budget", 40) }));
      console.log(
        `  ${String(n).padStart(4)}   ${String(d.corpusSize).padStart(6)}   ` +
        `${d.meanAnswered.toFixed(1).padStart(10)}   ${pct(d.k3Pairs, d.pairs).padStart(15)}   ` +
        `${d.meanShared.toFixed(2).padStart(11)}   ${d.meanReach.toFixed(0).padStart(10)}   ${pct(d.reachBelow3, d.n).padStart(7)}`,
      );
    }
    console.log(`\n  density = 25% of the corpus, which GROWS with the cohort`);
    console.log(`\n     n   corpus   ans/person   pairs>=3 shared   mean shared   mean reach   reach<3`);
    for (const n of [50, 100, 200, 500, 1000]) {
      const d = density(generate({ ...base, n, budget: undefined }));
      console.log(
        `  ${String(n).padStart(4)}   ${String(d.corpusSize).padStart(6)}   ` +
        `${d.meanAnswered.toFixed(1).padStart(10)}   ${pct(d.k3Pairs, d.pairs).padStart(15)}   ` +
        `${d.meanShared.toFixed(2).padStart(11)}   ${d.meanReach.toFixed(0).padStart(10)}   ${pct(d.reachBelow3, d.n).padStart(7)}`,
      );
    }
    console.log();
    Deno.exit(0);
  }

  const f = generate({ ...base, n: arg("n", 200) });
  console.log(`\nseed ${f.spec.seed}  ${f.spec.budget === undefined ? `density ${f.spec.density}` : `budget ${f.spec.budget}`}  dims ${f.spec.dims}  authored/person ${f.spec.authoredEach}`);
  report(density(f));
  console.log();
}
