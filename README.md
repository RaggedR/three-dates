# three-dates

A dating application in which you are shown **three** candidates, must meet all
three, and must choose one.

Matching is done by a language model that interviews both sides over time, not by a
similarity score over a fixed feature vector. Its central operation is: *given the
current candidate set, compose the question whose answer would most reduce
uncertainty about which candidates remain.*

Each time you submit answers you are told how many potential matches you currently
have. The count is permitted to rise.

**Status: Phases 0–3 of [PLAN-build.md](PLAN-build.md) are built and measured.**
Phase 3 was the phase designated to decide the product, and it has. Every number
below was produced by code in this repository and names the seed it came from.
Nothing is quoted here that has not been run.

**[DESIGN-BRIEF.md](DESIGN-BRIEF.md)** is the entry point and is written to be read
by whoever implements it. **[design.pdf](design.pdf)** is the container reading.
**[PLAN-build.md](PLAN-build.md)** is the build order.

---

## The container reading

```
AskC  =  Question ◁ Reply            a person is a Runner<AskC>
```

Sign-up is the dependent pair `Σ (q : Question). Reply q`, so reciprocity is the
type rather than a rule. The three are the product `×` — three offered, one
reply owed — and the safety carve-out is a **summand** beside it, never a fourth
position. `Blank` is a position because a partial map is not a morphism. The
counter is a worker `ΔS ⊗ −`, and nothing in a worker's type makes the number
fall.

Where it breaks: the mutual three-assignment is a **3-factor** of the
compatibility graph, which is a global object with cycles in it, and the four
combinators build trees. That is why `assign.py` exists.

