// compat.ts — the compatibility graph, and the one number an edge carries.
//
// This is the input to the 3-factor and therefore to everything. It is built
// from stored answers alone: no model, no oracle, no trait vector. Phase 6
// replaces the WEIGHT with something a language model produced; the shape of
// the graph and every gate below survive that substitution unchanged, which is
// why they are in their own file.
//
// Three commitments, each of which is an argument about honesty rather than
// about scoring:
//
// 1. AN EDGE IS MUTUAL OR IT IS NOT THERE. PLAN-build §1.3. If v is in u's pool
//    but u is not in v's, then v can never be one of u's three, and counting v
//    is a lie told early that becomes visible late. Comparability is a set
//    intersection and so is symmetric for free; the *threshold* is what could
//    have broken the symmetry, and applying one threshold to the shared count
//    keeps it.
//
// 2. THIN EVIDENCE IS SHRUNK, NOT TRUSTED. Two people who agreed on three
//    questions are not more compatible than two who agreed on nineteen out of
//    twenty. Without shrinkage the maximum-weight 3-factor would systematically
//    select the thinnest edges, because a mean over three samples has the
//    fattest tail. That is not a scoring preference; it is the difference
//    between the solver optimising compatibility and the solver optimising
//    ignorance.
//
// 3. FREE TEXT CONTRIBUTES NOTHING HERE, AND THAT IS RECORDED. `distance`
//    returns null on prose because there is no metric on it, so before Phase 7
//    roughly two fifths of the corpus is invisible to this file. Every number
//    it produces is therefore a number about the Scale and Choice half. Said
//    out loud rather than absorbed, because a weight that silently ignores 40%
//    of the evidence is exactly the kind of quantity a README ends up quoting.

import { distance, type QuestionId } from "./questions.ts";
import type { Corpus } from "./questions.ts";
import { type Cohort, type Person, type PersonId, substantive } from "./people.ts";

export interface Edge {
  readonly u: PersonId;
  readonly v: PersonId;
  /** Shared questions both answered substantively AND that have a metric. */
  readonly k: number;
  /** Raw mean agreement in [0,1] over those k. */
  readonly raw: number;
  /** After shrinkage toward the population prior. This is what the solver sees. */
  readonly w: number;
}

export interface Params {
  /** Minimum comparable questions for an edge to exist at all. Below this the
   *  engine has an opinion it cannot defend, and §5 would have it reported in
   *  a count that the user is meant to trust. */
  readonly minShared: number;
  /** Shrinkage strength, in units of observations. k0 = 5 means an edge with
   *  five comparable answers sits halfway between its own mean and the prior. */
  readonly k0: number;
  /** Edges below this weight are dropped. Distinct from `minShared`: that gate
   *  is about how much we know, this one is about what we found. */
  readonly minWeight: number;
}

export const DEFAULT_PARAMS: Params = { minShared: 3, k0: 5, minWeight: 0.5 };

/** Agreement over the questions both answered, where a metric exists.
 *  Returns null when there is nothing comparable — which is NOT zero
 *  agreement, and collapsing the two is the mistake `distance` avoids. */
export function agreement(
  a: Person,
  b: Person,
  corpus: Corpus,
): { k: number; raw: number } | null {
  const sa = substantive(a), sb = substantive(b);
  const [small, large] = sa.size < sb.size ? [sa, sb] : [sb, sa];
  let k = 0, sum = 0;
  for (const q of small) {
    if (!large.has(q)) continue;
    const kind = corpus.kind(q);
    if (kind === null) continue;
    const d = distance(kind, a.answers.get(q)!.reply, b.answers.get(q)!.reply);
    if (d === null) continue;
    k++;
    sum += 1 - d;
  }
  return k === 0 ? null : { k, raw: sum / k };
}

export interface Graph {
  readonly ids: readonly PersonId[];
  readonly index: ReadonlyMap<PersonId, number>;
  readonly edges: readonly Edge[];
  readonly degree: ReadonlyMap<PersonId, number>;
  readonly prior: number;
  readonly params: Params;
  /** Pairs that shared enough questions but fell under `minWeight`. Reported
   *  separately because the two rejections mean opposite things — one is
   *  ignorance, the other is knowledge. */
  readonly rejectedByWeight: number;
  readonly rejectedByShared: number;
}

