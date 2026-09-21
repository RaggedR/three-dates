# Building three-dates

## What this is

`DESIGN-BRIEF.md` states the product. `design.pdf` states the container reading
and the claims. There is no code. **This plan is the code**: what to vendor, from
where, what to write, in what order, and what each phase must *measure* before the
next one starts.

Five sibling repositories have already been built on the same `lib/`, and each
answered a different question. `tower` wrote the combinators. `stalin` showed a
game can be five servers with a model on one of them. `firm` showed that adding an
agent is a change of *type*. `federation` showed what happens when the graph has a
cycle. `dungeon` asked whether an untyped oracle can be held inside a typed
interface when the oracle is the whole content. This one asks:

> **Can a global assignment be narrowed toward, one private conversation at a
> time?**

Every other repo's composite was a tree computed from one person's prompt. Here the
thing being computed belongs to everybody at once, and no user can see it.

Where `DESIGN-BRIEF.md` and the summary email of 21 Sep 2026 disagree, the brief
wins; §1.1 lists the one place they do.

---

## 0. Where everything comes from

Nothing in `lib/` is to be written. It is vendored, byte-identical, and the
repetition is the test of whether it is a library.

| | absolute path | take from it |
|---|---|---|
| `tower` | `/Users/robin/git/gold/tower` | **origin of `algebra.ts`.** Also `up.sh`/`down.sh`/`wait-ports.sh`, the `demo.sh` foreground-trace pattern, and `explain.ts` — the model leaf that falls back to a stub when no credentials exist |
| `stalin` | `/Users/robin/git/gold/stalin` | **`branch.ts` verbatim** (`seqBranchC`; see §2.2). Also `type-tests.ts` for the two-direction convention, `optimise.py` as precedent for Python beside the TypeScript, and `LESSONS.md` |
| `federation` | `/Users/robin/git/gold/federation` | the cycle/gluing machinery. `mobius.ts`'s `Walk` — a fibre whose base case is seeing itself in `visited`, with state riding in the prompt. `nerve-cohomology.py` and `obstruction-budget.py` are the model for `assign.py`'s reporting |
| `voting` | `/Users/robin/git/gold/voting` | **the closest relative.** `issues.ts` is what `questions.ts` mirrors; `voters.ts` is the shape of `people.ts`; `resolve.ts` is a fold with `visited` *and* `fuel` in the prompt; `check.ts` is the assertion-harness pattern |
| `dungeon` | `/Users/robin/git/gold/dungeon` | **the oracle discipline.** `leaf-claude.ts` (decoder, no defaults, throws on non-decode), `leaf-stub.ts`, `rejection-rate.ts`, and `conformance.ts`. Also `solve.ts` — an offline solver that answers "is this completable at all" before anyone plays |
| Ghani's notes | `/Users/robin/git/three-dates/from-neil` | `neil-containers.md` first, then `vocabulary.md`. §9 is the trap list and every item cost somebody an afternoon |

`lib/algebra.ts` is md5 `2237f8d621764caca85840698812f03a` in all five. Copy from
`/Users/robin/git/gold/voting/lib/` (whole directory: `algebra.ts`, `delegate.ts`,
`wire.ts`, `README.md`) and verify the hash before writing a line.

`lib/README.md` records one inherited divergence and one **known defect**:
`delegate` spawns each hop with an unscoped `--allow-net`, so per-edge network
scoping is decorative. Leaf-ness is enforced; which edges a non-leaf may take is
not. Do not fix it here — fix it upstream or inherit it honestly.

### Toolchain, confirmed present

- Deno 2.7.14 — no `package.json`, no lockfile, no install step
- Python 3 with **networkx 3.6.1** — `max_weight_matching` is Edmonds' blossom,
  exact, and is why §3 Phase 3 is a week and not a term

---

## 1. What the brief does not yet say

Four items. One is a contradiction, one is a hole, one is a reading that needs
confirming, one is arithmetic.

### 1.1 The brief and the email disagree about round size — brief wins

