const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto, randomUUID } = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

class MockDriveBackend {
  constructor() {
    this.files = new Map();
    this.sequence = 0;
    this.operationLog = [];
    this.faults = new Map();
  }

  inject(name, value = 1) {
    this.faults.set(name, value);
  }

  consume(name) {
    if (!this.faults.has(name)) return null;
    const value = this.faults.get(name);
    if (typeof value === 'number') {
      if (value <= 1) this.faults.delete(name);
      else this.faults.set(name, value - 1);
      return true;
    }
    this.faults.delete(name);
    return value;
  }

  now() {
    return new Date(Date.UTC(2026, 7, 12, 6, 0, 0) + this.sequence * 1000).toISOString();
  }

  addJson(name, value) {
    return this.addText(name, JSON.stringify(value), 'application/json');
  }

  addText(name, body, mimeType = 'application/json') {
    const id = `mock-${++this.sequence}`;
    const file = {
      id,
      name,
      body: String(body),
      modifiedTime: this.now(),
      size: String(Buffer.byteLength(String(body))),
      mimeType
    };
    this.files.set(id, file);
    return file;
  }

  byName(name) {
    return [...this.files.values()]
      .filter(file => file.name === name)
      .sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
  }

  jsonByName(name) {
    const file = this.byName(name)[0];
    return file ? JSON.parse(file.body) : null;
  }

  response(status, data, rawText, extraHeaders = {}) {
    const text = rawText === undefined ? JSON.stringify(data ?? {}) : String(rawText);
    const headers = new Headers(extraHeaders);
    return {
      status,
      ok: status >= 200 && status < 300,
      headers,
      json: async () => clone(data),
      text: async () => text,
      blob: async () => new Blob([text])
    };
  }

  record(operation, detail = {}) {
    this.operationLog.push({
      step: this.operationLog.length + 1,
      operation,
      ...clone(detail)
    });
  }