export function build(
  cohort: Cohort,
  corpus: Corpus,
  params: Params = DEFAULT_PARAMS,
): Graph {
  const people = cohort.people;
  const ids = people.map((p) => p.id);
  const index = new Map(ids.map((id, i) => [id, i]));

  // Two passes. The prior has to be the population mean agreement, and you
  // cannot shrink toward a number you have not computed yet.
  const raws: { u: number; v: number; k: number; raw: number }[] = [];
  let priorNum = 0, priorDen = 0;
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = agreement(people[i], people[j], corpus);
      if (a === null) continue;
      raws.push({ u: i, v: j, k: a.k, raw: a.raw });
      // Weighted by k: a pair with twenty comparable answers says twenty times
      // as much about the population as a pair with one.
      priorNum += a.raw * a.k;
      priorDen += a.k;
    }
  }
  const prior = priorDen === 0 ? 0.5 : priorNum / priorDen;

  const edges: Edge[] = [];
  const degree = new Map<PersonId, number>(ids.map((id) => [id, 0]));
  let rejectedByWeight = 0, rejectedByShared = 0;
  for (const r of raws) {
    if (r.k < params.minShared) { rejectedByShared++; continue; }
    const w = (r.k * r.raw + params.k0 * prior) / (r.k + params.k0);
    if (w < params.minWeight) { rejectedByWeight++; continue; }
    const u = ids[r.u], v = ids[r.v];
    edges.push({ u, v, k: r.k, raw: r.raw, w });
    degree.set(u, degree.get(u)! + 1);
    degree.set(v, degree.get(v)! + 1);
  }

  return {
    ids, index, edges, degree, prior, params,
    rejectedByWeight, rejectedByShared,
  };
}

/** Everyone `u` could still be matched with. This is what the counter of §5
 *  reports, and it is mutual by construction because `edges` is. */
export function pool(g: Graph, u: PersonId): PersonId[] {
  const out: PersonId[] = [];
  for (const e of g.edges) {
    if (e.u === u) out.push(e.v);
    else if (e.v === u) out.push(e.u);
  }
  return out;
}

/** Vertices that cannot possibly hold three. The 3-factor will refuse the whole
 *  cohort over any one of them, so they are identified before it is called —
 *  this is the difference between "no assignment exists" and "these eleven
 *  people are the reason", and §5 owes a person the second sentence. */
export function starved(g: Graph): PersonId[] {
  return g.ids.filter((id) => (g.degree.get(id) ?? 0) < 3);
}

/** How far the graph is from 3-regular. This is PLAN-build §1.2's gap — the
 *  measurement that decides reading (A) against reading (B) — as one number
 *  per person plus its summary. Under (A) the narrowing loop would have to
 *  drive `meanDegree` to exactly 3. */
export function regularity(g: Graph): {
  meanDegree: number;
  medianDegree: number;
  minDegree: number;
  maxDegree: number;
  atThree: number;
  starved: number;
} {
  const ds = g.ids.map((id) => g.degree.get(id) ?? 0).sort((a, b) => a - b);
  return {
    meanDegree: ds.reduce((a, b) => a + b, 0) / ds.length,
    medianDegree: ds[Math.floor(ds.length / 2)],
    minDegree: ds[0],
    maxDegree: ds[ds.length - 1],
    atThree: ds.filter((d) => d === 3).length,
    starved: ds.filter((d) => d < 3).length,
  };
}

export type { QuestionId };

// ── The cohort, as the 3-core ─────────────────────────────────────────
//
// PLAN-build §1.4 left this as a proposal to be tested: "a cohort is everyone
// assignable at a given tick, the solve runs on a schedule, and the odd person
// out waits one tick". Testing it turns it into a definite object.
//
// A vertex of degree < 3 cannot hold three, and removing it lowers its
// neighbours' degrees, which may starve them in turn. Iterating that to a fixed
// point is exactly the 3-CORE of the compatibility graph: the unique maximal
// induced subgraph with minimum degree 3. So the cohort is not a scheduling
// convention at all — it is a canonical subgraph, and who waits a tick is
// determined by the graph rather than chosen.
//
// Two things follow, and both are product decisions that arithmetic made:
//
//   - The peel CASCADES. Removing six starved people can starve others. Nobody
//     waits because the system was busy; they wait because the people they were
//     comparable with are themselves not yet assignable. That is a far better
//     sentence to show a user (§5 asks for it explicitly) and it is the true one.
//
//   - Degree >= 3 everywhere is NECESSARY, NOT SUFFICIENT. assign-test.py
//     carries a 6-vertex graph with minimum degree 3 and no 3-factor at all. So
//     the 3-core is a gate the solver still has to clear, not a guarantee, and
//     the retry in `curve.ts` exists for that reason.

