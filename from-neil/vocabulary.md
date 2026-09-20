# Vocabulary

A working glossary for the container framework of Neil Ghani's *Containers for
Typed Agentic AI*, fixing the terms that are used loosely elsewhere in
`~/git/gold`. Definitions are stipulative: they say what the word means *here*,
so that a sentence using it can be checked.

Notation: a container is `(P, R)`, written `P ▷ R` — a type `P` of **prompts**
(shapes) and, for each `p : P`, a type `R p` of valid **responses**
(positions). Equivalently `Σ_{p:P} y^{R p}`.

---

## The four terms

### stateful container

A container whose positions are states.

    ΔS  =  S ▷ (λ_. S)  =  Σ_{s:S} y^S

Both legs are `S`: the prompt is the state you are in, the response is the state
you are in. It carries no question and no answer — only a place to keep
something. Its extension is the store comonad, `⟦ΔS⟧ X = S × X^S`.

That the shapes are *also* `S` is forced, not incidental: a state object you
cannot read is not a state object, so the prompt type must expose `S` too. The
name records the interesting half.

### state handler

A container morphism whose domain is a tensor of a container and a stateful
container:

    ΔS ⊗ X  ⟶  Y

Under the Dirichlet tensor (shapes multiply, positions multiply),

    ΔS ⊗ X  =  (S × X₀) ▷ (λ(s,x₀). S × X₁ x₀)

so such a morphism is exactly a pair

    fwd : S × X₀ ⟶ Y₀
    bwd : Π_{(s,x₀)} ( Y₁(fwd(s,x₀)) ⟶ S × X₁ x₀ )

and the backward leg **splits**, by the universal property of the product in the
position, into a *state writeback* component (`S`) and an ordinary *input
back-map* (`X₁`). That split is the whole reason the tensor is the right home
for state. Specialising `X = y`, `Y = A ▷ (λ_. B)` gives precisely a lens:
`get : S → A`, `put : S × B → S`.

⚠ **`⊗` is not `◁`.** `ΔS ⊗ ΔT = Δ(S × T)` — states multiply, `4y⁴` — whereas
`ΔS ◁ ΔT` is store-of-store, `8y⁴`. The tensor grading is a retract of the
composition grading, not a fibre, and the clean writeback split is specifically
a tensor phenomenon. A "state handler" composed rather than tensored is a
different object and does not have it.

⚠ **`⊗` is not `×` either.** The categorical product offers both sides and
answers *one*; the tensor offers both and answers *both*. In Kelvingrove these
are `pick`/`×` and `parallel`/`⊗` respectively, and swapping them is the easiest
mistake in that codebase. "Tensor" above means answer-both.

### handler, open agent

Both mean: a container morphism. `(P,R) → (Q,T)` is a pair

    u : P ⟶ Q                          (control flows down)
    f : (p : P) ⟶ T(u p) ⟶ R p         (data flows back up)

They are two names for one thing, taken from two directions. *Handler* names the
obligation — something arrives and must be answered. *Open agent* names the
means — it is answered by delegating onward, and the openness is the domain it
delegates into. A project manager delegating to a developer, an interpreter, a
device driver and an LLM agent calling a tool are all this, and the framework's
claim is that they are the same construction rather than four analogies.

**Not to be confused with an async function, which is a position in a
container** — a member of some `R p`, not a morphism.

The confusion is understandable, because `async f : A → Promise<B>` is written
with an arrow and so looks like the `u` leg of something. The discriminating
test is legs: a morphism is a *pair* of maps, and the second one — the backward
leg — is what carries the answer home. An async function has no backward leg
because it is not standing between two interfaces; it is the value that comes
back along somebody else's. Awaiting it is consuming a position.

### harness

**In Ghani's sense:** a stateful container. The thing that holds `S` while the
work goes on around it.

**The Claude Code harness:** see below — the question is worth its own section,
because "is it a container or a container morphism?" turns out to be three
questions wearing one coat.

---

## Is the Claude Code harness a container or a container morphism?

Asking whether it is a container *or* a morphism is close to asking whether a
group is a set or a homomorphism. Container and morphism are object and arrow;
a thing is not one to the exclusion of the other, and the honest answer is that
the harness stands in three relations at once, to three different questions.

