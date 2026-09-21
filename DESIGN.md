# three-dates — the container reading

**The brief is [`DESIGN-BRIEF.md`](DESIGN-BRIEF.md), verbatim. Nothing is built yet.**
This file is the first structural pass: which parts of the brief are settled by the
container algebra we already have, which are genuinely open, and what is worth
building first.

It is the sixth thing built on Neil Ghani's *Containers for Typed Agentic AI*
(`from-neil/programming-with-containers.pdf`; the concept summary is
`from-neil/neil-containers.md`), after `tower`, `stalin`, `firm`, `federation`,
`voting` and `dungeon`. `lib/algebra.ts` is byte-identical across all five that
have one (md5 `2237f8d621764caca85840698812f03a`) and would be vendored here
unmodified. The repetition is deliberate and is the test of whether it is a
library. Do not fix it.

**Author:** Claude, with Robin Langer, 21 September 2026.

---

## 1. The container

One container, and everybody has the same one.

```
AskC  =  Question ◁ Reply
```

A shape is a question; a position is a valid reply **to that question**. The
dependency is real — a free-text question admits prose, a scale admits a number in
range, a choice admits one of its options — and it is exactly what `PosAt<C, S>` is
for. This is `voting`'s `IssueC = Issue ◁ Vote` transplanted, and the transplant is
almost free.

> **A person is a `Runner<AskC>`.** Somebody you can put a question to, and who
> answers. That is the whole ontology. A prolific answerer, a lurker, and a person
> who has written one question and gone quiet are not three types; they are three
> ways of being a runner.

The family is **constant** — every person serves the same container — so, exactly as
in `voting`,

```
Σ (u : People). AskC   ≅   People × AskC
```

and a sum of a constant family is a product with its index set, which does not need
the index set to be finite. **The user base may be unbounded.** That is what
`firm` had to pay for and did not get.

It is worth knowing what would destroy it: give some users a capability others lack
— a verified badge with its own endpoint, a paid "ask directly" channel — and the
family stops being constant, and unbounded membership goes with it.

### Blank is a position, and the formalism insists on it

Principle 3 says unanswered questions are signal, not absence. In the container
reading this is not a principle to remember to honour. It is **forced**.

A person who may decline is a *partial* map `(q : Question) ⇀ Reply q`, and a partial
map is not a container morphism. There is no such arrow. To have a morphism at all
you must widen the positions:

```
Reply q  =  ReplyFor (kind q)  +  Blank
```

and at that moment declining stops being a gap in the data and becomes an element of
it — something with a timestamp, a question it was declined *against*, and a place in
every fold downstream. Principle 3 is the only way to type the product.

`Blank` is in **every** fibre, uniformly, for the reason above: a fibre that could
not be declined would break the constant family.

## 2. Sign-up is the dependent pair

The first act (§3 of the brief) is: write a question you want asked of a partner,
then answer it yourself. That is `seqC`, and nothing else:

```ts
signup.step(
  { tag: "Compose" },                 // first  : the shape "write me a question"
  (q) => ({ tag: "Ask", question: q })  // next : that question, put back to you
)
```

The first position is the question you wrote; `next` sends it to the shape of your
own answer *to that question*; the composite position is the pair. So a completed
sign-up is an element of

```
Σ (q : Question). Reply q      =      ⟦AskC⟧ (1)
```

**Reciprocity is the type.** "Nobody may ask what they will not answer" is not a
validation rule bolted on in front of a form; it is the statement that the sign-up
act inhabits a dependent pair rather than a product. You cannot construct the shape
without constructing a question, and you cannot construct the position without
answering the one you actually constructed.

This also settles a small thing the brief leaves implicit: the self-answer is
answered against the *same* `Reply` type as everyone else's, including `Blank`. A
person who writes a question and declines their own has done something legible and
strange, and the type records it rather than rejecting it.

## 3. The interviewer is the product `×`