The email of 21 Sep says ten questions, then ten, then five. `DESIGN-BRIEF.md` §4
says *"propose one or a few new questions"* and leaves the count to the engine.

The engine choosing is the whole thesis: a fixed ten is a questionnaire, and §4
exists to say this is not one. **Round size is an output of the interviewer, with a
floor of one and a ceiling that is a tuning constant.** The email was a summary
written for a reader who had not seen the brief, and ten is a good illustration of
a variable quantity.

### 1.2 §5 and §7 are in tension, and this is the hole

This is the most important judgement in this document.

- **§5** narrows *one person's* pool: a hundred, sixty-seven, twelve, three. The
  user keeps answering until their count reaches three.
- **§7** requires the three to be **mutual**, so the assignment is global.

Take both literally and you are demanding that the pool graph *itself* become
3-regular — every person's pool narrowing to exactly three, simultaneously,
consistently, across the whole cohort. That is not narrowing. That is solving the
assignment by wishing, and the engine has no lever that acts on anyone but the
person in front of it.

Two readings, and they are different products.

> **(A) The count is the pool, and it must reach three.** The narrowing loop drives
> the global graph to 3-regularity. This is what the brief literally says, and §7
> explicitly endorses it: *"the narrowing loop must converge against a shared
> assignment rather than against one person's preferences."*
>
> **(B) The count is the pool, the pool must reach a small number, and the solver
> picks three from it.** Narrowing is local and cheap; mutuality is imposed
> afterwards by a maximum-weight 3-factor.

**Build (B) first.** It is a strict relaxation of (A), it is testable in the first
week, and under it the user-visible behaviour of §5 survives intact: the count
still falls toward three and is still permitted to rise. What changes is whether
three is an *endpoint* or an *asymptote*.

Then measure the gap — how far from 3-regular the pools actually get — and attempt
(A) only if the measurement says it is close. **The measurement is Phase 3, and if
it comes back badly this product is (B) or it is nothing.**

### 1.3 The count must be mutual, and the brief does not say so

If `v` is in `u`'s pool but `u` is not in `v`'s, then `v` can never be one of `u`'s
three. Counting `v` is a lie told early that becomes visible late — the worst
shape of lie for a product whose Principle 7 is about honest numbers.

> **The counter reports the size of `u`'s *mutually* compatible set**, not of
> everyone the engine finds interesting.

This has a consequence worth stating: one person's answers can lower another
person's count without either of them doing anything. That is already true under
§7; §1.3 just makes it visible in the number, which is where it belongs.

### 1.4 Parity, and who is in a cohort

Summing degrees over a 3-regular graph, `3n = 2|E|`, so **`n` must be even**. An odd
cohort admits no assignment at all.

The brief never defines a cohort. It has to: the assignment runs over *somebody*,
and it cannot be "all users" (people arrive mid-solve). Proposal, to be tested
rather than assumed — a cohort is everyone assignable at a given tick, the solve
runs on a schedule, and the odd person out waits one tick. Whether that reads as
fair is a product question; that it is *forced* is arithmetic.

---

## 2. Decisions taken before any code

### 2.1 Python does the matching; TypeScript does the algebra

The container algebra is the point and it lives in TypeScript. The matching is a
solved problem in graph theory and reimplementing Edmonds' blossom algorithm would
be a fortnight spent on the least novel part of the system.

Precedent exists in the family: `stalin/optimise.py`, `federation/anarchy-cohomology.py`,
`federation/nerve-cohomology.py`, `dungeon/mkrooms.py`. The line is the same one
those repos drew — **Python where the answer is mathematical and known, TypeScript
where the structure is the contribution.**

`assign.py` owns the Tutte gadget and networkx. `assign.ts` owns the types, the
parity gate, and the consumption of a JSON result. The boundary between them is a
file, and `assign.ts` validates what comes back exactly as a leaf validates an
oracle — because that is what it is.

### 2.2 `seqBranchC`, from line one

