# Containers — the concepts, before you touch the code

**Read this first if you are about to work in `kalvingrove`, `stalin`, `tower`, `firm`,
`federation`, `voting`, `dungeon`, or anything else in `~/git/gold` built on the container
algebra.** It is a summary of the three specification PDFs in this directory, written for an agent
who needs the concepts loaded, not a reader who wants to be persuaded.

| Source | Author, date | What it fixes |
|---|---|---|
| `programming-with-containers.pdf` (21 pp) | Neil Ghani, Kodamai | *the note* — containers, morphisms, the four combinators, where the LLM sits |
| `do-it-kodamai-style.pdf` (5 pp) | Kodamai | *Kodamai Style* — why a typed interface is the trustworthy one |
| `workers-state-via-tensor.pdf` (5 pp) | MacBeth, 15 Sep 2026 | *Workers* — state, as a tensor with ΔS. **Not in the note.** |

Companions in this directory: `vocabulary.md` (what each word means, stipulatively),
`dictionary.md` (TypeScript ↔ Kelvingrove identifier lookup), `my-harness-as-a-worker.pdf`
(the harness read as a worker, first-person).

**Section 9 is the one to read even if you skip everything else.** It lists the things that are
true, surprising, and will cost you an afternoon.

---

## 1. The one idea

> A type is a formalisation of a **specification**. The specification says what the code is
> supposed to do; the type expresses that as a precise mathematical object; and the type checker
> verifies, mechanically, that the code actually has that type.

Three consequences, which are why teams reach for types as systems grow:

- **Trust** — the check is mechanical and runs on every build, over the whole codebase at once.
  You are trusting a proof, not a comment or a test that happens to exercise one path.
- **Scalability** — a checker verifies a million lines as faithfully as ten. Interfaces become
  typed contracts; a change that breaks one is reported *at the boundary that broke*.
- **Adaptability** — the checker becomes a to-do list. Change an implementation, recompile, and it
  shows every place that no longer fits.

The goal these serve: **correct by construction** — make the type a rich enough specification that
*any* program which type-checks is already correct. No separate "now test it" phase.

The deeper point the note keeps returning to: a type **internalises the specification into the
logic**. Specification and code then live in one formal world and can be reasoned about together,
so a machine can *prove*, not merely test.

## 2. Dependent types

A **dependent type** is a type allowed to depend on a *value*: formally just a function
`B : A → Type`. That is the entire idea; everything else is consequences.

- `tail : Vec (n+1) a → Vec n a` — "non-empty" has become part of the type, so `tail []` cannot be
  written down at all.
- `sort : (xs : List Int) → SortedPermutationOf xs` — sortedness and permutation-ness are checked,
  not hoped for.

**The specification is a dial, not a switch.** Each rung moves more of "it is correct" from a test
you hope passes to a type the compiler checks:

```
sort : List Int -> List Int                      -- output is a list of integers
sort : (xs : List Int) -> SameLength xs          -- ...of the same length
sort : (xs : List Int) -> Sorted xs              -- ...provably sorted
sort : (xs : List Int) -> SortedPermutationOf xs -- ...and nothing lost or invented
```

Climb as high as the property you actually care about, and stop where the payoff stops.

Notation: the dependent pair `(a : A ** B a)` is Σ A B; the dependent function `(a : A) → B a` is
Π A B. Σ and Π *are* dependent pairs and functions in a different costume.

## 3. The container

Event-driven programming has a feature that turns out to be exactly a dependent type: **which
responses are appropriate depends on which event arrived.** The valid answers to "what is your
name?" are not the valid answers to "how old are you?".

> **A container is a pair (P : Type, R : P → Type)** — a type P of **prompts**, together with a
> family R assigning to each prompt p : P the type `R p` of permitted **responses**.

Two lines, and they capture questions-and-answers, theorems-and-proofs, structures-and-pointers,
and prompts-and-responses all at once.

**The programmer's job** is to write a program of type

    (p : P) → R p

a dependent function: given a prompt, return a response *of the type that prompt demands*.

**This is really about trust.** A raw LLM has type `String → String` — hand it any string, it hands
back any string, nothing constrains what you may ask or what it may say. A typed interface states
precisely *which prompts are accepted and only which replies are tolerated*. Trust stops being a
hope about behaviour and becomes a property of the type.

Naming warning: the note and the two implementations use **prompt/shape** and **response/position**
for the same two things, and they disagree about which word is primary. See `dictionary.md` §2.

Also: `S ▷ P` is the *constructor* pairing a shape set with a position family. It is **syntax, not
an operator**, and in particular it is **not** composition. Composition is `◁`.

## 4. Morphisms = event handlers = open agents

