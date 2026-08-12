const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MockDriveBackend,
  buildDevice,
  progressRevision,
  localEntity,
  seedCloud,
  setSyncMeta,
  currentEntry,
  clone
} = require('./support/autonomous-harness.cjs');

test('sealed devices have independent local/meta state while sharing only Mock Drive', async () => {
  const drive = new MockDriveBackend();
  const deviceA = await buildDevice({ drive, deviceId: 'DEVICE-A', progress: progressRevision(1) });
  const seed = await seedCloud(deviceA, progressRevision(1), 'R1');
  await setSyncMeta(deviceA, seed.key, {
    baseCloudVersionId: 'R1',
    lastKnownCloudVersionId: 'R1',
    localContentHash: seed.hash,
    dirty: false
  });

  const deviceB = await buildDevice({ drive, deviceId: 'DEVICE-B', progress: progressRevision(1) });
  await setSyncMeta(deviceB, seed.key, {
    baseCloudVersionId: 'R1',
    lastKnownCloudVersionId: 'R1',
    localContentHash: (await localEntity(deviceB)).contentHash,
    dirty: false
  });

  deviceA.state.progress = progressRevision(2);
  await setSyncMeta(deviceA, seed.key, {
    baseCloudVersionId: 'R1',
    lastKnownCloudVersionId: 'R1',
    localContentHash: (await localEntity(deviceA)).contentHash,
    dirty: true
  });
  await deviceA.runtime.sync.backupNow({ reason: 'Device A advances' });
  const cloudHead = currentEntry(deviceA, seed.key).currentVersionId;
  assert.notEqual(cloudHead, 'R1');

  const beforeB = clone(deviceB.state.progress);
  assert.deepEqual(beforeB, progressRevision(1));
  assert.equal((await deviceB.runtime.sync.analyze()).summary.rows[0].state, 'CLOUD_AHEAD');
  await deviceB.runtime.sync.checkCloud({ interactive: false });
  assert.deepEqual(clone(deviceB.state.progress), progressRevision(2));
  assert.equal((await deviceB.meta.get('formSyncMetaV2'))[seed.key].baseCloudVersionId, cloudHead);
  assert.equal(await deviceA.meta.deviceId(), 'DEVICE-A');
  assert.equal(await deviceB.meta.deviceId(), 'DEVICE-B');
  assert.notEqual(deviceA.meta.store, deviceB.meta.store);
});

test('a stale dirty device cannot overwrite a newer cloud descendant', async () => {
  const drive = new MockDriveBackend();
  const writer = await buildDevice({ drive, deviceId: 'WRITER', progress: progressRevision(1) });
  const seed = await seedCloud(writer, progressRevision(1), 'R1');
  await setSyncMeta(writer, seed.key, { baseCloudVersionId: 'R1', dirty: false, localContentHash: seed.hash });
  writer.state.progress = progressRevision(3);
  await setSyncMeta(writer, seed.key, { baseCloudVersionId: 'R1', dirty: true, localContentHash: (await localEntity(writer)).contentHash });
  await writer.runtime.sync.backupNow({ reason: 'Writer creates R2' });
  const cloudBefore = currentEntry(writer, seed.key);

  const stale = await buildDevice({ drive, deviceId: 'STALE', progress: progressRevision(2) });
  await setSyncMeta(stale, seed.key, {
    baseCloudVersionId: 'R1',
    lastKnownCloudVersionId: 'R1',
    localContentHash: (await localEntity(stale)).contentHash,
    dirty: true
  });
  const analysis = await stale.runtime.sync.analyze();
  assert.equal(analysis.summary.rows[0].state, 'DIVERGED');
  const result = await stale.runtime.sync.backupNow({ reason: 'must not overwrite' });
  assert.equal(result.uploaded, 0);
  assert.equal(currentEntry(stale, seed.key).currentVersionId, cloudBefore.currentVersionId);
  assert.equal((await stale.meta.get('formSyncMetaV2'))[seed.key].dirty, true);
});

