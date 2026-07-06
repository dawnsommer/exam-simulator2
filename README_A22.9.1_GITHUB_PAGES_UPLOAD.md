# Step Exam Simulator A22.9.1 iPad / GitHub Pages Root Upload

Base: A22.9 iPad package.

Changes in A22.9.1:
- Fixed iPad question-render crash caused by an undefined `tableChoices` variable in `renderQuestion()`.
- Preserved iPad `makeAnswerChoicesHtml()` rendering path for normal and table-like choices.
- Preserved universal stem-to-answer spacing without fixed answer-box height.
- Updated iPad service worker and manifest cache/version markers to A22.9.1 so GitHub Pages installs the corrected shell cleanly.
- OPFS/IndexedDB/library/import/export/suspend-resume code was not intentionally changed.

Upload the contents of this ZIP to the GitHub Pages repository root.