  async fetch(url, options = {}) {
    const parsed = new URL(url);
    const method = String(options.method || 'GET').toUpperCase();
    const pathname = parsed.pathname;

    if (pathname.endsWith('/about')) {
      this.record('AUTH_VALIDATE');
      return this.response(200, { user: { emailAddress: 'mock@example.test', displayName: 'Mock User' } });
    }

    if (pathname === '/drive/v3/files' && method === 'GET') {
      const query = parsed.searchParams.get('q') || '';
      const match = query.match(/name = '((?:\\'|[^'])*)'/);
      const name = match ? match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : '';
      if (name.includes('.manifest.json') && this.consume('FAIL_NEXT_MANIFEST_READ')) {
        this.record('READ_MANIFEST_FAILED', { name });
        throw new Error('Injected manifest read failure');
      }
      this.record(name.includes('.manifest.json') ? 'READ_MANIFEST' : 'LIST_FILES', { name });
      return this.response(200, {
        files: this.byName(name).map(({ body, ...file }) => clone(file))
      });
    }

    if (pathname === '/drive/v3/files' && method === 'POST') {
      const metadata = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
      const file = this.addText(metadata.name || 'unnamed', '', metadata.mimeType || 'application/json');
      this.record('CREATE_FILE', { id: file.id, name: file.name });
      return this.response(200, clone(file));
    }

    const copy = pathname.match(/^\/drive\/v3\/files\/([^/]+)\/copy$/);
    if (copy && method === 'POST') {
      const source = this.files.get(decodeURIComponent(copy[1]));
      if (!source) return this.response(404, { error: { message: 'missing source' } });
      const metadata = JSON.parse(options.body || '{}');
      const file = this.addText(metadata.name || source.name, source.body, source.mimeType);
      this.record('COPY_FILE', { sourceId: source.id, id: file.id, name: file.name });
      return this.response(200, clone(file));
    }

    const upload = pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (upload && method === 'PATCH') {
      const id = decodeURIComponent(upload[1]);
      const file = this.files.get(id);
      if (!file) return this.response(404, { error: { message: 'missing upload target' } });
      const isManifest = file.name.includes('.manifest.json');
      if (isManifest && this.consume('FAIL_NEXT_MANIFEST_COMMIT')) {
        this.record('COMMIT_MANIFEST_FAILED', { id, name: file.name });
        throw new Error('Injected manifest commit failure');
      }
      if (!isManifest && this.consume('FAIL_NEXT_UPLOAD')) {
        this.record('UPLOAD_FILE_FAILED', { id, name: file.name });
        throw new Error('Injected upload failure');
      }
      file.body = String(options.body || '');
      file.size = String(Buffer.byteLength(file.body));
      file.modifiedTime = this.now();
      this.record(isManifest ? 'COMMIT_MANIFEST' : 'UPLOAD_FILE', {
        id,
        name: file.name,
        size: Number(file.size)
      });
      return this.response(200, {
        id: file.id,
        name: file.name,
        modifiedTime: file.modifiedTime,
        size: file.size
      });
    }

    const fileMatch = pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fileMatch) {
      const id = decodeURIComponent(fileMatch[1]);
      if (method === 'DELETE') {
        if (this.consume('FAIL_NEXT_DELETE')) {
          this.record('DELETE_FILE_FAILED', { id });
          throw new Error('Injected delete failure');
        }
        this.files.delete(id);
        this.record('DELETE_FILE', { id });
        return this.response(204, {}, '');
      }
      if (method === 'GET' && parsed.searchParams.get('alt') === 'media') {
        const file = this.files.get(id);
        if (!file) return this.response(404, { error: { message: 'missing download target' } });
        if (this.consume('FAIL_NEXT_DOWNLOAD')) {
          this.record('DOWNLOAD_FILE_FAILED', { id, name: file.name });
          throw new Error('Injected download failure');
        }
        let body = file.body;
        const corrupt = file.name.includes('.manifest.json') ? null : this.consume('RETURN_CORRUPT_FILE');
        if (corrupt === 'invalid-json' || corrupt === true) body = '{"truncated":';
        if (corrupt === 'tamper-payload') {
          const parsedBody = JSON.parse(body);
          const block = parsedBody?.payload?.progress?.bundle?.attempts?.[0]?.session?.blocks?.[0];
          if (block?.answers?.length) block.answers[0] = block.answers[0] === 9 ? 8 : 9;
          body = JSON.stringify(parsedBody);
        }
        this.record('DOWNLOAD_FILE', { id, name: file.name, size: Buffer.byteLength(body), corrupt: !!corrupt });
        return this.response(200, null, body);
      }
    }

    throw new Error(`Unhandled MockDrive request: ${method} ${url}`);
  }
}

class MockAuthProvider {
  constructor(drive) {
    this.drive = drive;
    this.authorized = true;
    this.available = true;
    this.refreshFailures = 0;
    this.calls = [];
  }

  inject(name, count = 1) {
    if (name === 'AUTH_UNAVAILABLE') this.available = false;
    if (name === 'FAIL_TOKEN_REFRESH') this.refreshFailures += count;
    if (name === 'EXPIRE_AUTH_TOKEN') this.refreshFailures += 0;
  }

  recover() {
    this.available = true;
    this.authorized = true;
    this.refreshFailures = 0;
  }

  api() {
    return {
      initialize: async () => {
        this.calls.push({ operation: 'AUTH_INITIALIZE' });
        if (!this.available) throw new Error('Authentication service is unreachable. Local progress is safe.');
      },
      getState: () => ({ authorized: this.authorized }),
      validate: async () => {
        this.calls.push({ operation: 'AUTH_VALIDATE' });
        if (!this.available || this.refreshFailures > 0) {
          if (this.refreshFailures > 0) this.refreshFailures--;
          throw new Error('Authentication refresh failed. Local progress is safe.');
        }
        return { emailAddress: 'mock@example.test' };
      },
      connect: async () => { this.authorized = true; },
      disconnect: async () => { this.authorized = false; },
      driveFetch: async (url, options) => {
        if (!this.available) throw new Error('Authentication service is unreachable. Local progress is safe.');
        return this.drive.fetch(url, options);
      }
    };
  }
}

function memoryMeta(deviceId) {
  const store = new Map([['deviceId', deviceId]]);
  return {
    store,
    async get(key, fallback = null) { return store.has(key) ? clone(store.get(key)) : fallback; },
    async set(key, value) { store.set(key, clone(value)); return value; },
    async del(key) { store.delete(key); },
    async deviceId() { return store.get('deviceId'); }
  };
}