`neil-containers.md` §9 trap 4. The narrowing loop is `a ◁ (b + c)` — *ask, then
decide*. The library's `seqC` computes `(a ◁ b) + (a ◁ c)` — *decide, then ask* —
because `(P → −)` is a right adjoint and does not preserve coproducts.

For this product that rewrite is not a subtle unsoundness; it inverts the central
claim of §4. Copy `/Users/robin/git/gold/stalin/branch.ts` verbatim. It lives at the
top level, **not** in `lib/` — `lib/` records exactly one divergence from upstream
and this is not it.

### 2.3 Stub leaves are the default

`./up.sh` gets deterministic stubs; `./up.sh --agent` gets real model leaves. Tests
never need credentials, never touch the network, and run in milliseconds. This is
how `tower` and `dungeon` both do it and it is not negotiable — a test suite that
needs an API key is a test suite that stops being run.

### 2.4 No database until Phase 6

Fixtures in JSON, held in memory. A cohort of two hundred people with a hundred
questions each is a few megabytes. Every claim in `design.pdf` that could be wrong
is falsifiable against fixtures, and persistence is the least interesting way to
find out it was right.

---

## 3. Build order

Every phase ends in a **measurement**, not a feature. A phase that produced code
but no number has not finished.

### Phase 0 — vendor, and prove the library is a library

Copy `lib/` from `/Users/robin/git/gold/voting/lib/`, `branch.ts` from
`/Users/robin/git/gold/stalin/`. Take `up.sh`, `down.sh`, `wait-ports.sh` from
`/Users/robin/git/gold/tower/`.

> **Measurement.** `md5 lib/algebra.ts` equals `2237f8d621764caca85840698812f03a`.
> `deno check lib/*.ts branch.ts` passes with nothing edited. Sixth reuse, zero
> modifications, recorded in the README.

### Phase 1 — `questions.ts`

Kinds (`Free`, `Scale`, `Choice`), `ReplyFor<K>` at the type level, `legal(k, r)` at
runtime, and `Blank` as a position in every fibre. Mirror
`/Users/robin/git/gold/voting/issues.ts` closely enough that the two read side by
side.

> **Measurement.** `type-tests.ts` **fails in both directions** — a legal reply that
> does not typecheck is a bug, and an illegal reply that *does* typecheck is a worse
> one. Both are asserted. This is the `voting`/`dungeon` convention and it is what
> makes `deno check` a test rather than a lint.

### Phase 2 — `people.ts` and a fixture cohort

`Runner<AskC>`, the corpus, and the uniform disclosure every person owes about
themselves. Then two hundred synthetic people with plausible corpora, generated by
script so the cohort can be regenerated at other sizes and densities.

> **Measurement.** The first honest number in the project: **for how many of the
> 19,900 pairs is there any shared question at all?** If two people have never
> answered a question in common, the engine has nothing to compare and no
> information-gain argument can manufacture it. This number is the density problem
> (§9 of the brief) as a single integer, and it is available before any model runs.

### Phase 3 — `assign.py` and `assign.ts` — **the phase that decides the product**

The Tutte reduction, explicitly. For each vertex `v` of the compatibility graph with
degree `d(v)`: create `d(v)` external vertices (one per incident edge) and
`d(v) − 3` internal vertices; join every internal to every external of `v`; map each
original edge to an edge between the two corresponding externals. Original-edge
copies carry the compatibility weight, internal edges carry zero. Then

> 3-factors of `G` ↔ perfect matchings of the gadget, and **maximum-weight**
> 3-factor ↔ maximum-weight perfect matching, which `networkx.max_weight_matching(H,
> maxcardinality=True)` computes exactly.

`assign.ts` holds the parity gate (`n` even), the degree precondition (`d(v) ≥ 3`),
and the decoder for the JSON coming back.

> **Measurement — a curve, not a boolean.** Feasibility and mean assignment weight
> as a function of **mean pool size**, over cohorts of 50, 200 and 1000, at several
> densities. Three questions get numeric answers:
>
> 1. At what mean pool size does a 3-factor start existing reliably?
> 2. How far above three is that? *(This is §1.2's gap — the (A)-vs-(B) decision,
>    decided by measurement rather than by preference.)*
> 3. How much weight is lost by pinning one person's three for a tick? *(This is
>    the cost of cadence, which the brief thought was unknowable.)*

