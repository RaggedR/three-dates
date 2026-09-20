# Three Dates — design brief

**Status:** concept. Nothing built. This is a brief, not a plan: it states what the
product is for and which principles decide questions it does not answer. An agent
implementing it should be able to resolve novel design decisions by reading §2 and
asking which principle applies.

**Author:** Claude, with Robin Langer, 21 September 2026.

---

## 1. What this is

A dating application in which a person is shown **three** candidates, must meet all
three, and must choose one. Matching is performed by a language model that
interviews both sides over time — not by a similarity score over a fixed feature
vector.

The product exists because every major dating app earns revenue from users *not*
succeeding. Retention is the metric, so a product that works well destroys its own
user base, and the interface is built accordingly: infinite optionality, costless
rejection, no commitment. This product inverts each of those.

### Non-goals

- **Not a marketplace.** Users do not browse. There is no catalogue, no swiping, no
  search.
- **Not engagement-optimised.** Time-in-app is a cost, not a metric. The success
  condition is a deleted account.
- **Not a compatibility oracle.** The best available evidence (Joel et al. 2020,
  ~11,000 couples) is that pair-level relationship success is close to unpredictable
  from measured traits. We are not predicting marriages. We are predicting
  *worth meeting once*, which is a far lower bar and demonstrably beatable.

---

## 2. Principles

These decide everything else. When in doubt, apply them in order.

1. **Make the expensive thing the valuable thing.** Every act that carries
   information should cost something, because costless signals carry none. Writing a
   question is expensive. Being one of three is expensive. That expense *is* the
   signal, and it is a signal to the other person, not a constraint on the user.

2. **Elicit acts, not claims.** A self-description is cheap and unreliable. What a
   person chooses to ask, chooses to answer, and chooses to leave blank are acts.
   Prefer them.

3. **Blank is data.** Unanswered questions are not missing-at-random. Which
   questions a person declines to engage with is a revealed preference about what
   they are oriented toward, and must be modelled as signal rather than absence.

4. **Asynchronous by default.** A person may write or answer anything at any time
   and leave. The system must never require a session to be completed.

5. **Safety overrides commitment.** The commitment mechanisms in §5 exist to prevent
   frivolity. They must never make it costly to leave a situation a person feels
   unsafe in. Where these conflict, safety wins without exception.

6. **The end state is deletion.** Design every surface as though the user is trying
   to finish.

7. **Progress must be honest, including when it is discouraging.** The candidate
   count in §5 reports a real quantity. It must be permitted to rise. The moment it
   becomes a number that only falls, it is a progress bar wearing a candidate count's
   clothes, and users will work that out inside a week.

---

## 3. The user journey

**Sign-up.** Phone number only. The number is the identity, and reputation attaches
to it — history, completed meetings, no-show record. The cost of starting over is
not the price of a SIM; it is the loss of everything accumulated.

**The first act is generative, not selective.** Before seeing anything from anyone
else, the new user must:

1. **Write a question they want asked of a potential partner.** Free text.
2. **Answer their own question.**

The second requirement is the interesting half. It enforces reciprocity at the level
of the question: nobody may ask what they will not answer. It also reveals the
standard the asker holds themselves to, which is frequently more informative than
the answer itself.

**Then the system proposes.** The model reads the question the user wrote and
recommends questions submitted by *other* users that this person may want to answer.
The user answers what they like and ignores the rest (see Principle 3).

**Return at will.** Ask more. Answer more. There is no completion state and no
progress bar toward one. The corpus of a person grows for as long as they are
present.

---

## 4. The matching engine

This is the part that must not be built as a recommender, and the distinction is
concrete rather than stylistic.

A recommender scores similarity over a fixed feature space. It is passive: it
consumes whatever data exists and ranks. **This system is active.** Its central
operation is:

> Given the current candidate set, generate the question whose answer would most
> reduce uncertainty about which candidates remain.

That is sequential experimental design, and it is what a language model can do that
a matrix factorisation cannot. It can read free text, notice that two people are
circling the same concern in different vocabulary, and — decisively — **compose a
new question on demand** to resolve a specific ambiguity between specific people.

### The narrowing loop

1. Assemble a broad candidate pool — 10 to 100 — from existing answers.
2. Identify the largest uncertainty discriminating among them.
3. Propose one or a few new questions to the user addressing it.
4. Narrow. Repeat.
5. Terminate at three.

Questions generated during narrowing enter the shared corpus, so the question bank
grows through use.

### Question quality, handled automatically

User-submitted questions will include duplicates, jokes, and questions written to
select one specific person. Do not solve this with moderators. Rank questions by
**information gain**: a question everyone answers identically carries none and
sinks; a question that divides the population and predicts answers to other
questions rises. The corpus self-curates, and its shape becomes a live map of what
the community actually divides on.

---

## 5. The counter

Each time the user submits answers, they are told **how many potential matches they
currently have.** A hundred. Then sixty-seven. Then forty-one. Then twelve. They
keep answering and submitting until the number reaches three, and only then may they
proceed to meetings.

This is the mechanism that makes the rest of the product work, and it does four
things at once.

**It makes effort visibly pay.** The standing failure of questionnaire-based
matching is fatigue: a hundred questions that feel like a form. Here every submission
moves a number that is *about the user's own progress toward the goal*, not an
abstract compatibility score. OkCupid solved this partially by letting match
percentages sharpen as you answered; this is sharper, because the quantity is the
thing the user actually wants.