function eventSurface() {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const add = (map, type, fn) => {
    const list = map.get(type) || [];
    list.push(fn);
    map.set(type, list);
  };
  const dispatch = async (map, event) => {
    for (const fn of map.get(event.type) || []) await fn(event);
  };
  const element = () => ({
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  });
  const document = {
    readyState: 'loading',
    visibilityState: 'visible',
    head: element(),
    addEventListener(type, fn) { add(documentListeners, type, fn); },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement: element
  };
  return {
    document,
    addWindowListener(type, fn) { add(windowListeners, type, fn); },
    dispatchWindow(event) { return dispatch(windowListeners, event); },
    dispatchDocument(event) { return dispatch(documentListeners, event); }
  };
}

function runFile(context, file) {
  vm.runInContext(read(file), context, { filename: file });
}

function progressRevision(tag, { bankHash = 'BANK1', answerCount = 1 } = {}) {
  const answers = Array.from({ length: answerCount }, (_, index) => (index + tag) % 4);
  return {
    fileType: 'StepExamSimulatorV10ProgressBundle',
    saveVersion: '10.2',
    formSlot: 'N-11',
    bundle: {
      updatedAt: `2026-08-12T06:${String(tag).padStart(2, '0')}:00.000Z`,
      attempts: [{
        attemptId: 'ATTEMPT-1',
        session: {
          bankHash,
          updatedAt: `2026-08-12T06:${String(tag).padStart(2, '0')}:00.000Z`,
          blocks: [{
            total: answerCount,
            answers,
            firstAnswers: answers.map((value, index) => index ? value : 0),
            flagged: answers.map((_, index) => index % 3 === 0),
            struck: { 0: [2] },
            questionTime: answers.map((_, index) => 10 + index),
            stemHighlightAnchors: { 0: [{ start: 1, end: 4, quote: 'test' }] },
            answerChanges: [{ questionIndex: 0, from: 0, to: answers[0] }]
          }]
        }
      }]
    }
  };
}

async function buildDevice({
  drive = new MockDriveBackend(),
  deviceId = 'DEVICE-A',
  progress = null,
  bankHash = 'BANK1',
  formUid = 'n-11',
  questionCount = 1,
  qids = null,
  score = ''
} = {}) {
  const meta = memoryMeta(deviceId);
  const auth = new MockAuthProvider(drive);
  const events = eventSurface();
  const state = {
    catalog: {
      fileType: 'StepExamSimulatorV75Catalog',
      forms: [{
        id: 'N-11',
        formUid,
        qidSchemaVersion: 1,
        totalQuestions: questionCount,
        bankHash,
        threeDigitScore: score,
        updatedAt: '2026-08-12T06:00:00.000Z',
        questionIndex: (qids || Array.from({ length: questionCount }, (_, index) => `${formUid}-q${index + 1}`)).map((qid, index) => ({
          key: `${formUid}::${qid}`,
          qid,
          formUid,
          formId: 'N-11',
          blockIndex: 0,
          questionIndex: index
        }))
      }]
    },
    progress: clone(progress),
    suspended: null,
    qbank: null
  };
  const sandbox = {
    console,
    Blob,
    URL,
    URLSearchParams,
    Headers,
    TextEncoder,
    structuredClone,
    setTimeout,
    clearTimeout,
    crypto: { subtle: webcrypto.subtle, randomUUID },
    navigator: { onLine: true },
    document: events.document,
    confirm: () => true,
    prompt: () => '',
    alert: () => {},
    CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; },
    requestIdleCallback: undefined
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = (type, fn) => events.addWindowListener(type, fn);
  sandbox.window.dispatchEvent = event => { events.dispatchWindow(event); return true; };

  const context = vm.createContext(sandbox);
  runFile(context, 'js/sync-config.js');
  context.StepProgressSync.meta = meta;
  runFile(context, 'js/sync-merge.js');
  runFile(context, 'js/qid-migration.js');
  context.StepExamSyncBridge = {
    async ensureReady() { return true; },
    async flushActive() { return true; },
    runtime() { return { examVisible: false }; },
    async catalog() { return clone(state.catalog); },
    async readFormProgressText(id) { return id === 'N-11' && state.progress ? JSON.stringify(state.progress) : null; },
    async readFormSuspendedText(id) { return id === 'N-11' && state.suspended ? JSON.stringify(state.suspended) : null; },
    async readQbankText() { return state.qbank ? JSON.stringify(state.qbank) : null; },
    async writeFormProgressText(id, text, expectedHash) {
      assert.equal(id, 'N-11');
      assert.equal(expectedHash, bankHash);
      state.progress = JSON.parse(text);
      return true;
    },
    async writeFormSuspendedText(id, text, expectedHash) {
      assert.equal(id, 'N-11');
      assert.equal(expectedHash, bankHash);
      state.suspended = text == null ? null : JSON.parse(text);
      return true;
    },
    async deleteFormProgress(id) { assert.equal(id, 'N-11'); state.progress = null; return true; },
    async writeQbankText(text) { state.qbank = text == null ? null : JSON.parse(text); return true; },
    async setThreeDigitScore(id, value) {
      const record = state.catalog.forms.find(item => item.id === id);
      record.threeDigitScore = String(value || '');
      return true;
    },
    async refresh() { return true; }
  };
  runFile(context, 'js/sync-storage.js');
  context.StepProgressSync.auth = auth.api();
  runFile(context, 'js/progress-sync.js');
  await meta.set('syncEnabled', true);
  return {
    context,
    runtime: context.StepProgressSync,
    drive,
    auth,
    meta,
    state,
    events,
    bankHash,
    formUid,
    deviceId
  };
}

