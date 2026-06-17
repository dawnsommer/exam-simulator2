# A19.3 full replacement

Built from the previous iPad browser-library package, with a deeper New Attempt rebuild.

Fixes:
- New Attempt setup now runs inside the actual iPad/browser-library Form Library closure, not an unreachable global wrapper.
- Stem highlights carry into new attempts using compact `stemHighlightAnchors`, stable `form:block:question` keys, original-block fallback, full-test fallback, and cross-attempt fallback.
- Explanation highlights remain static/shared review annotations across attempts using `explanationHighlightAnchorsByQuestionKey`.
- Retains iPad Browser Library storage, Qbank, attempts, suspension/resume, review-lock, backup, and UI behavior.
- Manifest, cache name, and browser title updated to A19.3.