test('offline and authentication failures preserve progress and pending dirty state', async () => {
  const drive = new MockDriveBackend();
  const device = await buildDevice({ drive, deviceId: 'OFFLINE', progress: progressRevision(1) });
  const seed = await seedCloud(device, progressRevision(1), 'R1');
  device.state.progress = progressRevision(4);
  await setSyncMeta(device, seed.key, {
    baseCloudVersionId: 'R1',
    lastKnownCloudVersionId: 'R1',
    localContentHash: (await localEntity(device)).contentHash,
    dirty: true
  });
  const expected = clone(device.state.progress);

  device.context.navigator.onLine = false;
  assert.equal(await device.runtime.sync.backupNow({ reason: 'offline' }), null);
  assert.deepEqual(clone(device.state.progress), expected);
  assert.equal((await device.meta.get('formSyncMetaV2'))[seed.key].dirty, true);

  device.context.navigator.onLine = true;
  device.auth.inject('FAIL_TOKEN_REFRESH');
  await assert.rejects(device.runtime.sync.backupNow({ reason: 'auth failure' }), /Authentication refresh failed/);
  assert.deepEqual(clone(device.state.progress), expected);
  assert.equal((await device.meta.get('formSyncMetaV2'))[seed.key].dirty, true);

  device.auth.recover();
  await device.runtime.sync.backupNow({ reason: 'auth recovered' });
  assert.equal((await device.meta.get('formSyncMetaV2'))[seed.key].dirty, false);
  assert.equal((await device.runtime.sync.analyze()).summary.rows[0].state, 'ALIGNED');
});

test('tampered cloud payload is rejected before valid local progress is replaced', async () => {
  const drive = new MockDriveBackend();
  const seedDevice = await buildDevice({ drive, deviceId: 'SEED', progress: progressRevision(5) });
  const seed = await seedCloud(seedDevice, progressRevision(5), 'R5');

  const receiver = await buildDevice({ drive, deviceId: 'RECEIVER', progress: progressRevision(1) });
  await setSyncMeta(receiver, seed.key, {
    baseCloudVersionId: 'R1',
    lastKnownCloudVersionId: 'R1',
    localContentHash: (await localEntity(receiver)).contentHash,
    dirty: false
  });
  const before = clone(receiver.state.progress);
  drive.inject('RETURN_CORRUPT_FILE', 'tamper-payload');
  await assert.rejects(
    receiver.runtime.sync.checkCloud({ interactive: false }),
    /checksum|size|corrupt|invalid/i
  );
  assert.deepEqual(clone(receiver.state.progress), before);
  assert.equal((await receiver.meta.get('formSyncMetaV2'))[seed.key].baseCloudVersionId, 'R1');
});

test('same formUid/count with the wrong installed QID set cannot accept cloud progress', async () => {
  const drive = new MockDriveBackend();
  const cloudProgress = progressRevision(5, { answerCount: 3 });
  cloudProgress.bundle.attempts[0].session.blocks[0].questionQids = ['QID-A', 'QID-B', 'QID-C'];
  const seedDevice = await buildDevice({
    drive,
    deviceId: 'QID-SEED',
    progress: cloudProgress,
    questionCount: 3,
    qids: ['QID-A', 'QID-B', 'QID-C'],
    bankHash: 'BANK-A'
  });
  const seed = await seedCloud(seedDevice, cloudProgress, 'R-QID');

  const localProgress = progressRevision(1, { bankHash: 'BANK-X', answerCount: 3 });
  localProgress.bundle.attempts[0].session.blocks[0].questionQids = ['QID-X', 'QID-Y', 'QID-Z'];
  const receiver = await buildDevice({
    drive,
    deviceId: 'QID-RECEIVER',
    progress: localProgress,
    questionCount: 3,
    qids: ['QID-X', 'QID-Y', 'QID-Z'],
    bankHash: 'BANK-X'
  });
  await setSyncMeta(receiver, seed.key, {
    baseCloudVersionId: 'R-OLD',
    lastKnownCloudVersionId: 'R-OLD',
    localContentHash: (await localEntity(receiver)).contentHash,
    dirty: false
  });
  const before = clone(receiver.state.progress);
  await assert.rejects(receiver.runtime.sync.checkCloud({ interactive: false }), /QID|question identity|incompatib/i);
  assert.deepEqual(clone(receiver.state.progress), before);
});

