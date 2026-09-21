// questions.ts — the question corpus, and what a reply to a question may be.
//
// A question is authored by a user and answered by users, including its author:
// §3 of the brief requires that nobody may ask what they will not answer, so the
// thing a person contributes is not a question but the dependent pair
//
//     Sigma (q : Question). Reply q
//
// and reciprocity is the type rather than a rule enforced beside it. `Asked`
// below is that pair, and the reason it is one type rather than two fields is
// that `Reply q` genuinely depends on `q`: a rating is not an answer to a free
// text question and the checker should say so.
//
// The dependency is carried twice, as it is in voting/issues.ts — `ReplyFor<K>`
// at the type level and `legal(k, r)` at run time — because a reply arriving
// over the wire has no type. Keeping both honest is what type-tests.ts asserts.
//
// `Blank` is a position in EVERY fibre. Principle 3 says blank is data, and a
// partial map is not a morphism: if declining to answer were the absence of a
// reply rather than one of the replies, then `Question <| Reply` would not be a
// container and every composite built on it would be quietly partial. It is
// cheaper and more truthful to say that one of the things you may answer is
// nothing, and to record why.

export type QuestionId = string;
export type PersonId = string;

/** What kind of answer a question admits. The positions of `AskC` depend on
 *  this, which is the dependency `PosAt` exists to carry. */
export type Kind =
  | { tag: "Free" }
  | { tag: "Scale"; lo: number; hi: number }
  | { tag: "Choice"; options: readonly string[] };

export interface Question {
  readonly id: QuestionId;
  readonly kind: Kind;
  /** The text as its author wrote it. Never normalised — how a person phrases
   *  what they want to know is an act in the sense of Principle 2. */
  readonly prompt: string;
  readonly author: PersonId;
  /** Questions composed by the interviewer during narrowing enter the shared
   *  corpus (§4). They have an author — the person the narrowing was for — and
   *  this flag is how the corpus can tell an elicited question from a
   *  volunteered one when it comes to weighing it as an act. */
  readonly composed: boolean;
}

/** A reply. Which constructors are legal depends on the question's kind, except
 *  for `Blank`, which is legal everywhere. `why` is optional because a person
 *  who declines to explain declining has still told you something. */
export type Reply =
  | { tag: "Text"; value: string }
  | { tag: "Rating"; value: number }
  | { tag: "Pick"; option: string }
  | { tag: "Blank"; why?: string };

/** The type-level half of the dependency. Note `Blank` in every branch: it is
 *  a position of every fibre, not a fourth kind of question. */
export type ReplyFor<K extends Kind> = K extends { tag: "Free" }
  ? { tag: "Text"; value: string } | { tag: "Blank"; why?: string }
  : K extends { tag: "Scale" }
    ? { tag: "Rating"; value: number } | { tag: "Blank"; why?: string }
  : K extends { tag: "Choice" }
    ? { tag: "Pick"; option: string } | { tag: "Blank"; why?: string }
  : never;

/** The run-time half. A reply off the wire has no type; this is the only thing
 *  standing between the corpus and a rating of 11 on a scale of 5. */
export const legal = (k: Kind, r: Reply): boolean => {
  if (r.tag === "Blank") return true;
  switch (k.tag) {
    case "Free":
      return r.tag === "Text" && r.value.length > 0;
    case "Scale":
      return r.tag === "Rating" && Number.isFinite(r.value) &&
        r.value >= k.lo && r.value <= k.hi;
    case "Choice":
      return r.tag === "Pick" && k.options.includes(r.option);
  }
};

/** Sigma (q : Question). Reply q — the sign-up act of §3, and the unit the
 *  corpus is built from. The generic parameter is what makes it a real pair:
 *  `asked` below infers `K` from the question and checks the reply at that
 *  fibre, so a mismatched pair does not typecheck. */
export interface Asked<K extends Kind = Kind> {
  readonly question: Question & { kind: K };
  readonly reply: ReplyFor<K>;
}

export function asked<K extends Kind>(
  question: Question & { kind: K },
  reply: ReplyFor<K>,
): Asked<K> {
  return { question, reply };
}

// ── Answers held against a person ─────────────────────────────────────

/** What one person has said about one question. `at` exists because the count
 *  must be able to rise (Principle 7): a later reply that contradicts an
 *  earlier one is a revision, and the engine has to be able to see which came
 *  first in order to say that it is one. */
export interface Answer {
  readonly question: QuestionId;
  readonly reply: Reply;
  readonly at: number;
}

// ── The corpus, as a registry ─────────────────────────────────────────

export class Corpus {
  readonly byId: ReadonlyMap<QuestionId, Question>;
  constructor(list: readonly Question[]) {
    this.byId = new Map(list.map((q) => [q.id, q]));
  }
  get(id: QuestionId): Question | null {
    return this.byId.get(id) ?? null;
  }
  kind(id: QuestionId): Kind | null {
    return this.byId.get(id)?.kind ?? null;
  }
  get ids(): QuestionId[] {
    return [...this.byId.keys()];
  }
  get size(): number {
    return this.byId.size;
  }
  /** Every question this person wrote. By §3 they have answered all of them. */
  by(author: PersonId): Question[] {
    return [...this.byId.values()].filter((q) => q.author === author);
  }
  /** A corpus grows through use (§4): questions composed during narrowing join
   *  it. Returns a new corpus rather than mutating, so a narrowing run can be
   *  replayed against the corpus it actually saw. */
  with(...qs: readonly Question[]): Corpus {
    return new Corpus([...this.byId.values(), ...qs]);
  }
  /** Validate a reply against the question it claims to answer. Null means the
   *  question is unknown, which is a different failure from an illegal reply
   *  and is not worth collapsing into `false`. */
  admits(id: QuestionId, r: Reply): boolean | null {
    const k = this.kind(id);
    return k === null ? null : legal(k, r);
  }
}

// ── Comparison: the only thing the matcher may do with two replies ────

/** How far apart two replies to the SAME question are, in [0, 1], or `null`
 *  when the pair carries no information.
 *
 *  Two blanks return `null`, not 0. Agreeing to say nothing is not agreement,
 *  and scoring it as such would make the thinnest pairs look like the closest
 *  ones — which is precisely the failure the density measurement of Phase 2
 *  exists to make visible rather than to paper over. What a blank DOES carry is
 *  measured elsewhere, over the pattern of blanks across the corpus, not pair
 *  by pair.
 *
 *  A blank against an answer is likewise `null` here for the same reason: the
 *  information is in which questions each declines, not in this cell. */
export function distance(k: Kind, a: Reply, b: Reply): number | null {
  if (a.tag === "Blank" || b.tag === "Blank") return null;
  switch (k.tag) {
    case "Free":
      // Free text needs the oracle; there is no metric on prose and pretending
      // otherwise here would put a similarity score back at the centre of a
      // product whose §4 exists to say it is not one.
      return null;
    case "Scale": {
      if (a.tag !== "Rating" || b.tag !== "Rating") return null;
      const span = k.hi - k.lo;
      return span <= 0 ? 0 : Math.abs(a.value - b.value) / span;
    }
    case "Choice":
      if (a.tag !== "Pick" || b.tag !== "Pick") return null;
      return a.option === b.option ? 0 : 1;
  }
}