You rarely answer a rich prompt directly. You implement a hard, high-level interface (P,R) by
leaning on an easier, low-level one (Q,T), plus a translation. That translation is a **container
morphism**:

    u : P → Q                      -- delegate: high prompt to low prompt
    f : (p : P) → T(u p) → R p     -- amalgamate: low reply to high reply

**Control flows down through u; data flows back up through f.** The backward leg is
*contravariant*, and that single fact governs everything in the algebra.

This is the project-manager-and-developer relation, and also: an interpreter (language → machine
instructions), a device driver (abstract ops → hardware commands), a network adapter (protocol →
protocol), a proof-search step (goal → sub-goals). Once you see it, delegation is everywhere, and
it is always a container morphism.

**Answering directly is delegating to nobody.** Let `I = (Unit, λ_ → Unit)` be the do-nothing
interface. Then

    Cont (P,R) I  =  (p : P) → R p

A direct answerer *is* an event handler into the trivial interface. Direct response and delegation
are one notion.

**Open vs closed agent.** A morphism all the way into (1,1) is an **agent** in the ordinary sense:
handed a prompt, it just answers. A morphism into a *non-trivial* interface is an **open agent** —
it exposes an open slot for another component to fill. Open agents are the building blocks you
compose; closed agents are where a computation bottoms out.

**And this is just continuations.** Delegation installs the continuation; amalgamation runs it. The
whole container-morphism story is continuation-passing for typed agents.

## 5. The four combinators

Workflows need no new machinery: the ways of combining agents are **operators on containers**. Each
takes interfaces and returns an interface, so a workflow is a *term* in an algebra — and because
the result is again a container, **a whole workflow is itself an agent**.

| Workflow pattern | Structure | Prompts | Responses | Slogan |
|---|---|---|---|---|
| Prompt chaining | sequential `◁` | Σ(p:P). R p → P′ | Σ(r:R p). R′(v r) | output feeds the next input |
| Routing | sum `+` | disjoint union | each keeps its own | choose one branch |
| Parallelisation | tensor `⊠`/`⊗` | product | product | run all, one reply each |
| Offer-both / one reply | product `×` | product | **sum** | both offered, answer one |

Read the two that are easy to confuse very carefully:

- **tensor** — `pos (p,q) = (R p, T q)`: prompt both sides, **both** replies owed.
- **product** — `pos (p,q) = Either (R p) (T q)`: prompt both sides, exactly **one** reply.

The product sits precisely between routing (where the *input* already belongs to one branch) and
parallelisation (where *every* branch must answer): it lets both branches be live but demands a
single response. Use it for race/fallback, or "several candidate resolutions, commit to one".

**The product is a prediction.** Anthropic's *Building Effective Agents* catalogues three of these
patterns; the algebra has four. The note's claim is that `×` names a workflow the practitioner
catalogue simply has not reached yet — a gap in the table as prediction, not embarrassment. The two
remaining catalogue patterns sit one level up: *orchestrator–workers* is a morphism whose delegate
leg wires the workers at runtime, and *evaluator–optimizer* is a `◁` chain iterated with a `+` gate
deciding each turn whether to stop.

## 6. Where the LLM sits: oracles at the leaves

An LLM does one thing — prompt in, answer out — so it is a **direct answerer**, a handler into the
do-nothing interface, i.e. a **leaf**:

    llm : Cont (S,P) I  =  (s : S) → P s

The handlers of §4 and the workflows of §5 build a **tree** of typed interfaces; at the leaves sit
LLM calls; replies are amalgamated back up. **Structure from the types, substance from the model.**

**The honest caveat, and it is the one that generalises.** A raw LLM is untyped, so presenting it as
`(s:S) → P s` is a *promise*, made good by a typed wrapper — constrained decoding, output
validation, or a retry loop rejecting ill-typed answers.