test('matching QIDs permit a safe cross-bankHash restore and rewrite revision hashes', async () => {
  const drive = new MockDriveBackend();
  const qids = ['QID-A', 'QID-B', 'QID-C'];
  const cloudProgress = progressRevision(5, { bankHash: 'BANK-A', answerCount: 3 });
  cloudProgress.bundle.attempts[0].session.blocks[0].questionQids = qids;
  const seedDevice = await buildDevice({ drive, deviceId: 'REV-SEED', progress: cloudProgress, questionCount: 3, qids, bankHash: 'BANK-A' });
  const seed = await seedCloud(seedDevice, cloudProgress, 'R-REV');
  const localProgress = progressRevision(1, { bankHash: 'BANK-B', answerCount: 3 });
  localProgress.bundle.attempts[0].session.blocks[0].questionQids = qids;
  const receiver = await buildDevice({ drive, deviceId: 'REV-RECEIVER', progress: localProgress, questionCount: 3, qids, bankHash: 'BANK-B' });
  await setSyncMeta(receiver, seed.key, {
    baseCloudVersionId: 'R-OLD',
    lastKnownCloudVersionId: 'R-OLD',
    localContentHash: (await localEntity(receiver)).contentHash,
    dirty: false
  });
  await receiver.runtime.sync.checkCloud({ interactive: false });
  assert.equal(receiver.state.progress.bundle.attempts[0].session.bankHash, 'BANK-B');
  assert.deepEqual(receiver.state.progress.bundle.attempts[0].session.blocks[0].questionQids, qids);
  assert.equal((await receiver.runtime.sync.analyze()).summary.rows[0].state, 'LOCAL_AHEAD_SAFE');
  await receiver.runtime.sync.backupNow({ reason: 'checkpoint compatible new form revision' });
  assert.equal((await receiver.runtime.sync.analyze()).summary.rows[0].state, 'ALIGNED');
  assert.deepEqual(Object.keys(drive.jsonByName(receiver.runtime.config.MANIFEST_FILE).forms), [seed.key]);
});

test('failed upload or manifest commit cannot become canonical', async () => {
  for (const fault of ['FAIL_NEXT_UPLOAD', 'FAIL_NEXT_MANIFEST_COMMIT']) {
    const drive = new MockDriveBackend();
    const device = await buildDevice({ drive, deviceId: fault, progress: progressRevision(1) });
    const seed = await seedCloud(device, progressRevision(1), 'R1');
    device.state.progress = progressRevision(6);
    await setSyncMeta(device, seed.key, {
      baseCloudVersionId: 'R1',
      lastKnownCloudVersionId: 'R1',
      localContentHash: (await localEntity(device)).contentHash,
      dirty: true
    });
    drive.inject(fault);
    await assert.rejects(device.runtime.sync.backupNow({ reason: fault }));
    assert.equal(currentEntry(device, seed.key).currentVersionId, 'R1', fault);
    assert.equal((await device.meta.get('formSyncMetaV2'))[seed.key].dirty, true, fault);
  }
});

test('a corrupt copied snapshot is rejected before history makes it restorable', async () => {
  const drive = new MockDriveBackend();
  const device = await buildDevice({ drive, deviceId: 'SNAPSHOT', progress: progressRevision(2) });
  const seed = await seedCloud(device, progressRevision(2), 'R2');
  await setSyncMeta(device, seed.key, {
    baseCloudVersionId: 'R2',
    lastKnownCloudVersionId: 'R2',
    localContentHash: seed.hash,
    dirty: false
  });
  drive.inject('RETURN_CORRUPT_FILE', 'tamper-payload');
  await assert.rejects(device.runtime.sync.createManualSnapshot(), /checksum|size|corrupt|invalid/i);
  const history = drive.jsonByName(device.runtime.config.HISTORY_MANIFEST_FILE);
  assert.ok(!history || history.snapshots.length === 0);
});

