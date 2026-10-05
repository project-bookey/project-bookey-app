import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports,
  );
  return module.exports;
}

let clock = 0;
const { createTransitionGuard } = load('src/navigation/transitionGuard.ts');
const guard = createTransitionGuard(() => clock);
let navigations = 0;
assert.equal(guard.run(() => navigations++), true);
assert.equal(guard.run(() => navigations++), false);
assert.equal(navigations, 1);
guard.start();
clock = 1100;
assert.equal(guard.run(() => navigations++), false, '애니메이션 중 반복 이동을 막는다');
guard.finish();
assert.equal(guard.run(() => navigations++), true, '전환 후 새 이동은 허용한다');
clock += 1001;
assert.equal(guard.run(() => navigations++), true, '전환 이벤트가 없어도 잠금이 풀린다');
guard.finish();
assert.throws(() => guard.run(() => { throw new Error('bad route'); }));
assert.equal(guard.run(() => navigations++), true, '이동 예외 뒤에도 다시 이동할 수 있다');

guard.finish();
const calls = [];
const original = Object.fromEntries(['push', 'navigate', 'back', 'dismiss', 'dismissTo', 'dismissAll', 'replace']
  .map((name) => [name, (...args) => calls.push([name, ...args])]));
original.canGoBack = () => true;
const { router } = load('src/navigation/index.ts', {
  'expo-router': { router: original, useRouter: () => original },
  react: { useMemo: (fn) => fn() },
  './transitionGuard': { navigationTransition: guard },
});
const href = { pathname: '/book/[id]', params: { id: '7' } };
router.push(href);
router.push(href);
assert.deepEqual(calls, [['push', href]]);
router.dismissTo('/messenger');
assert.deepEqual(calls.at(-1), ['dismissTo', '/messenger'], '기존 엽서함 경로의 리다이렉트는 전환 중에도 처리한다');
router.replace('/login');
assert.deepEqual(calls.at(-1), ['replace', '/login'], '인증 리다이렉트는 막지 않는다');
assert.equal(router.canGoBack(), true);
assert.equal(original.push === router.push, false, 'Expo의 라우터 자체를 변경하지 않는다');

let reads = 0;
const secureStore = {
  getItemAsync: async () => { reads++; return JSON.stringify({ accessToken: 'test', refreshToken: 'refresh' }); },
  setItemAsync: async () => {}, deleteItemAsync: async () => {},
};
const tokens = load('src/store/tokenStorage.ts', {
  '@react-native-async-storage/async-storage': {},
  'expo-secure-store': secureStore,
  'react-native': { Platform: { OS: 'ios' } },
});
await Promise.all(Array.from({ length: 20 }, () => tokens.getTokens()));
assert.equal(reads, 1, '동시 API 요청 20개가 키체인 읽기 하나를 공유한다');
await tokens.setTokens({ accessToken: 'updated', refreshToken: 'updated-refresh' });
assert.equal((await tokens.getTokens()).accessToken, 'updated');
assert.equal(reads, 1);
await tokens.clearTokens();
assert.equal(await tokens.getTokens(), null);

let resolveRead;
const racing = load('src/store/tokenStorage.ts', {
  '@react-native-async-storage/async-storage': {},
  'expo-secure-store': { ...secureStore, getItemAsync: () => new Promise((resolve) => { resolveRead = resolve; }) },
  'react-native': { Platform: { OS: 'ios' } },
});
const reading = racing.getTokens();
await racing.clearTokens();
resolveRead(JSON.stringify({ accessToken: 'old', refreshToken: 'old' }));
assert.equal(await reading, null, '로그아웃 뒤 늦게 끝난 키체인 읽기가 토큰을 되살리지 않는다');

