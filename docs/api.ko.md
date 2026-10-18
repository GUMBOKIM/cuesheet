# API 레퍼런스

[English](./api.md) | **한국어** · [전체 문서](./index.ko.md)

`cuesheet`가 export하는 전부입니다. 옵션, 인스턴스 메서드, 상태 형태, 핸들러, 요청 기록, 플러그인, 타입을
다룹니다. React 쪽 export는 [React 패널](#react-패널)에 있습니다.

**이 페이지에서**

- [`createCuesheet(options)`](#createcuesheetoptions)
- [인스턴스 메서드](#인스턴스-메서드)
- [`CueState`](#cuestate)
- [`CueHandler`](#cuehandler)
- [요청 기록](#요청-기록)
- [플러그인](#플러그인)
- [React 패널](#react-패널)
- [기타 export](#기타-export)

## `createCuesheet(options)`

인스턴스를 만듭니다. `start()`를 부르기 전까지는 아무것도 가로채지 않습니다.

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `handlers` | `CueHandler[]` | **필수** | 모킹할 API 목록. 만들 때 검사하고, 정의가 잘못되면 예외를 던집니다 |
| `defaultEnabled` | `boolean` | **필수** | 저장된 상태가 없을 때 cuesheet(전체 스위치)를 켤지 여부 |
| `baseUrl` | `string` | 없음 | API의 기본 URL |
| `storage` | `CueStorage` | 메모리 | 새로 고침해도 상태가 남도록 저장할 곳 |
| `log` | `boolean` | `true` | 가로챈 요청을 콘솔에 로그로 남길지 여부 |
| `expose` | `boolean \| string` | `true` | 인스턴스를 `window.__cuesheet__`나 지정한 이름으로 노출 |
| `record` | `boolean \| { limit?, bodies? }` | `true` (`limit: 100`, `bodies: true`) | 응답한 요청을 기록할지 여부 |
| `plugins` | `CuePlugin[]` | `[]` | 요청 파이프라인에 끼워 넣을 훅 |

- `defaultEnabled`: 저장된 값이 없을 때 전체 스위치를 켤지만 정합니다. 핸들러는 어느 쪽이든 전부 켜진
  채로 시작합니다. 코어는 자기가 어떤 환경에서 도는지 모르기 때문에 필수입니다.
- `baseUrl`: 지정하면 핸들러 URL을 상대 경로로 쓸 수 있고, 오프라인은 이 URL로 가는 요청만
  실패시킵니다. `/api` 같은 경로(개발 프록시 뒤)는 페이지의 origin을 기준으로 풀고, 호스트가 대문자이거나
  기본 포트가 붙어 있어도 일치합니다. URL도 경로도 아닌 값이면 인스턴스를 만들 때 예외를 던집니다.
- `storage`: `window.localStorage`, `sessionStorage`를 그대로 넣으면 됩니다. 아래
  [저장소](#저장소)를 참고하세요.
- `record`: `limit`은 0 이상의 정수이고, `0`이면 하나도 남기지 않습니다(`waitForRequest()`는 그래도
  resolve). `false`는 `{ limit: 0, bodies: false }`처럼 하나도 남기지 않고 본문도 읽지 않지만,
  `waitForRequest()`와 `subscribeRecords()`는 그대로 동작합니다.

> [!IMPORTANT]
> `defaultEnabled`는 환경을 가르는 스위치가 아닙니다. `?cue=` 링크(예: `?cue=on`)와 저장된 상태가 이
> 값보다 우선하니, `defaultEnabled: false`여도 누구나 cuesheet를 켤 수 있습니다. 프로덕션에서 빼려면
> 아예 불러오지 마세요. 빌드 시점 조건 안에서 동적 import하면
> 됩니다([프로덕션에서 빼기](./getting-started.ko.md#프로덕션에서-빼기) 참고).

선택 옵션은 모두 `undefined`도 받습니다. 그래서 `exactOptionalPropertyTypes`를 켜 두어도
`storage: typeof window === 'undefined' ? undefined : window.localStorage`처럼 조건부 값을 넘길 수 있습니다.

## 인스턴스 메서드

### 라이프사이클

| 메서드 | 설명 |
|---|---|
| `applyUrlParams()` | 현재 URL의 `?cue=`를 적용하고 주소창에서 그 항목만 지웁니다. `start()`보다 먼저 호출하세요. 읽을 수 있는 항목이 하나도 없는 값(오타, `off`가 아닌 `?cue=OFF` 등)은 경고만 남기고 상태를 바꾸지 않습니다 |
| `start()` | `fetch` / `XMLHttpRequest` 가로채기를 시작하고 시계를 설치합니다 |
| `stop()` | 가로채기를 멈추고 `fetch`, `XMLHttpRequest`, `Date`를 원래대로 돌려놓습니다 |

- `applyUrlParams()`: 다른 쿼리 파라미터는 한 글자도 바꾸지 않습니다.
- `start()`: 다시 불러도 아무 일도 없습니다. 브라우저 밖(SSR, Node)에서는 경고만 남깁니다. 한 번에 한 인스턴스만 가로챕니다. 다른 인스턴스를 시작하면 돌던 것은 멈추고 `window.__cuesheet__`도 새 인스턴스로 옮겨 갑니다(만들기만 하고 시작하지 않은 인스턴스는 핸들을 가져가지 않습니다). 멈춘 인스턴스의 `patch()` / `select()` / `reset()`은 다시 `start()`할 때까지 경고만 남기고 무시됩니다. 한 페이지에서 1.0.0과 이후 버전 사본이 함께 돌면, 두 번째 인스턴스가 가로채지 못하던 예전 문제가 다시 생깁니다.

### 상태

| 메서드 | 설명 |
|---|---|
| `select(id, scenario)` | 시나리오를 고르고 그 핸들러를 켭니다. 모르는 id나 시나리오를 받으면 예외를 던집니다 |
| `patch(partial)` | 넘긴 부분(아래의 `CuePatch`)만 바꾸고, 모든 단계에서 병합합니다 |
| `getState()` | 전체 상태를 읽습니다 |
| `reset()` | 기본값으로 되돌립니다 |
| `subscribe(listener)` | 무엇 때문이든 상태가 바뀔 때마다 호출됩니다. 구독 해제 함수를 반환합니다 |
| `replaceHandlers(handlers)` | 핸들러 목록을 교체합니다. `handlers`와 똑같이 검사합니다 |

- `select()`:
  - 예외를 던질 때 쓸 수 있는 값을 담아 알려 줍니다.
  - cuesheet 자체를 켜지는 않습니다. cuesheet가 꺼져 있으면 경고를 남기고, 고른 시나리오는 켜진 뒤에
    적용됩니다.
  - `CueRegistry`를 선언했다면 리터럴 id와 시나리오만 받습니다. id와 시나리오가 그냥 `string`인 직접 만든
    UI에서는 대신 `patch()`를 쓰고 타입을 단언하세요.
    `patch({ api: { [id]: { enabled: true, scenario } } as ApiPatch })`
- `patch()`: `CueRegistry`를 선언했다면 `select()`처럼 핸들러 id와 핸들러별 시나리오 이름을 컴파일 시점에
  검사합니다. 실행 중에 쓸 수 없는 값은 콘솔 경고와 함께 무시하고, 나머지는 적용합니다
  ([`patch()`의 병합 방식](#patch의-병합-방식) 참고).
- `getState()`: 무언가 바뀌기 전까지 같은 객체를 반환합니다.
- `subscribe()`: 리스너는 이제 `getState()`가 반환할 객체를 받습니다.
- `replaceHandlers()`: 고른 시나리오는 id 기준으로 유지하고, 사라진 시나리오는 첫 번째 시나리오로
  돌아갑니다.

### 탐색과 공유

| 메서드 | 설명 |
|---|---|
| `getCatalog()` | 모든 핸들러의 `Record<id, CueEntry>`. 경로순 정렬(형태는 아래 참고) |
| `help()` | 등록된 핸들러, 현재 상태, 호출할 핸들을 담은 짧은 텍스트 요약 |
| `toShareParam()` | 현재 상태를 `?cue=` 값으로 반환. 예: `on,getCoupons:Empty` |
| `toShareUrl()` | 현재 URL에 그 값을 붙인 URL. 다른 쿼리 파라미터는 쓰여 있던 그대로 유지됩니다 |

- `help()`는 인스턴스가 노출된 핸들 이름을 알려 줍니다. `expose: '__qa__'`면 `window.__qa__`, 노출하지
  않았다면 `cuesheet`입니다.
- cuesheet가 꺼져 있으면 `help()`는 모든 핸들러가 실제 서버로 간다는 것과, 켜면 각각 무엇으로
  응답할지를 보여 줍니다.

```ts
// getCatalog()가 핸들러마다 하나씩 반환
interface CueEntry {
  label: string
  method: string                                  // 첫 번째 시나리오의 메서드. http.all()이면 'ALL'
  path: string
  pages?: string[]
  scenarios?: { value: string; label: string }[]  // label ?? value. 응답이 하나뿐인 핸들러에는 없음
}
```

### 기록 메서드

| 메서드 | 설명 |
|---|---|
| `getRecords(matcher?)` | 응답한 요청의 기록을 `matcher`로 걸러 오래된 순으로 반환합니다 |
| `clearRecords()` | 기록을 비웁니다 |
| `waitForRequest(matcher?, { timeout? })` | **호출한 뒤에** 들어오는 첫 번째 일치 기록으로 resolve합니다(matcher가 없으면 아무 기록이나) |
| `subscribeRecords(listener)` | 기록이 추가될 때마다 호출됩니다. 구독 해제 함수를 반환합니다 |

`waitForRequest()`는 `timeout`(기본값 5000 ms, 최대 60000 ms — `Infinity`는 60초 동안 기다림)이 지나면 reject합니다.

## `CueState`

```ts
interface CueState {
  enabled: boolean
  api: Record<string, { enabled: boolean; scenario?: string }>   // scenario 미지정 = 첫 번째
  delay: { min: number; max: number }                             // ms 단위, 0/0 = 지연 없음
  time: { now: string; mode: 'frozen' | 'running' } | null        // null = 실제 시간
  network: { offline: boolean }
}

// patch()가 받는 값. 모든 단계가 선택이고, 현재 상태에 병합됨
interface CuePatch {
  enabled?: boolean
  api?: ApiPatch
  delay?: Partial<{ min: number; max: number }>
  time?: { now: string; mode: 'frozen' | 'running' } | null
  network?: Partial<{ offline: boolean }>
}

// 핸들러 하나에 대한 patch
interface ApiSettingPatch<Scenario extends string = string> {
  enabled?: boolean
  scenario?: Scenario | undefined   // undefined = 첫 번째로 돌아감
}

// 핸들러 id가 키. `CueRegistry`를 선언했다면 { [Id in HandlerId]?: ApiSettingPatch<ScenarioOf<Id>> }
type ApiPatch = Record<string, ApiSettingPatch>
```

### `enabled`와 `api`

- `enabled`는 전체 스위치입니다. 핸들러는 기본으로 전부 켜져 있어서, 다른 설정이 없으면 cuesheet를
  켜는 것만으로 모든 API가 모킹됩니다.
- 껐다가 다시 켜면(패널, `patch({ enabled })`) 다른 설정은 그대로 이어지고, `?cue=on`은 기본값에서 새로
  시작합니다.
- 핸들러 하나를 끄려면 `api[id].enabled: false`입니다.

### `patch()`의 병합 방식

- 핸들러 항목에서 넘기지 않은 필드는 그대로 남습니다. 그래서
  `patch({ api: { getCoupons: { enabled: false } } })`로 껐다가 `{ enabled: true }`로 다시 켜도 시나리오가
  유지됩니다.
- `delay`와 `network`도 필드 단위로 병합합니다.
- `{ api: { getCoupons: { scenario: undefined } } }`는 첫 번째 시나리오로 돌아갑니다.
- `patch()`가 쓸 수 없는 값은 콘솔 경고와 함께 무시하고, 나머지 변경은 그대로 적용합니다(`select()`는
  대신 예외를 던집니다).
  - 모르는 핸들러 id나 시나리오 이름
  - 객체가 아닌 핸들러 항목
  - 잘못된 `time`(시계는 그대로 유지)
  - 음수이거나 숫자가 아닌 `delay`(지연은 그대로 유지)
  - 불리언이 아닌 `enabled`나 `network.offline`(스위치는 그대로 유지)
- 실행 중에야 알 수 있는 id(직접 만든 UI)는 타입을 단언하세요. `{ [id]: { scenario } } as ApiPatch`

### 지연

- 지연은 cuesheet가 응답하거나 끊은 요청에 적용됩니다. 실제 네트워크로 나가는 요청에는 이미 실제 지연이
  있으니 적용하지 않습니다.
- 그래서 offline로 끊는 요청도 지연을 먼저 기다린 뒤 실패합니다. 실제로 끊긴 연결처럼 동작하니, 에러가
  뜨기 전의 로딩 화면도 그대로 확인할 수 있습니다.
- 지연은 밀리초 단위 정수입니다. 소수는 반올림하니, 링크에 담을 수 없는 상태는 생기지 않습니다.
- `max`가 `min`보다 작으면 `min`으로 올립니다.
- 지연 중에 요청을 abort하면(fetch의 `AbortSignal`, `xhr.abort()`, axios 취소) 바로 기다림을 멈춥니다.
  요청은 실패하고 기록에 남지 않습니다. abort한 XHR은 `abort` 대신 `error` 이벤트로 끝납니다.

### 시간

- 시간은 `Date.now()`와 인자 없는 `new Date()`를 대체합니다. `new Date('2026-01-01')`처럼 날짜를 직접
  넘기면 영향이 없습니다.
- `time.now`는 ISO(`toISOString()`)로 저장하니, `patch()`에 `'2026-01-31 09:00'`처럼 느슨한 형식을 넘겨도
  공유 링크를 열면 같은 시각이 됩니다.

> [!NOTE]
> `start()` 전에 원래 `Date`를 잡아 둔 코드(`const now = Date.now`, 먼저 평가된 `class X extends Date`)와
> 인자 없는 `Intl.DateTimeFormat#format()` 같은 엔진 내부 동작은 실제 시간을 그대로 씁니다.

### 오프라인

오프라인은 브라우저와 같은 `TypeError: Failed to fetch`로 요청을 실패시킵니다. `baseUrl`을 지정했다면
그 URL로 가는 요청만, 아니면 가로챈 요청이 전부 실패합니다.

### 저장소

- 상태는 메모리에 있고, 바뀔 때마다 `storage`에도 써 두어 새로 고침해도 남습니다. 전부 `cuesheet:state`
  키 하나에 들어갑니다.
- 저장에 실패해도(시크릿 모드, 용량 초과, sandbox iframe) 새로 고침 전까지는 전부 그대로 동작합니다.
- 탭마다 상태를 따로 가지고, 탭이 로드될 때 저장소에 있던 값이 이깁니다.
- 저장된 값이 깨져 있으면 필드마다 따로 기본값으로 돌아갑니다.
- `cuesheet.storage`는 이 인스턴스가 실제로 쓰는 저장소(넘긴 것, 없으면 메모리)입니다. 패널이 열림 상태를
  기억할 때도 같은 저장소를 쓰므로, 저장소 교체는 한 곳에서 끝납니다.

#### 다른 저장소 쓰기

`CueStorage`는 메서드 두 개뿐이고 둘 다 Promise를 반환해도 되므로, `localStorage`뿐 아니라
실제 DB, HTTP API도 그대로 들어맞습니다.

```ts
interface CueStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
}
```

`createMemoryStorage()`는 cuesheet가 저장소가 없을 때 쓰는 메모리 스토어입니다. 상태를 브라우저 저장소에
아예 남기고 싶지 않다면 직접 넘기세요.

> [!IMPORTANT]
> 비동기로 답하는 저장소는 앱이 부팅되기 전에 읽어올 수 없습니다. 그래서 상태는 기본값에서 시작하고, 저장된
> 값은 한 틱 뒤에 적용되며 구독자에게 알립니다 — 화면이 기본값으로 한 번 그려질 수 있다는 뜻입니다. 그 사이
> 바뀐 값이 이기므로 `?cue=` 링크가 늦게 도착한 읽기에 덮이지는 않습니다. 상태를 확실히 고정하려면 여전히
> `?cue=`로 진입하는 쪽이 안전합니다.

## `CueHandler`

```ts
interface CueHandler {
  id: string                                   // 고유값. 상태의 키
  label: string                                // 패널에 표시
  path: string                                 // 패널과 카탈로그에 표시, 정렬 기준
  pages?: string[]                             // 이 핸들러를 쓰는 라우트. 패널의 페이지 필터에 사용
  handler: HttpHandler | { scenario: string; label?: string; handler: HttpHandler }[]
}
```

- 시나리오의 `label`은 패널에 보이는 이름입니다(기본값은 시나리오 이름). 상태, 링크, `select()`에서
  쓰는 값은 그대로 `scenario` 이름입니다.
- 매칭은 `path`가 아니라 MSW 핸들러의 URL로 합니다. [핸들러](./handlers.ko.md#매칭과-baseurl)를
  참고하세요.

## 요청 기록

```ts
interface CueRecord {
  requestId: string
  method: string
  url: string            // 전체 URL
  path: string           // 경로 + 쿼리
  handlerId?: string
  scenario?: string      // 실제로 응답한 시나리오(고르지 않았다면 첫 번째). 응답이 하나뿐인 핸들러에는 없음
  status: number         // 요청이 실패한 경우 0
  error?: string
  durationMs: number     // 지연 포함
  startedAt: number      // performance.now(). 시계와 무관
  requestBody?: unknown
  responseBody?: unknown
}

interface RecordMatcher {
  handlerId?: HandlerId    // CueRecord.handlerId와 같은 이름
  scenario?: ScenarioName  // 실제로 응답한 시나리오. handlerId를 주면 그 핸들러의 시나리오만
  method?: string
  path?: string | RegExp   // 문자열 = 부분 문자열 일치
  status?: number
  failed?: boolean         // true = 오프라인 모드가 끊은 요청. 4xx/5xx와 HttpResponse.error()는 "failed"가 아님
}
```

> [!TIP]
> matcher에 이 밖의 키가 있으면 모든 기록과 조용히 일치하는 대신 예외를 던집니다(`waitForRequest()`는
> reject). 흔한 실수는 `{ id }`인데, 이때 오류 메시지가 `handlerId`를 쓰라고 알려 줍니다.

본문과 기록은 이렇게 남습니다.

- 본문은 cuesheet가 응답한 요청에서만 읽고, 실제 네트워크로 나간 요청은 읽지 않습니다.
- 본문은 최대 1 MiB까지, 길어야 1초 동안만 읽습니다. 그때까지 끝나지 않은 스트리밍 본문은 받은
  데까지만 `…`를 붙여 기록합니다.
- Server-Sent Events(`text/event-stream`) 응답은 본문 없이 기록합니다.
- 기록은 본문을 다 읽은 뒤에 추가되니, `waitForRequest()`나 폴링으로 기다리세요.
- `waitForRequest()`는 호출한 뒤에 보낸 요청만 셉니다. 그 전에 보낸 요청의 기록이 나중에 들어와도
  마찬가지입니다.

## 플러그인

```ts
interface CuePlugin {
  onRequest?(context): unknown                            // 반환값은 아래 두 훅으로 전달
  onResponse?(context, response, carried): void
  onError?(context, error, carried): void                 // cuesheet가 요청을 실패시켰을 때
}
```

- `context`에는 `requestId`, `request`, `startedAt`이 들어 있습니다.
- `onRequest`는 cuesheet가 응답 방법을 정하기 전에, 가로챈 모든 요청에서 실행됩니다. 결국 실제
  네트워크로 나갈 요청과 cuesheet가 꺼져 있을 때의 요청까지 포함하니 가볍게 유지하세요.
- `onResponse`와 `onError`는 cuesheet가 응답했거나 실패시킨 요청에서만, 앱이 응답이나 실패를 이미 받은
  뒤에 실행됩니다. 그래서 여기서 본문을 읽어도 (스트리밍) 응답을 붙잡지 않습니다.
- 요청 본문도 여기서 `context.request.clone()`으로 읽으세요.
- 이때 핸들러가 응답했다면 `context.meta`(`CueResolutionMeta`)에 `{ handlerId, scenario }`가 들어 있고,
  아니면(예: 오프라인) `undefined`입니다.
- 플러그인 하나가 예외를 던져도 요청과 나머지 플러그인은 계속 진행됩니다.

> [!WARNING]
> `onResponse`가 받는 `response`는 끝나지 않을 수도 있는 스트림의 복사본입니다. 읽든지 취소하세요
> (`response.body?.cancel()`). 그냥 두면 스트림이 보내는 내용이 전부 쌓입니다.

## React 패널

`@cuesheet/react`가 조작 패널을 export합니다. 앱 루트에 하나만 두면 됩니다.

```tsx
import { CuesheetPanel } from '@cuesheet/react'

<CuesheetPanel cuesheet={cuesheet} pathname={location.pathname} />
```

프로덕션 빌드에서 빼려면 인스턴스와 같은 개발 환경 조건 뒤에서 불러오고, 인스턴스가 있을 때만 그립니다.

```tsx
const CuesheetPanel = import.meta.env.DEV
  ? lazy(() => import('@cuesheet/react').then((module) => ({ default: module.CuesheetPanel })))
  : undefined

{CuesheetPanel !== undefined && cuesheet !== undefined && (
  <Suspense fallback={null}>
    <CuesheetPanel cuesheet={cuesheet} />
  </Suspense>
)}
```

> [!IMPORTANT]
> 패널은 이 동적 import로만 불러오세요. `import { CuesheetPanel } from '@cuesheet/react'`로 정적 import하면 그리지 않더라도 패널이 프로덕션 번들에 남습니다.

| prop | 설명 |
|---|---|
| `cuesheet` | `createCuesheet()`로 만든 인스턴스 |
| `pathname` | 현재 경로. "이 페이지만" 필터가 생기고 핸들러의 `pages`로 API를 묶습니다. 라우터가 아니라 값을 받으므로 어떤 라우터와도 맞습니다 |
| `onChange` | **패널에서** 상태를 바꿨을 때 호출됩니다. 데이터를 다시 불러오려면 `cuesheet.subscribe()`를 쓰세요. 링크·테스트·에이전트가 바꾼 것까지 봅니다 |
| `position` | `'left'`(기본) 또는 `'right'` |

선택 prop은 `undefined`도 받으므로 `exactOptionalPropertyTypes`에서도 조건부 값이 그대로 들어갑니다. 패널이 열려 있었는지는 인스턴스가 쓰는 바로 그 저장소에 `cuesheet:panel-open`으로 남고, 저장소를 못 쓰는 환경에서도 패널은 동작하며 기억만 못 합니다.

`CuesheetSettings`는 떠 있는 껍데기 없이 패널 내용만 담은 컴포넌트입니다. `position`을 뺀 같은 prop을 받으므로 개발용 페이지 아무 데나 놓을 수 있습니다.

스타일은 패널이 처음 마운트될 때 `<head>`에 넣는 평범한 CSS라 따로 import할 게 없고, 클래스 이름은 전부 `cue-`로 시작합니다. `cuesheetStyles`로도 export하고, `injectStyles(root?)`가 `<head>`나 넘긴 `Document` / `ShadowRoot`에 넣습니다. 섀도 루트 안에 패널을 그린다면 그 루트를 넘기세요. 바깥 스타일은 안으로 닿지 않습니다.

번들이 `'use client'`로 시작해서 Next.js App Router에서도 그릴 수 있습니다. cuesheet 자체는 여전히 브라우저에서 만들어야 합니다. [Next.js 예제](../examples/nextjs)를 보세요.

## 기타 export

- `collectHandlers(modules)`: 번들러의 glob 결과를 핸들러 목록으로 바꿉니다.
  [핸들러](./handlers.ko.md#api마다-파일-하나)를 참고하세요.
- `defineCuesheet(setup)`: 핸들러와 따로 둔 옵션 객체에 타입을 붙이는 도우미입니다. `handlers`를 뺀
  `createCuesheet` 옵션 전부를 선택적으로 받고, `setup`을 그대로 돌려줍니다.
- `http`, `HttpResponse`, `passthrough`: `msw`를 다시 export.
- `CUE_PARAM`: 쿼리 파라미터 이름 `'cue'`.
- 타입: `Cuesheet`(인스턴스), `CuesheetOptions`, `CueSetup`, `CueHandler`, `ScenarioHandler`, `CueEntry`,
  `ScenarioOption`, `CueState`, `CuePatch`, `ApiPatch`, `ApiSettingPatch`, `ApiSetting`, `CueStorage`,
  `DelayCondition`, `TimeCondition`, `NetworkCondition`, `CueRecord`, `RecordMatcher`, `RecorderOptions`,
  `WaitOptions`, `CuePlugin`, `CueRequestContext`, `CueResolution`, `CueResolutionMeta`.
- `CueRegistry`를 직접 선언해서 채우는 레지스트리 타입([시나리오 이름 타입](./handlers.ko.md#시나리오-이름-타입)
  참고): `CueRegistry`, `HandlerId`, `ScenarioOf`, `ScenarioName`, `SelectArgs`.

---

**다음:** [동작 원리](./how-it-works.ko.md) · **함께 보기:** [핸들러와 시나리오](./handlers.ko.md)