Both implementations independently discovered that this caveat is **not about language models**.
Type discipline stops at the edge of the process; every leaf beyond it is an oracle, whether the far
end is a transformer or a hand-written arithmetic server. Hence a runtime validator at every leaf,
in both codebases, arrived at separately (`leaf(label, port, decoders)` throwing
`"reply did not validate"`; Kelvingrove's `KType` membership check gated by `@typecheck`).

## 7. State: workers, and why it is the tensor

**Not in the note.** This is MacBeth's third document, and it is what Kelvingrove's `Wrkr`
implements.

Real agents are rarely memoryless — a router remembers which tenant it is serving, a ledger
assistant carries a running balance. The striking claim is that **state needs no new machinery**: a
worker is a container morphism whose domain has been tensored with one fixed, very simple container.

**The state object.** Fix a set S of states:

    ΔS  :=  S ▷ (λ_. S)

Shapes S, and at *every* shape the position set is S again. Its extension is the **store comonad**
⟦ΔS⟧X = S × X^S. As a directed container it is the codiscrete category on S.

**The unfolding theorem.** With X = X₀ ▷ X₁ and Y = Y₀ ▷ Y₁:

*Lemma.* ΔS ⊗ X = (S × X₀) ▷ (λ(s,x₀). S × X₁ x₀) — a shape is *a current state together with an
input shape*; a position is *a state together with an input position*.

*Theorem.* A morphism w : ΔS ⊗ X → Y is **exactly** a pair

    fwd : S × X₀ → Y₀
    bwd : Π_{(s,x₀)} ( Y₁(fwd(s,x₀)) → S × X₁ x₀ )

and `bwd` splits, by the universal property of × in the position, into

    bwd_S : ... → S       -- the WRITEBACK of a new state
    bwd_X : ... → X₁ x₀   -- the ordinary backward map on the input

**Nothing was postulated.** A read-state-and-answer map and a state-writeback map are *consequences
of the types*. This is correct-by-construction for stateful agents: the state discipline is checked,
not hoped for.

**One picture, three names.** *Downstairs* (containers): a worker is a forward/backward pair with a
state-writeback. *One level up* (functors): it is a coKleisli arrow of the store comonad S × (−)^S.
*Sideways* (optics): it is a lens (get : S → A, put : S × B → S) with an input interface bolted on —
the "parameters tensor" law of categorical cybernetics, the same law that drives learners and open
games. The tensor is what makes all three coincide.

**⚠ It must be the tensor, not composition.** ΔS ⊗ ΔT = Δ(S × T) — states multiply, and at
|S|=|T|=2 that is 4y⁴. ΔS ◁ ΔT is store-of-store, 8y⁴: a position then carries a whole *branch map*
S → T recording how the inner state depends on the outer. The two are not equal and not
fibre-related; they are an explicit **retract** (σ : ΔS ⊗ ΔT → ΔS ◁ ΔT with r ∘ σ = id, but
σ ∘ r ≠ id). The clean writeback split is specifically a tensor phenomenon — nest with ◁ instead and
the split is not clean. *State via the tensor entangles; state via composition nests.*

## 8. The categorical backing (Appendix A), in brief

You do not need this to write code, but it tells you which laws exist to be relied on.

- **Cont = Fam(Set^op).** A container is an S-indexed family of objects of Set^op; that free
  coproduct completion *forces* the morphisms to be exactly delegate-forward/amalgamate-backward.
  The contravariance of positions is why the fibre is Set^op.
- **⟦−⟧ : Cont → [Set,Set]** is full and faithful (Yoneda, extended along the coproduct
  completion), and **preserves all four monoidal structures and both closed structures**.
- **Four monoidal structures.** `+` (coproduct), `×` (Construction 2: shapes multiply, positions
  *sum*), `⊠` (Construction 3, Day convolution of ×: shapes and positions multiply), `◁`
  (Construction 4: *not* a Day convolution — it is composition of extensions,
  ⟦A ◁ B⟧ = ⟦A⟧ ∘ ⟦B⟧).
- **Two closed structures**, for `+` and for `⊠`, each a right adjoint to its Day tensor.
- **◁-monoids are monads** (free algebras are W-types); **◁-comonoids are directed containers,
  i.e. small categories**. This is why ΔS-as-codiscrete-category is a meaningful statement.
- **(Cont, ⊗, ◁) is duoidal**, and this is the structural fact behind an operational one: *a
  parallel plan can always be serialised; a serial plan cannot always be parallelised.* The
  interchange map goes one way only.
- **Cont is complete and cocomplete**, so presheaves valued in it, [C^op, Cont], can be left and
  right Kan extended along any g : C → D (g! ⊣ g* ⊣ g\*) — a *change of base topology*. **This is
  the direction Eric and Neil are pursuing**: systems of interacting containers over a base of
  sites/locations/agents, glued where local interfaces must agree. `federation/` is the repo where
  that question is being poked at experimentally.

**⚠ The shared gap.** Poly's ⊗-closure [I,J] is itself a polynomial, with *directions* as well as
positions. Kelvingrove's `PiKType(HomItf(I,J))` recovers only the position set [I,J](1), and
`Fib.jl` says in as many words that nothing constructs the directions; the TypeScript does not
have them either. **Appendix A leans on both internal homs, so the forward-looking half of the specification
rests on the one piece neither implementation has built.**

## 9. Traps — read this section

Every item below was *verified by running the code* (dictionary.tex §10, 16 Sep 2026) or is recorded
in a source comment as a bug already paid for once.

**Algebra**

1. **`×` is not the tensor.** `pick`/`×` = product = answer *one*. `parallel`/`⊗` = tensor = answer
   *both*. `prod` is a deprecated alias for `pick`. This is the single easiest mistake in the
   Kelvingrove codebase.
2. **The unit laws fail on the nose.** `parallel(a, Id) == a` is **`false`**, as are the other
   three. They hold only up to explicit intro/elim arrows: `Id_elim(1,a)`, `id_elim(1,a)`,
   `Unit_elim(1,a)`, `ZeroElimLens(branch(a, Zero))`. Capitalisation is not uniform —
   `Id_*` is the ⊗ pair, `id_*` the ◁ pair — and the varargs are the **codomain** children, so it is
   `Id_elim(1, a)`, not `Id_elim(a)`.
3. **There are three units, not one**: (1,1) for ⊗ and ◁; (1,0) for ×; (0,0) for +. A morphism into
   (1,0) is not an answerer but the unique map to a terminal object.
4. **There is no distributor for ◁ over +, because none exists.** On the TypeScript side the invalid
   distribution is not forbidden, it is *performed* — every combinator is a conditional type and
   distributing is all a conditional type knows how to do, so `seqC(a, sumC(b,c))` silently computes
   (a◁b)+(a◁c) (*decide then ask*) when routing needs a◁(b+c) (*ask then decide*). `stalin/branch.ts`
   is the repair. **This is a soundness difference, not an ergonomic one.**

**Julia / Kelvingrove**

5. **`◁` is a comparison operator in Julia.** Precedence 7, same as `==`, associativity `none`. So
   `a ◁ b ◁ c` parses as a **chained comparison**, lowers to `(a ◁ b) && (b ◁ c)`, and raises
   `TypeError: non-boolean (SeqItf) used in boolean context`. **The n-ary sequencing this algebra is
   built around cannot be written infix at all — use `seq(a, b, c)`.**
6. **Infix `+` and infix `⊗` disagree about arity.** `a + b + c` is one variadic call, so
   `(a+b+c) == branch(a,b,c)` is `true`. `a ⊗ b ⊗ c` is left-associated binary, so
   `(a⊗b⊗c) == parallel(a,b,c)` is `false` and the flat 3-ary `ParallelItf` is unreachable through
   the operator. `Parallel/Assoc.jl` is the arrow between them.
7. **Nesting is strict** for `+`, `×`, `⊗`: (A⋆B)⋆C ≠ A⋆B⋆C. `◁` is the exception — `SeqItf`
   flattens.
8. **`ext` equality is intensional**, so interface accessors must return *stored* objects, never
   reconstruct them.
9. **`@typecheck` is a runtime gate.** All type checking in Kelvingrove happens when a value
   arrives. Do not describe it as static.
10. **`stalin/state.ts` is NOT a counterpart to `Wrkr`.** It is the game's domain (grain, steel,
    harvest grades); its finite unions are the Σ-over-finite-index restriction, nothing to do with
    worker state.

