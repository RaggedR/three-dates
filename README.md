# three-dates

A dating application in which you are shown **three** candidates, must meet all
three, and must choose one.

Matching is done by a language model that interviews both sides over time, not by a
similarity score over a fixed feature vector. Its central operation is: *given the
current candidate set, compose the question whose answer would most reduce
uncertainty about which candidates remain.*

Each time you submit answers you are told how many potential matches you currently
have — a hundred, then sixty-seven, then twelve. You keep answering until it reaches
three. The count is permitted to rise.

Concept stage. Nothing is built.

**[DESIGN-BRIEF.md](DESIGN-BRIEF.md)** is the entry point and is written to be read
by whoever implements it.