**Shapes are public; positions are private** ([DESIGN §13](DESIGN.md#13-the-channel-is-asymmetric--shapes-travel-positions-do-not),
added 22 Sep). You must answer your own question; nobody ever sees anyone's reply.
The matchmaker forwards *questions* between potential matches and never the answers,
so the channel carries preferences rather than attributes, and the composite *ask →
their runner → back to me* simply does not exist. Anonymity holds until the first
date, where you ask everything again, of the person. The product's output is a
warrant to ask, not a dossier — which is also why lying to the matchmaker is free to
enter and expensive to sustain.

---

## What has been measured

### Phase 0 — the library is a library

`lib/algebra.ts` is md5 `2237f8d621764caca85840698812f03a`. The same file, byte
for byte, in `tower` (where it was written, flat), `stalin`, `firm`,
`federation`, `voting` and `dungeon`. **Sixth reuse, zero modifications.**
`deno check lib/*.ts branch.ts` passes with nothing edited.

`lib/README.md` records one inherited divergence and one **known defect**:
`delegate` spawns each hop with an unscoped `--allow-net`, so per-edge network
scoping is decorative. Leaf-ness is enforced; which edges a non-leaf may take is
not. Inherited honestly rather than fixed here.

### Phase 1 — the reply depends on the question

`type-tests.ts` carries 9 `@ts-expect-error` assertions and 20 positive ones, and
`deno check` is therefore a test rather than a lint. Verified by mutation:
deleting one `@ts-expect-error` makes the check report 2 errors, so the negative
direction genuinely bites.

`check.ts` additionally asserts `legal(k, r)` against `ReplyFor<K>` by
enumeration — the half of the dependency the type checker cannot see.

### Phase 2 — comparability, before any model runs

For how many pairs is there any shared question at all? At **n=200, budget 40
questions per person, seed 20260921**, of 19,900 pairs:

| | pairs | |
|---|---:|---|
| share any question (blanks included) | 19,785 | 99.4% |
| share any *answered* question | 19,671 | 98.8% |
| share **three or more** answered | 16,523 | 83.0% |

Mean reach — people you share ≥3 answered questions with — is **165**.

**The sweep is the finding.** Holding each person's budget fixed at 40 questions
while the corpus grows one question per arrival:

| n | corpus | ans/person | pairs ≥3 shared | mean shared | mean reach |
|---:|---:|---:|---:|---:|---:|
| 50 | 50 | 24.3 | 96.7% | 13.83 | 47 |
| 100 | 100 | 26.8 | 93.7% | 10.63 | 93 |
| 200 | 200 | 32.4 | 83.0% | 8.87 | 165 |
| 500 | 500 | 36.5 | 53.8% | 4.87 | 268 |
| 1000 | 1000 | 36.5 | 35.8% | 2.76 | 358 |
| 2000 | 2000 | 37.1 | 18.2% | 1.45 | **365** |

Reach **saturates**. Growing the market past about a thousand people buys no
further comparability, because attention is bounded and the corpus is not. This
makes §4's information-gain ranking load-bearing rather than a nicety: a corpus
that grows one question per arrival and never curates is *what causes* the
saturation.

An earlier version of `fixtures.ts` expressed the budget as a fraction of the
corpus and reported 99.6% at n=1000 — the opposite conclusion from the same
generator. See LESSONS 8.

```
deno run --allow-read density.ts --sweep
```

### Phase 3 — the 3-factor, and the decision it forces

`assign.py` performs the Tutte reduction to perfect matching; `networkx` supplies
Edmonds' blossom algorithm. The gadget is stated for a per-vertex quota `b(v)`
rather than for 3, which makes **pinning** a quota decrement instead of a second
algorithm.

`assign-test.py` checks it against **brute force** — every 3-regular edge subset,
by enumeration — on 16 random graphs at n=6 and n=8, plus an odd cohort, a vertex
of degree 2, a 6-vertex graph with minimum degree 3 and *no* 3-factor, and four
pinning cases. **19/19.**

```
python3 assign-test.py
```

#### The cohort is the 3-core

PLAN-build §1.4 proposed that a cohort is "everyone assignable at a given tick".
Testing that turns it into a canonical object: peel everyone with fewer than
three candidates, iterate to a fixed point. That is the **3-core**, and it is
unique. Who waits a tick is determined by the graph rather than chosen — and the
peel *cascades*, so the true sentence to show a waiting user is "the people you
are comparable with are not yet assignable either", which is exactly what §5 asks
for.

Minimum degree 3 is **necessary and not sufficient**: `assign-test.py` carries a
graph that has it and admits no 3-factor.

#### The price of the one heuristic

The Tutte gadget carries `Σ d(v)(d(v) − b(v))` internal edges — quadratic in the
degree. At mean degree 83 that is **1,611,535 edges**, and the solve does not
return. Pruning to each person's best K is therefore a precondition, not an
optimisation. Its price, n=200, seed 20260921:

| K | edges | gadget edges | mean weight | loss | time |
|---:|---:|---:|---:|---:|---:|
| 4 | 555 | 4,601 | *infeasible* | | 2.1s |
| 5 | 683 | 7,561 | 0.69885 | 0.358% | 4.2s |
| **8** | **1,043** | **19,771** | **0.70129** | **0.010%** | **14.4s** |
| 12 | 1,535 | 45,727 | 0.70136 | 0.000% | 45.7s |
| 20 | 2,452 | 122,570 | 0.70136 | 0.000% | 198.3s |

K=8 is the default: one hundredth of a percent off optimal, fourteen times faster
than K=20. The prune is a **union** of each person's best K, not an intersection,
because mutuality is the solver's job — a pruner that pre-imposes it decides a
global question on local evidence.

```
deno run --allow-read --allow-run=python3 curve.ts --prune
```

#### The cost of cadence — which the brief called unknowable

Freezing part of last tick's assignment while the weights move, n=200:

| pinned | weight | loss vs a free re-solve |
|---:|---:|---:|
| 10% | 207.04 | 0.02% |
| 25% | 206.95 | 0.06% |
| 50% | 206.14 | 0.45% |
| 100% | 204.35 | **1.32%** |

Freezing the *entire* cohort costs 1.3%. Cadence is close to free, so the
schedule can be chosen for how it feels rather than for what it costs.

```
deno run --allow-read --allow-run=python3 curve.ts --q3
```

#### The decision: §1.2 reading (A) is dead. Build (B).

Raising the compatibility threshold is what narrowing does. Sweeping it traces
the path §5's loop would walk. Requiring both that a 3-factor exists **and** that
at least 90% of the cohort is in it:

| n | seed | last good mean pool | × three | coverage | waited |
|---:|---|---:|---:|---:|---:|
| 50 | 20260921 | 7.1 | 2.4× | 92% | 4 |
| 50 | 20260922 | 14.1 | 4.7× | 92% | 4 |
| 200 | 20260921 | 16.0 | 5.3× | 91% | 18 |
| 200 | 20260922 | 17.9 | 6.0× | 90% | 20 |

**The pool bottoms out at roughly five to six times three, and cannot be driven
lower.** Reading (A) — the narrowing loop drives the pool graph itself to
3-regularity, so the count a user watches genuinely reaches three — is not
achievable. Reading (B) holds: narrowing is local and cheap, the pool reaches a
small number, and the maximum-weight 3-factor picks three out of it.

**Which constraint binds is the more useful half of this result.** Feasibility is
not what fails first — *coverage* is. At n=200 the cohort assigned goes
182 → 160 → 100 over two threshold steps while the solver keeps succeeding. A
product built on reading (A) would not show users an error. It would quietly stop
assigning most of them.

The user-visible consequence, and it is a change to the brief: §5's *"they keep
answering until the number reaches three"* is false as stated. The count falls
toward a floor of roughly a dozen and then stops, and three is chosen out of that
dozen by the assignment. The count is still honest, still permitted to rise, and
still the thing the user is working on — but three is an **asymptote the solver
resolves**, not an endpoint the user reaches.

```
deno run --allow-read --allow-run=python3 curve.ts --q1
```

---

## What has not been built

Phases 4–7 of [PLAN-build.md](PLAN-build.md): the counter as a worker
(`ΔS ⊗ SubmissionC → CountC`), the narrowing loop over `seqBranchC`, the
interview product with information gain against two baselines, and the real model
leaves with their rejection rates. In particular:

- **No claim is yet made that an active experimenter beats a recommender.** That
  is Phase 6, it is the central claim of §4, and it will be reported as the gap
  between three curves or not at all.
- **Free text contributes nothing to compatibility so far.** `distance` returns
  null on prose because there is no metric on it, so roughly two fifths of the
  corpus is invisible to every number above. They are numbers about the Scale and
  Choice half.
- **Everything runs against synthetic fixtures**, which contain hidden trait
  vectors so that structure exists to be found. No claim here transfers to real
  people without being re-measured.
- **Nothing enforces the broker's promise.** §13's "the matchmaker does not forward
  replies" is a property of an implementation, not of the architecture, and no test
  goes red if it is deleted. Until one does, it is a decoration rather than a
  guarantee.
- **The anonymity claim is narrower than it reads.** Positions are private; shapes
  are broadcast by design, and a distinctive enough question set identifies its
  author. State it as *positions are private*, not *you are anonymous*, until
  something enforces the stronger one.

## Running it

```
deno check lib/*.ts branch.ts *.ts    # includes type-tests.ts, which IS a test
deno run --allow-read check.ts        # 36 assertions against the fixtures
python3 assign-test.py                # the reduction, against brute force
deno run --allow-read density.ts --sweep
deno run --allow-read --allow-run=python3 curve.ts --prune
deno run --allow-read --allow-run=python3 curve.ts --q3
deno run --allow-read --allow-run=python3 curve.ts --q1
```

Deno 2.7.14, Python 3 with networkx 3.6.1. No `package.json`, no lockfile, no
install step, no credentials. Stub leaves are the default and tests never touch
the network.
