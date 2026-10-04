# 시작하기

[English](./getting-started.md) | **한국어** · [전체 문서](./index.ko.md)

이 페이지에서는 cuesheet를 설치하고 Vite, webpack, Next.js 앱에 붙이는 방법, 상태가 바뀔 때 화면을
새로 고치는 방법, 프로덕션 빌드에서 cuesheet를 빼는 방법을 다룹니다.

**이 페이지에서**

- [요구 사항](#요구-사항)
- [설정하기 (권장)](#설정하기-권장)
- [다른 번들러](#다른-번들러)
- [Next.js](#nextjs)
- [상태가 바뀌면 화면 새로 고치기](#상태가-바뀌면-화면-새로-고치기)
- [프로덕션에서 빼기](#프로덕션에서-빼기)

## 요구 사항

- **브라우저 전용.** 페이지의 `fetch`와 `XMLHttpRequest`를 가로채는 방식이라 서버에서 보내는 요청
  (Next.js Server Components, Route Handlers)은 가로채지 않습니다.
- **`msw` 2.1.3 이상**이 peer dependency입니다. 2.1.3부터 최신까지 2.x 마이너를 전부 확인했고,
  `getResponse`가 2.1.3에서 추가되므로 2.1.2 이하는 동작하지 않습니다. 핸들러를
  msw로 작성하니 msw는 프로젝트에 하나만 설치돼
  있어야 합니다(npm 7 이상, pnpm, bun은 알아서 설치해 줍니다).
- **React 18, 19**: `@cuesheet/react`를 쓸 때.

## 설정하기 (권장)

```bash
npm install -D cuesheet msw
npm install -D @cuesheet/react        # 패널을 쓸 때
```

아래는 Vite 기준이고, 전체 코드는 [`examples/react`](../examples/react)에 있습니다. 네 부분으로 나뉩니다.

**1. 파일 하나에 핸들러 하나, glob으로 등록.** 핸들러는 `src/mocks/handlers/*.mock.ts`에 하나씩
default export로 둡니다([API마다 파일 하나](./handlers.ko.md#api마다-파일-하나) 참고). API를 추가할 때는
파일만 새로 만들면 되고, 따로 관리할 목록이 없습니다.

**2. 인스턴스는 별도 모듈에.** 핸들러를 모은 뒤 `?cue=`를 읽고 시작합니다.

```ts
// src/mocks/cuesheet.ts
import { collectHandlers, createCuesheet } from 'cuesheet'

export const cuesheet = createCuesheet({
  baseUrl: 'https://api.example.com',
  handlers: collectHandlers(import.meta.glob('./handlers/*.mock.ts', { eager: true })),
  storage: window.localStorage,   // 생략하면 상태를 메모리에만 보관
  defaultEnabled: true,           // 필수. 저장된 값이 없을 때 켤지 여부
})

// 앱을 렌더링하기 전에. 그래야 ?cue= 링크가 첫 요청과 시계에도 적용됩니다
cuesheet.applyUrlParams()
cuesheet.start()
```

**3. 진입점에서 개발 환경에서만 동적 import.** `import.meta.env.DEV`가 참일 때만 그 모듈을 불러오고,
시작된 뒤에 앱을 렌더링합니다.

```tsx
// src/main.tsx
import type { Cuesheet } from 'cuesheet'

async function startCuesheet(): Promise<Cuesheet | undefined> {
  if (!import.meta.env.DEV) {
    return undefined
  }
  const { cuesheet } = await import('./mocks/cuesheet')
  return cuesheet
}

void startCuesheet().then((cuesheet) => {
  createRoot(document.getElementById('root') as HTMLElement).render(<App cuesheet={cuesheet} />)
})
```

> [!IMPORTANT]
> cuesheet는 **앱을 렌더링하기 전에** 시작하세요. 그래야 cuesheet가 준비되기 전에 앱이 요청을 보내거나
> 날짜를 읽는 일이 없습니다.

**4. 패널은 같은 조건 뒤에서 lazy 로드.** 앱은 `cuesheet`를 prop으로 받고, 프로덕션 빌드에서는
`undefined`입니다.

```tsx
// App.tsx
const CuesheetPanel = import.meta.env.DEV
  ? lazy(() => import('@cuesheet/react').then((module) => ({ default: module.CuesheetPanel })))
  : undefined

export default function App({ cuesheet }: { cuesheet?: Cuesheet | undefined }) {
  useEffect(() => cuesheet?.subscribe(() => queryClient.invalidateQueries()), [cuesheet])

  return (
    <>
      <CouponApp />
      {CuesheetPanel !== undefined && cuesheet !== undefined && (
        <Suspense fallback={null}>
          <CuesheetPanel cuesheet={cuesheet} />
        </Suspense>
      )}
    </>
  )
}
```

핸들러 id와 시나리오 이름을 TypeScript로 검사하려면(`select('getCoupons', 'Emtpy')`가 타입 검사에서
걸리게) `d.ts`에 선언하세요. [시나리오 이름 타입](./handlers.ko.md#시나리오-이름-타입)을 참고하세요.

## 다른 번들러

네 부분은 어디서나 같고, 두 가지만 바뀝니다.

- **핸들러 모으기.** webpack에서는 `import.meta.glob` 대신 `require.context`를 `collectHandlers`에
  넘기거나([API마다 파일 하나](./handlers.ko.md#api마다-파일-하나) 참고), 핸들러를 import해서 배열로
  나열하세요.
- **개발 환경 조건.** 번들러가 빌드할 때 바꿔 넣는 값을 쓰세요. 보통
  `process.env.NODE_ENV !== 'production'`이고, `if` 안에 바로 써야 합니다([아래](#프로덕션에서-빼기) 참고).

## Next.js

cuesheet는 브라우저에서 보낸 요청만 보니까, 모킹할 데이터는 Client Component에서 불러오세요.

전체 연결 방법은 [Next.js 예제](../examples/nextjs)에 있습니다. 인스턴스는 `src/cuesheet/instance.ts`에
두고, provider가 개발 환경에서만 그 모듈을 (패널과 함께) 동적 import해서 `applyUrlParams()`와 `start()`를
부르고, 시작될 때까지 아무것도 렌더링하지 않습니다.

`start()`는 브라우저 밖에서는 경고만 남기고 아무것도 하지 않습니다. 그래서 SSR 중에 인스턴스가 import돼도
서버의 `fetch`나 `Date`를 건드리지 않습니다. 인스턴스 모듈이 서버에서 import될 수 있다면 브라우저 전용
옵션도 막아 두세요.

```ts
storage: typeof window === 'undefined' ? undefined : window.localStorage
```

## 상태가 바뀌면 화면 새로 고치기

시나리오를 바꿔도 앱이 이미 가져온 데이터는 그대로입니다. 한 번 구독해 두고 상태가 바뀔 때마다 다시
가져오세요.

```ts
cuesheet.subscribe(() => queryClient.invalidateQueries())
```

`subscribe`는 패널, `?cue=` 링크, `window.__cuesheet__`, 테스트 중 어디서 바꾸든 호출됩니다.

> [!TIP]
> 패널의 `onChange` prop은 패널에서 바꿀 때만 호출됩니다. 테스트나 에이전트도 앱을 조작한다면
> `subscribe`를 쓰세요.

## 프로덕션에서 빼기

모킹을 프로덕션 빌드에서 빼는 건 앱의 몫입니다. cuesheet는 번들을 검사하지 않습니다. `-D`로 설치했다고
번들에서 빠지지도 않습니다. 번들에 뭐가 들어갈지는 import가 정합니다. `defaultEnabled: false`도
마찬가지입니다. `?cue=` 링크나 저장된 상태가 있으면 cuesheet는 켜집니다. 프로덕션에서 빼려면 아예
불러오지 마세요.

cuesheet와 `@cuesheet/react`, 핸들러 파일은 번들러가 지울 수 있는 조건 안의 동적 import로만 불러오세요.
[위의 설정](#설정하기-권장)이 그렇게 합니다. 조건은 `if` 안에 바로 써야 합니다.

```ts
// Vite
if (import.meta.env.DEV) {
  const { cuesheet } = await import('./mocks/cuesheet')
}

// webpack 등
if (process.env.NODE_ENV !== 'production') {
  const { cuesheet } = await import('./mocks/cuesheet')
}
```

앱 어디서든 `cuesheet`(또는 핸들러 파일)를 정적으로 한 번만 import해도 전부 다시 번들에 들어갑니다.
`import type`은 괜찮습니다.

> [!WARNING]
> 조건을 먼저 변수에 담으면(`const ENABLED = ...`) webpack은 import한 청크를 그대로 만듭니다.

빌드 결과를 확인하려면 결과물에서 `__cuesheet__`를 검색해 보세요. 나오지 않아야 합니다.

---

**다음:** [핸들러와 시나리오](./handlers.ko.md) · **함께 보기:** [React 패널](./api.ko.md#react-패널)