const page = (content, hasNext = false) => ({ content, hasNext });
const card = (id, at) => ({ id, createdAt: at });
const inbox = [page([card(3, '2026-10-03')], true), page([card(1, '2026-10-01')])];
const sent = [page([card(2, '2026-10-02')])];
const requests = [];
const queries = load('src/components/messenger/postcardQueries.ts', {
  '@tanstack/react-query': {},
  '@/api/endpoints': { postcardApi: {
    inbox: async (index) => { requests.push(['inbox', index]); return inbox[index]; },
    sent: async (index) => { requests.push(['sent', index]); return sent[index]; },
  } },
});
assert.deepEqual(queries.mergePostcards(inbox[0], sent[0]).map((item) => item.id), [3]);
assert.deepEqual(queries.mergePostcards(page([card(3, '2026-10-03')]), sent[0]).map((item) => item.id), [3, 2]);
assert.equal((await queries.findPostcard(1)).id, 1);
assert.deepEqual(requests, [['inbox', 0], ['sent', 0], ['inbox', 1]], '캐시 없는 오래된 상세도 페이지를 찾아 연다');
assert.equal(await queries.findPostcard(999), null);

let saved;
const storage = {
  getItem: async () => saved ?? null,
  setItem: async (_key, value) => { saved = value; },
  removeItem: async () => { saved = null; },
};
const first = load('src/store/postcardOpened.ts', { '@react-native-async-storage/async-storage': storage });
await first.usePostcardOpened.persist.rehydrate();
first.usePostcardOpened.getState().markOpened(4, 100);
assert.equal(first.usePostcardOpened.getState().opened['4:100'], true);
assert.equal(first.usePostcardOpened.getState().opened['5:100'], undefined, '다른 계정의 읽음 상태와 섞이지 않는다');
const reopened = load('src/store/postcardOpened.ts', { '@react-native-async-storage/async-storage': storage });
await reopened.usePostcardOpened.persist.rehydrate();
assert.equal(reopened.usePostcardOpened.getState().opened['4:100'], true, '앱을 다시 열어도 읽음 상태를 복원한다');

let themeMode = 'light';
const assetMocks = {};
for (const name of ['light-closed', 'light-open', 'dark-closed', 'dark-open']) {
  const bytes = readFileSync(new URL(`../assets/optimized/postcard-envelopes/${name}.webp`, import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
  assert.equal(bytes.subarray(12, 16).toString(), 'VP8X');
  assert.ok(bytes[20] & 0x10, '봉투의 투명 배경을 보존한다');
  assert.equal((bytes.readUIntLE(24, 3) + 1) / (bytes.readUIntLE(27, 3) + 1), 1.5);
  assetMocks[`../../../assets/optimized/postcard-envelopes/${name}.webp`] = name;
}
const { PostcardEnvelope } = load('src/components/messenger/PostcardEnvelope.tsx', {
  ...assetMocks,
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  'react-native': { View: 'View', StyleSheet: { create: (styles) => styles } },
  '@/components/CachedImage': { CachedImage: 'Image' },
  '@/theme': { useTheme: () => ({ mode: themeMode }) },
});
for (const mode of ['light', 'dark']) {
  themeMode = mode;
  for (const opened of [false, true]) {
    const frame = PostcardEnvelope({ opened });
    assert.equal(frame.type, 'View', '원본 크기가 레이아웃을 밀어내지 않도록 프레임을 분리한다');
    assert.equal(frame.props.style.aspectRatio, 1.5);
    assert.equal(frame.props.style.overflow, 'hidden');
    const { props } = frame.props.children;
    assert.equal(props.source, `${mode}-${opened ? 'open' : 'closed'}`);
    assert.equal(props.contentFit, 'contain', '봉투 그림 전체가 잘리지 않고 보인다');
    assert.equal(props.style.position, 'absolute');
    assert.equal(props.style.width, '100%');
    assert.equal(props.style.height, '100%');
  }
}

const { CachedImage } = load('src/components/CachedImage.tsx', {
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
  'expo-image': { Image: 'ExpoImage' },
});
const cached = CachedImage({ source: 'test-image', contentFit: 'contain' });
assert.equal(cached.props.cachePolicy, 'memory-disk');
assert.equal(cached.props.transition, 0);
assert.equal(cached.props.allowDownscaling, true);
assert.equal(cached.props.contentFit, 'contain');

console.log('PASS: 중복 이동, 토큰 병렬 조회, 엽서 상세·읽음 복원, 봉투 크기·투명도, 이미지 캐시');