export interface Core {
  readonly kept: readonly PersonId[];
  /** Peeled in the order they starved, so the cascade is visible: the first
   *  entries had fewer than three candidates outright, the later ones lost
   *  theirs to the earlier ones. */
  readonly peeled: readonly PersonId[];
  readonly rounds: number;
  /** Set when parity forced one more removal beyond the core itself. */
  readonly parityVictim: PersonId | null;
}

/** The 3-core, then made even. `k` is a parameter only so that the property
 *  "this is the k-core" can be tested at k = 1 and 2 where it is checkable by
 *  hand; the product always wants 3. */
export function core(g: Graph, k = 3): Core {
  const alive = new Set(g.ids);
  const deg = new Map(g.ids.map((id) => [id, g.degree.get(id) ?? 0]));
  const nbrs = new Map<PersonId, PersonId[]>(g.ids.map((id) => [id, []]));
  for (const e of g.edges) {
    nbrs.get(e.u)!.push(e.v);
    nbrs.get(e.v)!.push(e.u);
  }

  const peeled: PersonId[] = [];
  let rounds = 0;
  for (;;) {
    const doomed = [...alive].filter((id) => deg.get(id)! < k);
    if (doomed.length === 0) break;
    rounds++;
    for (const id of doomed) {
      if (!alive.has(id)) continue;
      alive.delete(id);
      peeled.push(id);
      for (const nb of nbrs.get(id)!) {
        if (alive.has(nb)) deg.set(nb, deg.get(nb)! - 1);
      }
    }
  }

  // Parity (§1.4). 3n = 2|E| forces n even, so when the core is odd exactly one
  // person waits, and it should be the one whose removal costs least — the
  // lowest degree, ties broken by id so the choice is deterministic and can be
  // explained. Removing them can re-starve a neighbour, so the peel is rerun.
  let parityVictim: PersonId | null = null;
  if (alive.size % 2 === 1) {
    const ranked = [...alive].sort((a, b) => {
      const d = deg.get(a)! - deg.get(b)!;
      return d !== 0 ? d : (a < b ? -1 : 1);
    });
    parityVictim = ranked[0];
    alive.delete(parityVictim);
    peeled.push(parityVictim);
    for (const nb of nbrs.get(parityVictim)!) {
      if (alive.has(nb)) deg.set(nb, deg.get(nb)! - 1);
    }
    for (;;) {
      const doomed = [...alive].filter((id) => deg.get(id)! < k);
      if (doomed.length === 0) break;
      rounds++;
      for (const id of doomed) {
        if (!alive.has(id)) continue;
        alive.delete(id);
        peeled.push(id);
        for (const nb of nbrs.get(id)!) if (alive.has(nb)) deg.set(nb, deg.get(nb)! - 1);
      }
      // Peeling may have broken parity again. One more, same rule.
      if (alive.size % 2 === 1 && [...alive].every((id) => deg.get(id)! >= k)) {
        const r2 = [...alive].sort((a, b) => {
          const d = deg.get(a)! - deg.get(b)!;
          return d !== 0 ? d : (a < b ? -1 : 1);
        });
        const extra = r2[0];
        alive.delete(extra);
        peeled.push(extra);
        for (const nb of nbrs.get(extra)!) if (alive.has(nb)) deg.set(nb, deg.get(nb)! - 1);
      }
    }
  }

  return {
    kept: g.ids.filter((id) => alive.has(id)),
    peeled,
    rounds,
    parityVictim,
  };
}

/** The graph induced on a subset. Degrees are recomputed, not carried over —
 *  an induced subgraph's degrees are not the original's, and reusing them is
 *  the bug that makes a 3-core look feasible when it is not. */