## 10. Where each concept lives

| | Language | Role |
|---|---|---|
| `kalvingrove/` | Julia (`kodamai/substrate`, branch **`trunk`**) | the production implementation; reified KType universe, `Wrkr`, ZMQ/federation |
| `tower/` | Deno/TS | §4–§5 as five servers and four CLI hops; **origin of `lib/algebra.ts`** |
| `stalin/` | Deno/TS | the Five-Year Plan as a container; five commissariat servers |
| `firm/` | Deno/TS | three stages + a CEO; the finite family of topologies is itself a container, so re-shaping the firm is *routing*, not a recompile |
| `federation/` | Deno/TS | three servers in a ring; where the tree-shaped combinators run out and you get H¹ with two classes |
| `voting/` | design only | `IssueC = Issue ◁ Vote`; a citizen is a `Runner<IssueC>`; delegation as a morphism |
| `dungeon/` | Deno/TS | can an untyped oracle be held inside a typed interface when the oracle *is* the content? |

`lib/algebra.ts` (11,520 bytes) is vendored **byte-identical** into `tower`, `stalin`, `firm`,
`federation`, `voting` and `dungeon`. That repetition is deliberate and is the test of whether it is
a library; do not "fix" the duplication, and do not rename the stray `STALIN_INPROC` env var that
rides along in `wire.ts` — a rename is the beginning of a fork.

## 11. Reading order for a new session

1. **This file.**
2. `vocabulary.md` — the four terms, stipulatively; and the harness question.
3. `dictionary.md` — only when you need an identifier in the other implementation.
4. `programming-with-containers.pdf` §3–§5 — before touching `kalvingrove/src/Itf`. Almost every
   identifier there is a term from these sections under a different name.
5. `kalvingrove/CLAUDE.md` — the vocabulary map table is the single most useful thing to have
   loaded when editing that repo.
6. `../kg-notes/container-formalisms.pdf` — where the implementations diverge and why.