§3 says the system recommends questions submitted by other users. §4 says it composes
new questions on demand to resolve a specific ambiguity. Both are live; exactly one
question gets asked. That is the product:

```
InterviewC  =  CorpusPick  ×  Compose
pos (c, n)  =  Either (Question) (Question)
```

Prompt both sides — rank the corpus by information gain, *and* ask the model for a
question that does not exist yet — and commit to one. Ghani's note calls `×` a
**prediction**: Anthropic's *Building Effective Agents* catalogues three of the four
combinators, and `×` names a workflow the practitioner catalogue has not reached.
`firm` used it once, for the CEO. Here it is the engine's inner loop.

`productC` takes a `choose` policy, because a container does not choose — the program
implementing `(p : P) → R p` does. The policy is the one place the "recommender vs.
active experimenter" distinction of §4 becomes a line of code, and it should be
swappable so the argument can be had against running numbers, the way `voting` made
its cycle policy swappable.

## 4. The narrowing loop is `◁` over a sum, and that is a known trap

The loop of §4 — ask, narrow, repeat — is `seqC`: the reply to one question chooses
the next. But the next question is routed by kind, so the expression wanted is

```
a ◁ (b + c)          -- ask, THEN decide
```

The library's `seqC` computes

```
(a ◁ b) + (a ◁ c)    -- decide, THEN ask
```

because a container is written as the union of its fibres, every combinator is a
conditional type, and distributing is all a conditional type knows how to do. In
`seqC` the second argument's shapes sit inside a **function type**, and `(P → −)` is
a right adjoint: it preserves products and does not preserve coproducts.

The rewrite has silently moved the decision to before the question — which is
precisely the thing §4 says must not happen, since the whole claim of the engine is
that it composes the next question **after** reading the last answer.
`stalin/branch.ts` (`seqBranchC`) is the repair, and it is needed here from the first
line of code, not retrofitted. **This is a soundness difference, not an ergonomic
one** (`neil-containers.md` §9, trap 4).

In the note's own taxonomy the narrowing loop is the **evaluator–optimizer** pattern:
a `◁` chain iterated, with a `+` gate deciding each turn whether to stop. The gate's
three outcomes are `Continue`, `Terminate at three`, and the one §5 insists on,
`Widen` — and it is a sum because the three carry different data.

## 5. The counter is a worker, and that is why it is allowed to rise

The counter of §5 carries state: the corpus a person has accumulated, and their
current candidate pool. Per MacBeth's third document
(`from-neil/workers-state-via-tensor.pdf`), state needs no new machinery — a worker
is a morphism whose domain has been tensored with `ΔS = S ▷ (λ_. S)`:

```
submit : ΔS ⊗ SubmissionC → CountC
```

and the unfolding theorem hands back, **without anything being postulated**, exactly
two maps:

```
fwd   : S × Submission₀ → Count₀                  the number the user is shown
bwd_S : ... → S                                   the writeback: the new pool
bwd_X : ... → Submission₁                         the ordinary backward leg
```

A read-state-and-answer map and a state-writeback map are consequences of the types.
That is correct-by-construction for the one component of this product that everything
else hangs off.

**It must be `⊗`, not `◁`.** `ΔS ⊗ ΔT = Δ(S × T)` — states multiply. `ΔS ◁ ΔT` is
store-of-store and strictly larger; the two are an explicit retract, not an
isomorphism, and the clean writeback split is specifically a tensor phenomenon. State
via the tensor entangles; state via composition nests. Nest here and the counter's
update stops being a single map and starts being a branch map recording how the pool
depended on the corpus, which is not what anyone wants to debug.

### Principle 7, as a fact about types

The brief argues the count must be permitted to rise on grounds of honesty and
anti-gaming. The formalism makes the same point from the other end, and more
cheaply:

> **Nothing in a worker's type constrains the direction of the writeback.** The
> honest counter is simply the unconstrained worker.