export function induce(g: Graph, keep: readonly PersonId[]): Graph {
  const set = new Set(keep);
  const ids = g.ids.filter((id) => set.has(id));
  const index = new Map(ids.map((id, i) => [id, i]));
  const edges = g.edges.filter((e) => set.has(e.u) && set.has(e.v));
  const degree = new Map<PersonId, number>(ids.map((id) => [id, 0]));
  for (const e of edges) {
    degree.set(e.u, degree.get(e.u)! + 1);
    degree.set(e.v, degree.get(e.v)! + 1);
  }
  return {
    ids, index, edges, degree,
    prior: g.prior,
    params: g.params,
    rejectedByWeight: g.rejectedByWeight,
    rejectedByShared: g.rejectedByShared,
  };
}

// ── Sparsification, which the gadget forces ───────────────────────────
//
// The Tutte reduction builds d(v) - 3 internal vertices per person and joins
// every one of them to every external, so the gadget carries
//
//     sum over v of  d(v) * (d(v) - 3)     internal edges
//
// which is QUADRATIC in the degree. On the first honest cohort — 194 people,
// mean degree 85 — that is about 1.4 million edges, and blossom is cubic in the
// node count. The solve did not finish in two minutes. This is not a slow
// implementation of the right thing; it is the wrong thing to hand the solver.
//
// The fix is to prune before reducing. A maximum-weight 3-factor uses three
// edges per vertex, so an edge that is not among a person's best K is very
// unlikely to appear in the optimum, and K = 12 already gives each person four
// times the choice they need. At K = 12 the internal edge count falls to about
// n * K * (K-3) ~ 21,000, three orders of magnitude down.
//
// The pruning is a UNION, not an intersection: {u,v} survives if v is among
// u's best K OR u is among v's best K. Three reasons, in increasing order of
// how much they matter.
//
//   - Union is symmetric, so the graph stays undirected and §1.3's mutuality
//     survives the prune. An intersection is symmetric too, so this alone does
//     not decide it.
//   - Intersection starves people. Someone whose candidates all rank them 13th
//     loses every edge, and they are precisely the person §5 promises not to
//     fail silently.
//   - Most importantly, MUTUALITY IS THE SOLVER'S JOB, NOT THE PRUNER'S. The
//     brief's §7 wants three mutual candidates, and the 3-factor is what
//     imposes that. A pruner that pre-imposes it is deciding, on thin evidence
//     and with no view of the global assignment, something the solver would
//     decide exactly. Prune generously; let the optimum be mutual.
//
// This IS a heuristic and it is the only one in the pipeline. `curve.ts`
// measures the price: the same cohorts solved at several K, so the weight lost
// to pruning is a number rather than an assumption.

/** Keep each person's best `k` edges, and the union thereof. */
export function topK(g: Graph, k: number): Graph {
  const best = new Map<PersonId, Edge[]>(g.ids.map((id) => [id, []]));
  for (const e of g.edges) {
    best.get(e.u)!.push(e);
    best.get(e.v)!.push(e);
  }
  const keep = new Set<Edge>();
  for (const [, es] of best) {
    es.sort((a, b) => b.w - a.w);
    for (const e of es.slice(0, k)) keep.add(e);
  }
  const edges = g.edges.filter((e) => keep.has(e));
  const degree = new Map<PersonId, number>(g.ids.map((id) => [id, 0]));
  for (const e of edges) {
    degree.set(e.u, degree.get(e.u)! + 1);
    degree.set(e.v, degree.get(e.v)! + 1);
  }
  return {
    ids: g.ids,
    index: g.index,
    edges,
    degree,
    prior: g.prior,
    params: g.params,
    rejectedByWeight: g.rejectedByWeight,
    rejectedByShared: g.rejectedByShared,
  };
}

/** Size of the Tutte gadget, without building it. Called before the solver so
 *  that "this will not finish" is a prediction rather than a discovery. */
export function gadgetSize(g: Graph): { nodes: number; edges: number } {
  let nodes = 0, edges = g.edges.length;
  for (const id of g.ids) {
    const d = g.degree.get(id) ?? 0;
    nodes += d + Math.max(0, d - 3);
    edges += d * Math.max(0, d - 3);
  }
  return { nodes, edges };
}