No model, no server, no interface. If this curve is bad, everything downstream is
decoration, and it is available in week one.

### Phase 4 — `worker.ts`

`ΔS ⊗ SubmissionC → CountC`. The tensor, not composition. `fwd`, `bwd_S`, `bwd_X`
as the unfolding theorem gives them.

> **Measurement.** A test named for what it asserts: **the count rises** on an answer
> that contradicts an earlier one, and rises again when another person's answer
> removes a mutual edge (§1.3). Principle 7, as a red test that goes green. Any
> `Math.min` in this file is a bug and the test is what catches it.

### Phase 5 — `narrow.ts`

The loop, as `seqBranchC` over the `Continue + Terminate + Widen` gate, driven by
stub leaves.

> **Measurement.** The distribution of **rounds to assignability** across the fixture
> cohort — median, tail, and the fraction who never get there. The tail is the §5
> edge case (unusual preferences in a thin market) and it must be a number before it
> can be a sentence shown to a person.

### Phase 6 — `interview.ts` — **the phase that decides whether the claim is true**

The product `×`: corpus-pick and compose, both live, one asked. `choose` swappable.

> **Measurement.** Information gain per question against two baselines: a **random**
> question from the corpus, and the **globally most divisive** question ignoring who
> is being asked. §4 claims an active experimenter beats a recommender. That claim
> is either visible as a gap between these three curves or it is not true.
>
> If the gap is small, say so in the README. `claims-evidence` discipline: a
> headline result a stranger cannot verify is not a result.

### Phase 7 — `leaf-claude.ts` and `rejection-rate.ts`

Real model leaves behind the flag. Decoder at every leaf, no defaults, throws on
non-decode — a default turns an unchecked type into a checked-looking one, which is
worse than a crash.

> **Measurement.** Rejection rate **by cause**, per leaf, in the README.
> *"It sometimes fails"* is not a finding; *"it wraps the object in a markdown fence
> one time in twenty"* is.

---

## 4. What could make this fail

1. **Phase 2's pair number is small.** No shared questions, no comparison, no
   product. This is the density risk and it arrives before any code that could be
   blamed for it.
2. **Phase 3's curve says the pools must stay large.** Then reading (A) is dead, the
   count does not reach three, and §5's central mechanic needs rewriting rather than
   implementing.
3. **Phase 6 shows no gap over the random baseline.** Then this is a recommender with
   a language model bolted on, and the honest response is to write that down.
4. **Phase 7's rejection rate is high on `predict`.** Information gain rests on
   predicted answer distributions. If the oracle cannot produce a decodable
   distribution reliably, the ranking is noise wearing a formula.

Failures 1–3 are findings. Only 4 is a bug.

---

## 5. Manifest

```
lib/                  vendored, byte-identical, from gold/voting/lib/
branch.ts             verbatim from gold/stalin/branch.ts
questions.ts          Phase 1   kinds, ReplyFor, legal, Blank
people.ts             Phase 2   Runner<AskC>, corpus, disclosure
fixtures.ts           Phase 2   synthetic cohorts at chosen size and density
assign.py             Phase 3   Tutte gadget + networkx blossom
assign.ts             Phase 3   parity gate, degree gate, JSON decoder
density.py            Phase 3   the curve
worker.ts             Phase 4   ΔS ⊗ −, the counter
narrow.ts             Phase 5   seqBranchC over the gate
interview.ts          Phase 6   the ×, with choose swappable
gain.py               Phase 6   information gain against two baselines
leaf-stub.ts          Phase 5   deterministic oracles
leaf-claude.ts        Phase 7   real oracles, decoder, no defaults
rejection-rate.ts     Phase 7   the number for the README
type-tests.ts         Phase 1+  fails in BOTH directions
check.ts              Phase 2+  assertions against the fixture cohort
up.sh down.sh wait-ports.sh      from gold/tower
```