async function localEntity(device) {
  const local = await device.runtime.storage.localIndex({ flush: false, yieldBetween: true });
  return local.index[device.formUid];
}

async function seedCloud(device, progress, versionId = 'R1') {
  device.state.progress = clone(progress);
  const entity = await localEntity(device);
  const backup = device.runtime.storage.makeFormBackup(entity, {
    versionId,
    parentProgressRevisionId: null,
    updatedAt: '2026-08-12T06:00:00.000Z',
    deviceId: 'CLOUD-SEED',
    contentHash: entity.contentHash
  });
  const payloadFile = device.drive.addJson(`seed-${versionId}.json`, backup);
  device.drive.addJson(device.runtime.config.MANIFEST_FILE, {
    type: device.runtime.config.MANIFEST_TYPE,
    schemaVersion: 2,
    appId: 'exam-simulator2',
    updatedAt: '2026-08-12T06:00:00.000Z',
    forms: {
      [entity.key]: {
        formId: entity.formId,
        formUid: entity.formUid,
        bankHash: entity.bankHash,
        qidSchemaVersion: entity.qidSchemaVersion,
        questionCount: entity.questionCount,
        currentVersionId: versionId,
        progressRevisionId: versionId,
        parentProgressRevisionId: null,
        previousVersionId: null,
        driveFileId: payloadFile.id,
        previousDriveFileId: null,
        checksum: entity.contentHash,
        sizeBytes: Number(payloadFile.size),
        updatedAt: '2026-08-12T06:00:00.000Z',
        deviceId: 'CLOUD-SEED',
        deleted: false
      }
    },
    qbank: null
  });
  return { key: entity.key, hash: entity.contentHash, payloadFileId: payloadFile.id, versionId };
}

async function setSyncMeta(device, key, patch = {}) {
  await device.meta.set('formSyncMetaV2', {
    [key]: {
      baseCloudVersionId: '',
      lastKnownCloudVersionId: '',
      localContentHash: '',
      updatedAt: '2026-08-12T06:00:00.000Z',
      dirty: false,
      deleted: false,
      ...patch
    }
  });
}

function currentEntry(device, key) {
  return device.drive.jsonByName(device.runtime.config.MANIFEST_FILE)?.forms?.[key] || null;
}

module.exports = {
  MockDriveBackend,
  MockAuthProvider,
  buildDevice,
  progressRevision,
  localEntity,
  seedCloud,
  setSyncMeta,
  currentEntry,
  clone
};