test('duplicate backup requests are idempotent after the first safe commit', async () => {
  const drive = new MockDriveBackend();
  const device = await buildDevice({ drive, deviceId: 'IDEMPOTENT', progress: progressRevision(1) });
  const seed = await seedCloud(device, progressRevision(1), 'R1');
  device.state.progress = progressRevision(7);
  await setSyncMeta(device, seed.key, {
    baseCloudVersionId: 'R1',
    localContentHash: (await localEntity(device)).contentHash,
    dirty: true
  });
  const first = await device.runtime.sync.backupNow({ reason: 'first request' });
  const head = currentEntry(device, seed.key).currentVersionId;
  const second = await device.runtime.sync.backupNow({ reason: 'duplicate request' });
  assert.equal(first.uploaded, 1);
  assert.equal(second.uploaded, 0);
  assert.equal(currentEntry(device, seed.key).currentVersionId, head);
});

test('rapid durable mutations coalesce into one trailing cloud upload', async () => {
  const drive = new MockDriveBackend();
  const device = await buildDevice({ drive, deviceId: 'DEBOUNCE', progress: progressRevision(1) });
  const seed = await seedCloud(device, progressRevision(1), 'R1');
  await setSyncMeta(device, seed.key, { baseCloudVersionId: 'R1', lastKnownCloudVersionId: 'R1', localContentHash: seed.hash, dirty: false });
  device.state.progress = progressRevision(8);
  const mutation = () => device.events.dispatchWindow({ type: 'stepsim:progress-write', detail: { filename: 'N-11_progress_save.json', formId: 'N-11', operation: 'write' } });
  await mutation();
  await new Promise(resolve => setTimeout(resolve, 300));
  await mutation();
  await new Promise(resolve => setTimeout(resolve, 500));
  await mutation();
  await new Promise(resolve => setTimeout(resolve, 2300));
  const progressUploads = drive.operationLog.filter(row => row.operation === 'UPLOAD_FILE' && row.name.includes('.form.'));
  assert.equal(progressUploads.length, 1);
  assert.equal((await device.runtime.sync.analyze()).summary.rows[0].state, 'ALIGNED');
});

test('block completion click queues a high-priority checkpoint without the normal debounce', async () => {
  const drive = new MockDriveBackend();
  const device = await buildDevice({ drive, deviceId: 'PRIORITY', progress: progressRevision(1) });
  const seed = await seedCloud(device, progressRevision(1), 'R1');
  device.state.progress = progressRevision(9);
  await setSyncMeta(device, seed.key, { baseCloudVersionId: 'R1', lastKnownCloudVersionId: 'R1', localContentHash: (await localEntity(device)).contentHash, dirty: true });
  await device.events.dispatchDocument({
    type: 'click',
    target: {
      closest(selector) { return selector.includes('#finishBlock') ? { id: 'finishBlock', dataset: {} } : null; }
    }
  });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.notEqual(currentEntry(device, seed.key).currentVersionId, 'R1');
  assert.equal((await device.runtime.sync.analyze()).summary.rows[0].state, 'ALIGNED');
});

test('100 deterministic randomized classifier seeds preserve lineage safety invariants', async t => {
  const device = await buildDevice({ deviceId: 'CLASSIFIER' });
  const classify = device.runtime.sync.classifyFormSync;
  let seed = 0x5eed1234;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let index = 0; index < 100; index++) {
    const base = random() > 0.35 ? `R${1 + Math.floor(random() * 4)}` : '';
    const cloudVersion = `R${1 + Math.floor(random() * 4)}`;
    const localHash = random() > 0.5 ? 'SAME' : `L${index}`;
    const cloudHash = random() > 0.5 ? localHash : `C${index}`;
    const dirty = random() > 0.5;
    const deleted = random() > 0.9;
    const local = { exists: !deleted, deleted, dirty, baseCloudVersionId: base, contentHash: localHash };
    const cloud = { currentVersionId: cloudVersion, checksum: cloudHash, deleted: false };
    const state = classify(local, cloud);
    await t.test(`seed-${index}-${seed.toString(16)}`, () => {
      if (deleted) assert.equal(state, base === cloudVersion ? 'DELETED_LOCAL_SAFE' : 'DELETE_CONFLICT');
      else if (localHash === cloudHash) assert.equal(state, 'ALIGNED');
      else if (!base) assert.equal(state, 'UNTRACKED_BOTH');
      else if (base === cloudVersion) assert.equal(state, 'LOCAL_AHEAD_SAFE');
      else if (dirty) assert.equal(state, 'DIVERGED');
      else assert.equal(state, 'CLOUD_AHEAD');
    });
  }
});
