# 핸들러와 시나리오

[English](./handlers.md) | **한국어** · [전체 문서](./index.ko.md)

이 페이지에서는 핸들러와 시나리오를 작성하는 방법, 요청을 매칭하는 방식, 핸들러 정의 검사, 핸들러를
파일로 나누는 방법, 시나리오 이름 타입을 다룹니다.

**핸들러**는 API 하나의 정의입니다. id, 패널에 보여 줄 label, 응답을 돌려줄 MSW 핸들러로 이루어집니다.
**시나리오**가 여러 개면 이름으로 응답을 바꿔 끼웁니다.

```ts
// src/mocks/handlers/getCoupons.mock.ts
import { http, HttpResponse, type CueHandler } from 'cuesheet'

export default {
  id: 'getCoupons',               // 상태 키. ?cue=와 select()에서 사용
  label: 'Coupon list',           // 패널에 표시
  path: '/coupons',               // 패널과 getCatalog()에 표시, 정렬 기준
  pages: ['/coupons'],            // 선택. 이 API를 쓰는 라우트, 패널의 페이지 필터에 사용
  handler: [
    { scenario: 'OK', handler: http.get('/coupons', () => HttpResponse.json([{ id: 'welcome', name: 'Welcome' }])) },
    { scenario: 'Empty', handler: http.get('/coupons', () => HttpResponse.json([])) },
    {
      scenario: 'Server error',
      handler: http.get('/coupons', () => HttpResponse.json({ message: 'Temporary error' }, { status: 500 })),
    },
  ],
} satisfies CueHandler
```

`http`, `HttpResponse`, `passthrough`는 `msw`를 다시 export한 것이라 `msw`에서 직접 import해도
똑같습니다.

## 시나리오

- **첫 번째 시나리오가 기본값입니다.** 다른 시나리오를 고르기 전까지 핸들러는 이 시나리오로 응답합니다.
- **시나리오 이름은 짧고 읽기 쉽게 지으세요.** 사람이 `?cue=`에 직접 치는 값입니다.
- **이름 안의 공백, `:`, `+`는 괜찮습니다.** 빈 이름, `,`가 들어간 이름, 앞뒤에 공백이 있는 이름은
  안 됩니다.
- **패널용으로 `label`을 붙일 수 있습니다.** 더 알아보기 쉬운 이름을 보여 주고 싶을 때 씁니다.
  `{ scenario: 'Empty', label: 'No coupons yet', handler }`. 상태, 링크, `select()`에서는 그대로 이름을
  씁니다.
- **MSW 핸들러 하나만 넘겨도 됩니다.** 응답이 하나뿐이면 배열 대신
  `handler: http.get('/me', () => HttpResponse.json(user))`처럼 씁니다.
- **시나리오 안에 무작위 분기는 일부러 넣지 않았습니다.** 같은 상태면 항상 같은 화면이 나와야 하니까요.

### API 하나만 네트워크 오류로 실패시키기

API 하나만 네트워크 오류처럼 실패시키려면 `HttpResponse.error()`를 반환하는 시나리오를 추가하세요. 앱
전체를 오프라인으로 만들 필요가 없습니다.

```ts
{ scenario: 'Network error', handler: http.get('/coupons', () => HttpResponse.error()) }
```

### 시나리오 고르기

- 코드에서: `cuesheet.select('getCoupons', 'Empty')`
- 링크에서: `?cue=getCoupons:Empty`
- 패널에서

`select()`에 모르는 id나 시나리오를 넘기면 쓸 수 있는 값을 담아 예외를 던집니다.

## 매칭과 `baseUrl`

요청은 **MSW 핸들러의 URL**(`http.get('/coupons', ...)`)로 매칭합니다. `path`는 패널과 카탈로그에
보여 줄 메타데이터일 뿐이니, 헷갈리지 않게 MSW URL과 맞춰 두세요.

`baseUrl`을 설정했다면 MSW URL은 상대 경로로 쓰세요.

1. cuesheet는 요청을 먼저 그대로 매칭해 봅니다.
2. 맞는 게 없는데 요청이 `baseUrl`로 가면, base를 뗀 상대 경로로 한 번 더 매칭합니다.