A progress bar is the *more* constrained object: a worker whose state space carries
an order and whose writeback is required to descend it. So monotonicity is the thing
you would have to go out of your way to impose, and Principle 7 is the default that
falls out of writing the type down at all. Any implementation that finds itself
adding a `Math.min(prev, next)` has left the algebra, and should notice.

### And a reason the brief does not give

§7 requires the three to be mutual. A mutual assignment over a cohort is a
**3-regular graph**, and a 3-regular graph on `n` vertices needs `3n` even, hence
`n` even. There are cohorts for which **no** assignment exists, for reasons that have
nothing to do with any individual's answers.

So the pool must sometimes be enlarged to make the global problem feasible, and the
user will see their number go up because of somebody else's arithmetic. That is a
second, harder justification for Principle 7 than the psychological one, and it also
sharpens §5's edge case: the system owes the user *three* sentences, not two —
*I don't know enough about you*, *I know you well and there are not three such people
here*, and *there are, but not in a configuration that closes*.

## 6. The commitment mechanism is the product, exactly

§6: three candidates, meet all three, choose one.

```
ThreeC  =  A × B × C           pos (a,b,c) = Either₃ (R a) (R b) (R c)
```

Three offered, exactly one reply owed. The product is not an analogy for the
mechanism; it is the mechanism, and the product is what the product is named after.

Note which combinator it is **not**. The tensor `⊗` would owe a reply to all three —
that is a system where you choose three people, which is a different product and a
worse one. The sum `+` would mean the choice of which candidate you are even
considering was made before you were shown them, which is a marketplace. Only `×`
puts three live options in front of a person and demands one answer.

### Declining all three is a map into `(1,0)`

There are three units, not one: `(1,1)` for `⊗` and `◁`, `(0,0)` for `+`, and
`(1,0)` for `×`. **A morphism into `(1,0)` is not an answerer** — `(1,0)` has no
positions — it is the unique map to a terminal object (`neil-containers.md` §9, trap
3). "A user may not decline all three by preference" is that sentence. Refusing the
whole product is not a move; it is leaving.

### Therefore the carve-out must be a summand, not a position

Principle 5 says declining for cause must be free and easy, and overrides everything
above. There is exactly one structurally honest way to write that:

```
OfferC  =  (A × B × C)  +  DeclineForCause
```

A summand, not a fourth position. The difference is not cosmetic:

- **As a position**, refusal-for-cause would be one of the answers weighed inside the
  product — comparable to the other three, and therefore *priceable* against them. A
  system could then, entirely within its type, make it the expensive option.
- **As a summand**, it is a different interface reached by routing. Its cost is not
  comparable to anything inside the product, because it is not in the product.

"The expense attaches to indifference, never to refusal" is the statement that the
carve-out lives on the other side of a `+`. A design that puts it inside the `×` has
violated Principle 5 in the types, before anyone writes a pricing rule.

## 7. Where the LLM sits, and what it costs

An LLM is a direct answerer: a handler into the do-nothing interface, i.e. a **leaf**.
Structure from the types, substance from the model. Three leaves here:

| leaf | prompt | position |
|---|---|---|
| `compose` | a pool and the ambiguity discriminating it | a `Question` |
| `predict` | a person's corpus, a question | a distribution over `Reply q` |
| `read` | two people circling the same concern in different words | a judgement |

`predict` is the one that makes §4's information-gain ranking mean anything: a
question everyone answers identically carries no information and sinks, and you
cannot compute that without predicting answers.

**And a raw LLM is untyped.** Presenting it as `(s : S) → P s` is a *promise*, made
good by a typed wrapper: a decoder at every leaf, and a reply that does not decode
throws. `dungeon` is the repo that took this seriously — and found the caveat is not
about language models at all. Type discipline stops at the edge of the process; every
leaf beyond it is an oracle, whether the far end is a transformer or a hand-written
server.

`dungeon`'s honest answer is a number, and it should be copied: `rejection-rate.ts`
counts every rejection against its cause and the number goes in the README. *"It
sometimes fails"* is not a finding; *"it wraps the object in a markdown fence one
time in twenty"* is.

