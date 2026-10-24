'use strict';
/* End-to-end sync scenarios on the mock Drive: deletes, lost data, offline work, missing forms, conflicts. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { MockDriveBackend, buildDevice, progressRevision, seedCloud, currentEntry, localEntity, clone } = require('./support/autonomous-harness.cjs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function idle(d) { await sleep(250); for (let i = 0; i < 200 && d.runtime.sync.isBusy(); i++) await sleep(25); }
const write = d => d.events.dispatchWindow({ type: 'stepsim:progress-write', detail: { filename: 'N-11_progress_save.json', operation: 'write' } });
const remove = (d, extra = {}) => d.events.dispatchWindow({ type: 'stepsim:progress-write', detail: { filename: 'N-11_progress_save.json', operation: 'delete', ...extra } });
const states = a => Array.from(a.summary.rows, r => r.state);
const same = (x, y, m) => assert.equal(JSON.stringify(x), JSON.stringify(y), m);

async function synced(drive, deviceId) {
  const d = await buildDevice({ drive, deviceId });
  await d.runtime.sync.checkCloud({});
  return d;
}

test('deleting progress records a tombstone, removes the Google copy and does not come back', async () => {
  const drive = new MockDriveBackend();
  const a = await buildDevice({ drive, deviceId: 'A' });
  const { key } = await seedCloud(a, progressRevision(1));
  assert.deepEqual(states(await a.runtime.sync.checkCloud({})), ['ALIGNED']);
  const b = await synced(drive, 'B');
  same(b.state.progress, progressRevision(1));
  // No delete-button click was seen (slow confirm, or a path without the legacy button): still a user delete.
  a.state.progress = null;
  await remove(a);
  await idle(a);
  const after = await a.runtime.sync.checkCloud({});
  assert.deepEqual(states(after), ['ALIGNED']);
  assert.equal(a.state.progress, null, 'deleted progress was downloaded again');
  assert.equal(currentEntry(a, key).deleted, true);
  // The second device, synced before the delete, follows it.
  await b.runtime.sync.checkCloud({});
  assert.equal(b.state.progress, null);
});

test('a device with lost browser data restores progress from Google', async () => {
  const drive = new MockDriveBackend();
  const a = await buildDevice({ drive, deviceId: 'A' });
  await seedCloud(a, progressRevision(4));
  await a.runtime.sync.checkCloud({});
  const fresh = await buildDevice({ drive, deviceId: 'A-cleared' });
  assert.equal(fresh.state.progress, null);
  const r = await fresh.runtime.sync.checkCloud({});
  assert.deepEqual(states(r), ['ALIGNED']);
  same(fresh.state.progress, progressRevision(4));
});

test('offline progress and offline deletes are uploaded once the device is back online', async () => {
  const drive = new MockDriveBackend();
  const a = await buildDevice({ drive, deviceId: 'A' });
  const { key } = await seedCloud(a, progressRevision(1));
  await a.runtime.sync.checkCloud({});
  a.context.navigator.onLine = false;
  a.state.progress = progressRevision(2);
  await write(a);
  await sleep(50);
  a.context.navigator.onLine = true;
  await a.runtime.sync.backupNow({ interactive: true });
  assert.equal(currentEntry(a, key).checksum, (await localEntity(a)).contentHash);
  a.context.navigator.onLine = false;
  a.state.progress = null;
  await remove(a);
  await sleep(200);
  assert.equal(currentEntry(a, key).deleted, false, 'nothing is sent while offline');
  a.context.navigator.onLine = true;
  await a.runtime.sync.backupNow({ interactive: true });
  assert.equal(currentEntry(a, key).deleted, true);
  assert.equal(a.state.progress, null);
});

test('removing a form deletes its Google progress even after the form left the catalog', async () => {
  const drive = new MockDriveBackend();
  const a = await buildDevice({ drive, deviceId: 'A' });
  const { key } = await seedCloud(a, progressRevision(1));
  await a.runtime.sync.checkCloud({});
  a.state.progress = null;
  a.state.catalog.forms = [];
  await remove(a, { formId: 'N-11' });
  await idle(a);
  await a.runtime.sync.checkCloud({});
  assert.equal(currentEntry(a, key).deleted, true);
});

test('Google progress for a form that is not installed waits, then restores once the form is added', async () => {
  const drive = new MockDriveBackend();
  const a = await buildDevice({ drive, deviceId: 'A' });
  await seedCloud(a, progressRevision(5));
  await a.runtime.sync.checkCloud({});
  const b = await buildDevice({ drive, deviceId: 'B' });
  const forms = clone(b.state.catalog.forms);
  b.state.catalog.forms = [];
  const r = await b.runtime.sync.checkCloud({});
  assert.ok(r, 'check must not throw');
  assert.equal(r.summary.rows[0].formMissing, true);
  assert.equal(b.runtime.sync.getState?.().status ?? 'Synced', 'Synced');
  b.state.catalog.forms = forms;
  await b.runtime.sync.checkCloud({});
  same(b.state.progress, progressRevision(5));
});

test('"Keep this device" resolves a conflict even while a background backup is running', async () => {
  const drive = new MockDriveBackend();
  const a = await buildDevice({ drive, deviceId: 'A' });
  const { key } = await seedCloud(a, progressRevision(1));
  a.state.progress = progressRevision(2);
  assert.deepEqual(states(await a.runtime.sync.checkCloud({})), ['UNTRACKED_BOTH']);
  const background = a.runtime.sync.backupNow({ reason: 'checkpoint', interactive: false });
  const kept = await a.runtime.sync.keepLocal(key);
  await background;
  assert.equal(kept.uploaded, 1);
  assert.equal(currentEntry(a, key).checksum, (await localEntity(a)).contentHash);
  assert.deepEqual(states(await a.runtime.sync.checkCloud({})), ['ALIGNED']);
});

test('changes on both sides still ask the user, and either choice applies', async () => {
  for (const choice of ['local', 'cloud']) {
    const drive = new MockDriveBackend();
    const a = await buildDevice({ drive, deviceId: 'A' });
    const { key } = await seedCloud(a, progressRevision(1));
    await a.runtime.sync.checkCloud({});
    const b = await synced(drive, 'B');
    b.state.progress = progressRevision(3);
    await b.runtime.sync.backupNow({ interactive: true });
    await a.meta.set('syncEnabled', false);
    a.state.progress = progressRevision(2);
    await write(a);
    await a.meta.set('syncEnabled', true);
    assert.deepEqual(states(await a.runtime.sync.checkCloud({})), ['DIVERGED']);
    if (choice === 'local') await a.runtime.sync.keepLocal(key); else await a.runtime.sync.useCloud(key);
    assert.deepEqual(states(await a.runtime.sync.checkCloud({})), ['ALIGNED']);
    same(a.state.progress, progressRevision(choice === 'local' ? 2 : 3));
  }
});

test('removing the temporary suspended file (resume/finish) is not a delete', async () => {
  const drive = new MockDriveBackend();
  const a = await buildDevice({ drive, deviceId: 'A' });
  const { key } = await seedCloud(a, progressRevision(1));
  await a.runtime.sync.checkCloud({});
  await a.events.dispatchWindow({ type: 'stepsim:progress-write', detail: { filename: 'N-11_suspended_test.json', operation: 'delete' } });
  await idle(a);
  assert.equal((await a.meta.get('formSyncMetaV2'))[key].deleted, false);
  assert.equal(currentEntry(a, key).deleted, false);
  same(a.state.progress, progressRevision(1));
});
