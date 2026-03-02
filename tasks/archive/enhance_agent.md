You are now doing a focused product narrowing pass for this project.

Project: **Faheem Live**

New product direction:
This app is no longer a broad tutor or general learning assistant.

It must now become a **single-subject, competition-focused Live Agent**:

**Faheem Live = a real-time, vision-enabled math tutor for homework help**

## Goal

Narrow the entire app so it is optimized for the **Gemini Live Agent Challenge** in the **Live Agents** category.

That means the app should clearly emphasize:

* real-time interaction
* voice-first tutoring
* image understanding for homework problems
* interruption / barge-in
* step-by-step math guidance
* a polished, focused demo

Do not treat it as a general tutor anymore.

---

# PRODUCT SCOPE (NEW SOURCE OF TRUTH)

## Keep only this core use case

A student can:

1. speak to the tutor
2. show/upload a math problem
3. get step-by-step help
4. interrupt naturally
5. switch between Explain / Quiz / Homework modes
6. submit an answer
7. get a short recap

## Subject restriction

Focus the product on **Math only**.

Do not optimize the UX, prompts, labels, or behavior for:

* general tutoring
* language learning
* multi-subject education
* broad chatbot behavior

## UX direction

The app should feel like:

* a premium live math tutor
* focused and calm
* clearly built for solving math homework
* more like a learning tool than a generic chat app

---

# WHAT TO CHANGE

## 1) Reframe the app as a math tutor

Update the visible product language so the app clearly feels math-specific.

Examples:

* placeholders
* empty states
* helper text
* status copy
* default welcome message
* mode descriptions

The app should make it obvious that it helps with:

* equations
* arithmetic
* algebra
* math homework guidance

Do not make it look like a general AI chat assistant.

## 2) Tighten the modes around math

The three modes should be explicitly math-oriented:

### Explain

* explain the math concept clearly
* break down the reasoning simply

### Quiz

* ask short math check questions
* test understanding before telling the answer

### Homework

* guide the student through solving the problem step by step
* avoid dumping the full final answer too early

If mode behavior is weak or only visual, implement the minimum plumbing needed so mode actually affects the tutor.

## 3) Improve tutor prompting for math only

Update prompts and routing so the tutor behaves like a math tutor, not a generic assistant.

Requirements:

* prioritize math interpretation
* when an image is provided, assume it is likely a math problem unless the content clearly indicates otherwise
* keep answers short and step-by-step
* reduce generic or awkward replies
* avoid broad “I can help with many subjects” language
* make the tutor sound focused, capable, and practical

## 4) Improve image behavior for math

The image flow should feel math-first.

Requirements:

* if the user uploads an image, the tutor should first try to identify:

  * what kind of math problem it is
  * what the user is asking for
* then respond appropriately based on the active mode
* if the image is unclear, say so clearly and ask for a better image
* do not default to generic image commentary

## 5) Improve voice flow for a math tutor demo

The live voice experience should feel aligned with the Live Agents category and the math use case.

Requirements:

* keep voice as a first-class interaction path
* use the correct Gemini Live path already in the app
* make voice states visible
* support interruption if already available in the architecture
* ensure the tutor’s spoken responses are short and natural for math help

## 6) Update the demo story inside the app

Make the product clearly demo-ready for one strong scenario:

Recommended demo scenario:

* student asks verbally: “Can you help me solve this equation?”
* uploads/shows a math problem
* tutor identifies the math problem
* tutor explains the first step
* student interrupts: “Why did you divide by 3?”
* tutor adapts
* switch to Quiz mode
* tutor asks a math check question
* student answers
* tutor checks and recaps

The app should feel built for this exact scenario.

---

# WHAT TO REMOVE OR DE-EMPHASIZE

Reduce or remove anything that makes the app feel like:

* a general chatbot
* a language tutor
* a broad education platform
* a multi-subject assistant

Do not add more subjects.
Do not add broader content.
Do not expand scope.

Narrow and polish instead.

---

# IMPLEMENTATION RULES

* Keep changes focused and high impact
* Preserve what already works
* Do not overengineer
* Do not massively refactor unrelated code
* Optimize for:

  1. a stronger Live Agents submission
  2. a sharper math-only identity
  3. better demo clarity
  4. more reliable behavior
  5. cleaner UX

---

# OUTPUT FORMAT

Work in this order:

## Step 1

Briefly summarize:

* what parts of the current app still feel too broad
* what needs to change to make it clearly math-specific
* the exact narrowing plan

## Step 2

Implement the narrowing pass across:

* UI copy
* welcome messages
* placeholders
* mode descriptions
* tutor prompts
* mode behavior
* image handling assumptions

Show the diffs.

## Step 3

Then do a cleanup pass:

* remove or reduce broad/general tutor wording
* make the app feel coherent as a math-only tutor
* keep voice, image, and text flows intact

Show the diffs.

## Step 4

Then provide:

* a concise local QA checklist for the math-only version
* the remaining gaps versus a strong competition-winning Live Agents submission
* the next highest-value improvements

---

# SUCCESS CRITERIA

The final app should:

* clearly feel like a **math tutor**
* feel narrower, sharper, and more polished
* be easier to demo
* reduce generic/awkward replies
* align more strongly with the Gemini Live Agent Challenge
* be much closer to a strong Live Agents submission