Leaves are **stubbed by default** — deterministic, offline, fast — with real model
leaves behind a flag, exactly as `tower` and `dungeon` do it (`./up.sh` vs
`./up.sh --agent`). The whole system must run and test with no credentials.

## 8. Which combinator is which

| | in the algebra | here |
|---|---|---|
| `◁` | the reply to the first chooses the second | **sign-up** (write a question, answer *that* question) and the **narrowing loop** (this answer chooses the next question) |
| `×` | both offered, exactly one answered | **the three**, and the interviewer's corpus-or-compose choice |
| `⊗` | both shapes up front, both replies owed | **state** (`ΔS ⊗ −`, the counter) and the **mutual pair** — a meeting proposal owes a reply from both sides |
| `+` | routing: disjoint shapes, each keeping its own positions | question **kind**; the loop's `Continue / Terminate / Widen` gate; and the **safety carve-out** |

`×` doing the primary work is the notable one. `stalin` never used it as more than a
fallback, `federation` never used it, `firm` used it once for the CEO — and here it
is both the commitment device and the engine's inner loop.

## 9. Where it breaks: the assignment is not a tree

§7 of the brief decides that the three must be mutual, and is right that this is the
hardest thing in the product. It is also the one thing the four combinators
**cannot** express, and it is worth being exact about why.

The combinators build **trees**. A morphism's delegate leg points down; composites
nest. A per-user narrowing is a tree and the type checker is happy. But mutuality —

```
v ∈ three(u)   ⟺   u ∈ three(v)
```

— is a condition on **overlaps**, and the graph of it has cycles. `voting` met the
same wall and it presents identically:

```ts
const loop = seqC(you, loop);   // TS7022: referenced in its own initializer
```

This is `federation`'s subject exactly: local data (each person's three), an
agreement condition on overlaps, and the question of when the local data glues to a
global object. A mutual assignment **is** a global section, and the obstruction to
one existing is what that repo is for.

### What is actually hard, and what is not

The brief says the assignment is "a matching problem with quotas, closer to
Gale–Shapley than to a ranking". That undersells it in one direction and oversells it
in another, and the correction changes the build.

> **Claim.** A mutual three-assignment over a cohort is exactly a **3-factor** of the
> compatibility graph: a spanning subgraph in which every vertex has degree 3. By
> Tutte's reduction of the f-factor problem to perfect matching, its existence is
> decidable in polynomial time, and the *maximum-weight* 3-factor — the best three
> for everybody, not merely three — is computable in polynomial time by the same
> reduction against weighted matching.

So the static problem is not the monster §7 fears. It is not Gale–Shapley, because
mutuality is a *symmetry* constraint rather than a stability one, and degree-
constrained subgraph is easier than stable matching with quotas, not harder. Three
consequences are real, though, and §7's architectural conclusion survives intact:

1. **It is global.** One person's answers change the feasible assignment for people
   they will never see. Matches cannot be computed per-user on demand — the brief
   says so and the reason is that a 3-factor is not a local object.
2. **It is dynamic.** People arrive, answer, and leave continuously. Recomputing a
   maximum-weight 3-factor under churn, without thrashing anybody's three, is the
   actual research problem, and it is not solved by the static algorithm.
3. **Parity is a hard gate.** Odd cohorts admit nothing. See §5 above.

The honest summary: the brief was right that this must be prototyped before any
interface exists, and wrong about which part is hard. It is not the algorithm. It is
the churn, and the fact that the narrowing loop of §4 must converge against a shared
assignment rather than against one person's preferences.

## 10. What the algebra refuses to decide

These are open, in roughly the order they matter. The formalism admits all of the
alternatives, which is why they are listed rather than resolved.

**1. Is the preferred answer part of the position?** OkCupid's triple — your answer,
the answer you want from a partner, an importance weight — is the prior art §10 of
the brief points at, and it worked.