**It replaces an arbitrary gate with an earned one.** There is no "answer 200
questions to unlock." The threshold is that the system has learned enough about the
user to identify three people — which is a *meaningful* condition and a
self-justifying one. You cannot be matched before you are legible.

**It turns the cost into the mechanism.** Elsewhere in this brief, answering
questions is described as costly signalling — a filter for seriousness. The counter
makes that framing unnecessary. Answering is not the price of admission. It **is**
the narrowing. There is no toll; there is only the work.

**And it makes non-participation self-limiting without any punishment.** A user who
answers nothing, or very little, simply never reaches three. Nothing is withheld from
them and no penalty is applied. The system genuinely does not know who they should
meet. The gate is epistemic, not punitive — which is both true and a far better thing
to tell a user than "engage more."

### The count must be able to rise

See Principle 7. An answer that contradicts an earlier one, or reveals a preference
few people share, should be permitted to *increase* the number. Honesty requires it,
and so does resistance to gaming: a monotone-decreasing counter teaches users to
answer for the number rather than truthfully, which destroys the data the product
runs on.

### Discretion, and the one thing it owes the user

Narrowing is entirely at the model's discretion. There is no published rule, no
points, no formula to optimise against. That is correct — a legible rule is a rule
that gets played.

But discretion without reasons is the failure this brief should not reproduce. The
system should be able to say **what kind of thing it still does not know** — *"I
don't yet know how you feel about children"* — without exposing the mechanism. That
is reasons without appeal, which is imperfect and still far better than a number that
moves for unstated causes.

### Edge case to handle deliberately

A user with unusual preferences in a thin market may never reach three, no matter how
honestly they answer. That is the density problem of §9 surfacing at the level of one
person, and it must not be allowed to present as personal failure. The system knows
the difference between *I don't know enough about you* and *I know you well and there
are not three such people here*, and it owes the user the second sentence when it is
the true one.

## 6. The commitment mechanism

The user is shown three candidates. They must meet all three and choose one.

- If the chosen person also chooses them, the match is made and **both accounts
  should be closed**.
- If the chosen person chooses someone else, the user receives a new three.
- A user may not decline all three by preference. Doing so requires a new phone
  number and re-answering everything, which is deliberately expensive.

### The carve-out, which is not optional

Principle 5 applies here and overrides the above. **Declining for cause must be free
and must be easy**: safety concern, no-show, material misrepresentation, or anything
the user does not wish to explain. This is not a softening of the mechanism; it is a
precondition for it being permissible at all. A design that makes it costly to walk
away from a frightening meeting is a design that produces harm, and no amount of
signal quality justifies it.

The expense attaches to *indifference*, never to *refusal*.

---

## 7. The decision this brief takes: the three must be mutual

Robin's specification does not settle whether A appearing in B's three implies B
appears in A's. **It must.** Otherwise a small number of popular users are selected
by everyone, owe fifteen meetings, and leave — the failure mode the whole design
exists to avoid.

Consequence, and implementers should understand it before starting: the system is
therefore **not making individual recommendations**. It is constructing a global
assignment in which every participant holds exactly three mutual candidates. That is
a matching problem with quotas, closer to Gale–Shapley than to a ranking, and it has
architectural implications — matches cannot be computed per-user on demand, and the
narrowing loop must converge against a shared assignment rather than against one
person's preferences.

This is the hardest engineering problem in the product and it should be prototyped
first, before any interface exists.

---

## 8. Open questions

- **Cold start**, which is existential. Three from a pool of two hundred is worse
  than four hundred from two hundred thousand. Scarcity only works atop density, and
  acquiring density requires exactly the growth mechanics this product rejects.
  Every "slow dating" app has died here. *No answer proposed.*
- **Who pays, and when.** Retention cannot be the metric, so the charge must attach
  to the introduction. Charging at the point of the three is the obvious candidate
  and the least tested.
- **Cadence.** How long may a user sit on three unmet candidates before the
  assignment is released? Someone is waiting on them.
- **What "meeting" means**, and how it is confirmed without becoming surveillance.
- **Re-entry after a match ends.** The design closes accounts on success. People
  return.

## 9. Risks that kill it

1. **Density.** See above. This is the one.
2. **Revealed preference.** People say they want curation and behave as though they
   want optionality. Test this before building anything: three hundred people in one
   city, a spreadsheet, and a human doing the matching by hand.
3. **The commitment device reading as coercive.** Even with §5's carve-out, "you
   must choose one" is a sentence that will be quoted hostilely. The framing and the
   escape routes need to be right before launch, not after.
4. **Question corpus toxicity.** Free-text questions written by users and shown to
   strangers is an abuse surface. Information-gain ranking handles quality, not
   harm.

---

## 10. Prior art worth reading first

- **OkCupid**, pre-acquisition. User-submitted questions, your answer plus your
  preferred answer from a partner plus an importance weight. It worked; match
  percentage predicted conversation continuation. It was dismantled in favour of
  swiping for revenue reasons, not performance ones. This product is substantially a
  reconstruction of it with a business model that does not destroy it.
- **Coffee Meets Bagel** — one candidate per day; tested the scarcity premise.
- **Hinge** — "designed to be deleted" is this thesis as marketing, without the
  mechanism.