**1. What does it look like to the model? A container.** Its prompts are the
tool calls — `Bash`, `Read`, `Edit`, `Agent`, `ToolSearch` — and for each, the
responses are what comes back: an exit code and a stream of bytes, a file's
contents, a subagent's report. The dependence is real and checkable: the
response type varies with the *value* of the call, not merely its type.

It is a container in the strong sense, not the loose one. The prompt set is not
fixed: *deferred* tools have visible names and no loaded schema, and there is a
prompt — `ToolSearch` — whose response **enlarges the set of prompts available
afterwards**. A model in which `P` is a fixed set up front cannot say that; `◁`
says it immediately, because composition is exactly the operation under which
one call's position determines the next call's available shapes.

**2. What does it do? A morphism.** It answers the model's prompts by issuing
prompts on other interfaces — the OS, the filesystem, the network, a subagent —
and translating the replies back into the response it owed. Control down, data
up. That is the definition, with nothing left over.

**3. What does it carry? A `ΔS`.** The working directory, the permission mode,
which tool schemas are loaded rather than deferred, the table of background
tasks. None of this is in the model's context, and the tell is that the model
must be *told* when it changes:

> `Shell cwd was reset to ~/git/gold/from-neil`

Being told is the signature of state one does not own. So the state is real, and
it is harness-side.

**The resolution** is already written down in `../federation/README.md`, about
federation members, and it applies verbatim:

> each member **has** a container and **is** a morphism: the container is its
> interface, the morphism is its behaviour.

The Claude Code harness *has* a container (what the model sees), *is* a morphism
(what it does to the world), and *carries* a `ΔS` (what it remembers between
calls). Put the three together and the framework already has the word: it is a
**state handler**, `ΔS ⊗ X ⟶ Y`, with `X` the interfaces it delegates into and
`ΔS` the session state it keeps.

**So the two senses of "harness" do not clash — they compose.** The Claude Code
harness *is* a harness in Ghani's sense, in the precise sense that it is the
thing holding the `ΔS` that the model does not hold. The equivocation dissolves
once you notice that the model and the harness were never candidates for the
same slot.

**Mai nafka minah.** If the harness were merely a container, the question "what
happens to the state between two tool calls?" would have no home in the
formalism, and the answer would be supplied silently by the implementation. As a
state handler it has a home: the writeback component of `bwd`, which is a thing
one can be right or wrong about. That is the practical difference, and it is
why the distinction is worth the words.

---

## The same four terms elsewhere

| here | the note | Kelvingrove (Julia) | stalin / tower (TypeScript) |
|---|---|---|---|
| container | container `(P,R)` | `Itf`, `AbstractItf` | the container type in `lib/algebra.ts` |
| handler / open agent | event handler | `Lens` (`fwd`/`bwd`) | morphism in `morphisms.ts` |
| stateful container `ΔS` | — | `Itf(S,S)` | — |
| state handler | — | `Wrkr` — "stateful morphism; state as `Itf(S,S) ⊗ D`" | `state.ts` (unverified) |
| tensor `⊗` | `⊠` | `ParallelItf`, `parallel` | `⊠` in `lib/algebra.ts` |
| product `×` | `×` | `PickItf`, `pick` | `×` in `lib/algebra.ts` |

`ΔS` and the state handler are *not* in the note. They come from MacBeth's third
document (`workers-state-via-tensor.pdf`, 15 September 2026), and Kelvingrove's
`Wrkr` is the same construction arrived at independently and given a type.

---

## Sources

- Neil Ghani, *Containers for Typed Agentic AI* — `programming-with-containers.pdf`
- MacBeth, Doc #3 — `workers-state-via-tensor.pdf`, and the covering mail
  `2026-09-15_Doc-3-workers-state-via-tensor_from-macbeth.txt`
- *My Harness as a Worker* — `my-harness-as-a-worker.pdf` (§1 the interface,
  §2 the state that is not in me)
- *Three container formalisms* — `../kg-notes/container-formalisms.pdf`
- `../kalvingrove/CLAUDE.md`, vocabulary map and the `×`/`⊗` trap
- `../federation/README.md`, "each member has a container and is a morphism"