*Against:* Principle 2 says elicit acts, not claims, and "the answer I'd accept" is a
claim about a hypothetical person — the cheapest kind of self-report. Principle 1 says
costless signals carry none, and ticking an importance slider costs nothing.

*For, resolved:* the question a person **chose to write** is the act-form of *what I
care about*, and the set of questions they **chose to answer** is, by Principle 3,
the act-form of the weight. So the triple is recoverable from acts and need not be
asked.

*What actually changes:* if the weight is asked, `Reply q` is a product and the corpus
is dense from day one — which is what a cold-start system wants (§8, the risk that
kills it). If it is inferred, `Reply q` is thin and the engine must do the work — which
is exactly the work §4 says distinguishes this from a recommender. **The disagreement
is real and should be preserved:** it is the density problem arguing against the
product thesis, and the answer probably differs before and after the product has
users.

**2. What happens when a branch of the assignment fails?** `voting` found the same
shape of question — when one branch of a fold cycles, does the party abstain
wholesale or fold over the survivors? Here: when a cohort admits no 3-factor, does
everybody wait, or does a maximal subset get their threes while the remainder is
told to keep answering? The second is kinder and quietly changes who is ever matched.

**3. Cadence** (§8 of the brief). How long a person may sit on three unmet candidates
is a *lock* on three other people's assignments. In the 3-factor reading this is
explicit: an unresolved three is a set of edges pinned in the graph, and pinning
degrades the achievable weight for everyone else. The cost of delay is computable.

**4. Is the corpus's information-gain ranking inside the algebra or beside it?** A
container says what a valid answer is and nothing about how it was arrived at. Ranking
is a fold over positions, so it may be entirely outside — or it is `⊗` over the
population with a fold, and the corpus's self-curation is that fold's argument. The
same question `voting` asked about the chat room.

**5. What "meeting" means**, and how it is confirmed. The brief flags this. Note that
whatever it is, it is a `⊗`: both sides owe a reply, and a meeting with one reply is
the no-show record §3 says reputation attaches to.

## 11. What to build first

Given §9, the order is not the one the brief proposes.

1. **`questions.ts`** — kinds, `ReplyFor<K>` (type level) and `legal` (runtime), the
   `Blank` position. Mirrors `voting/issues.ts` closely enough to read side by side.
2. **`people.ts`** — `Runner<AskC>`, the corpus, and the disclosure any person owes
   about themselves (uniform, per §1).
3. **`assign.ts`** — the 3-factor, static, on a hand-built cohort with the parity gate
   and the weight. It is polynomial and it is testable without a model, a server or an
   interface, and §9's three real difficulties only become visible once it runs.
4. **`worker.ts`** — `ΔS ⊗ −`, the counter, with the writeback free in both
   directions and a test that asserts it *rises* on a contradicting answer.
5. **`branch.ts`** (from `stalin`, verbatim) then **`narrow.ts`** — the loop, as
   `seqBranchC` over the `Continue / Terminate / Widen` gate.
6. **`interview.ts`** — the `×`, with `choose` swappable.
7. **`leaf-stub.ts`**, then `leaf-claude.ts` and `rejection-rate.ts` — the number in
   the README.

Steps 1–4 need no network, no model and no credentials, and they contain every claim
in this document that could be wrong.

## 12. What is assumed, and what would break it

- **The family is constant.** Every person serves `AskC` and nothing else. Any
  capability granted to some users and not others ends unbounded membership (§1).
- **Shapes are finite unions.** `lib/algebra.ts` presents a container as the union of
  its fibres, which is what buys Σ over a finite index. Question *kinds* are finite;
  questions are not, and `Question` is therefore a payload inside a fibre rather than
  a fibre of its own. If a kind is ever added dynamically, the whole conditional-type
  construction fails.
- **The oracle keeps its promise often enough.** Unmeasured, this is a hope. `dungeon`
  measured it; so should this.
- **The cohort is even, and a 3-factor exists.** Neither is generic. Both are
  checkable before anyone is told a number.