그래서 `https://api.example.com/coupons`에는 `http.get('/coupons', ...)`가 응답합니다. 이렇게 바꾼
요청도 원래 요청의 메서드, 헤더, 본문, `signal`, `credentials`, `redirect`를 그대로 가집니다.

`baseUrl`에는 `/api` 같은 경로(개발 프록시 뒤의 API)도 쓸 수 있습니다. 페이지의 origin을 기준으로 풀고,
호스트가 대문자이거나 기본 포트(`:443`)가 붙어 있어도 일치합니다.

켜진 핸들러 중 매칭되는 게 없으면 요청은 실제 네트워크로 나가고, 기록에 남지 않습니다(오프라인이 먼저
끊지 않는 한). 핸들러에서 `passthrough()`를 반환해 요청을 그대로 내보내도 됩니다.

## 핸들러 검사

핸들러 정의는 인스턴스를 만들 때(그리고 `replaceHandlers()`에서) 검사합니다. 다음 문제가 있으면 전부
모아 예외를 던집니다.

- id가 겹침
- 시나리오 배열이 비어 있음
- 시나리오 이름이 겹침
- `?cue=` 링크에 담을 수 없는 id나 시나리오 이름

핸들러 id는 다음과 같을 수 없습니다.

- `on`, `off`, `offline`, `delay`, `time`
- `__proto__` — 객체의 키로 쓸 수 없는 이름
- `-`로 시작
- `,`나 `:`를 포함
- 앞뒤에 공백

시나리오 이름은 다음과 같을 수 없습니다.

- 빈 문자열
- `,`를 포함
- 앞뒤에 공백

## API마다 파일 하나

파일마다 핸들러를 하나씩 두고 폴더째 등록하세요. 파일은 번들러가 모으고, `collectHandlers`는 그 결과를
받습니다.

```ts
import { collectHandlers } from 'cuesheet'

// Vite
handlers: collectHandlers(import.meta.glob('./mocks/handlers/*.mock.ts', { eager: true }))

// webpack
const context = require.context('./mocks/handlers', false, /\.mock\.ts$/)
handlers: collectHandlers(Object.fromEntries(context.keys().map((key) => [key, context(key)])))
```

- default export, named export 둘 다 되고, 배열을 export해도 됩니다.
- 핸들러를 하나도 export하지 않는 파일이 있으면 경고를 남깁니다.
- 핸들러는 파일 경로 순으로 정렬하니까 빌드마다 순서가 같습니다.

권장하는 구성입니다. API를 추가할 때는 파일만 새로 만들면 되고, 따로 관리할 목록이 없습니다. 결과는
개발 환경에서만 불러오는 모듈 안에서 `createCuesheet`에 넘기세요. 그래야 목 응답이 프로덕션 빌드에 남지
않습니다([시작하기](./getting-started.ko.md#설정하기-권장) 참고).

## 시나리오 이름 타입

`d.ts`에서 `CueRegistry`에 핸들러 id와 시나리오 이름을 선언하면 TypeScript가 검사합니다.

```ts
// src/cuesheet-env.d.ts
import 'cuesheet'

declare module 'cuesheet' {
  interface CueRegistry {
    getCoupons: 'OK' | 'Empty' | 'Server error'
    redeemCoupon: 'Success' | 'Server error'
  }
}
```

```ts
cuesheet.select('getCoupons', 'Emtpy')   // 타입 오류. 'getCoupons'의 시나리오가 아님
cuesheet.patch({ api: { getCoupons: { scenario: 'Emtpy' } } })   // 같은 검사
```

이 파일은 직접 씁니다. 핸들러 파일에 시나리오를 추가하거나 이름을 바꾸면 같이 고치세요. 파일이 없으면 id와
시나리오 이름은 그냥 `string`입니다.

실행 중에야 알 수 있는 id(직접 만든 UI)는 타입을 단언하세요. `{ [id]: { scenario } } as ApiPatch`

---

**다음:** [`?cue=` 링크](./cue-links.ko.md) · **함께 보기:** [API 레퍼런스의 `CueHandler`](./api.ko.md#cuehandler)
