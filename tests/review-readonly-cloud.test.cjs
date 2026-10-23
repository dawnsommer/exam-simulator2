const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

test('passive Review mode cannot enter durable progress writers', () => {
  assert.match(html, /function passiveReview\(\)/);
  assert.match(html, /saveSessionToStorage=function\(\)\{if\(passiveReview\(\)\)return/);
  assert.match(html, /writeProgress=async function\(\)\{if\(passiveReview\(\)\)return/);
  assert.match(html, /writeActiveSessionNow=async function\(\)\{if\(passiveReview\(\)\)return/);
});

test('review highlight add/remove explicitly authorize one durable mutation', () => {
  const authorizations = html.match(/window\.__stepReviewMutationWrite=true/g) || [];
  // two for highlight add/remove, one for saving a finished Qbank test (its block is already locked for review)
  assert.equal(authorizations.length, 3);
  assert.equal((html.match(/var priorMutation=window\.__stepReviewMutationWrite; window\.__stepReviewMutationWrite=true;/g) || []).length, 2);
  assert.match(html, /if\(activeSession\.qbankMode\)\{ let saved; const priorMutation=window\.__stepReviewMutationWrite; window\.__stepReviewMutationWrite=true; try\{ saved=saveSessionToStorage\(\); \}/);
  assert.match(html, /finally\{ window\.__stepReviewMutationWrite=priorMutation; \}/);
});

test('form preparation no longer commits normalization during reads', () => {
  const a193 = html.slice(html.indexOf('async function a193PrepareBundle'), html.indexOf('async function a193FlushActive'));
  const v16 = html.slice(html.indexOf('async function v16PrepareForm'), html.indexOf('async function v16FlushCurrentFormBeforeNewAttempt'));
  assert.doesNotMatch(a193, /await writeBundle\(/);
  assert.doesNotMatch(v16, /await v16WriteRawBundle\(/);
});
