# Playwright로 테스트하기

[English](./testing.md) | **한국어** · [전체 문서](./index.ko.md)

cuesheet는 인스턴스를 `window.__cuesheet__`에 노출합니다(`expose` 옵션, 기본값 켜짐). 테스트는 앱 번들을
거치지 않고 브라우저 컨텍스트에서 이 인스턴스를 바로 다룹니다. AI 에이전트가 쓰는 것도 이 인스턴스입니다.
이 페이지에서는 상태 진입, 앱이 보낸 요청 확인, 시계 고정, 타입과 단위 테스트 설정을 다룹니다.

**이 페이지에서**

- [상태 진입하기](#상태-진입하기)
- [앱이 보낸 요청 확인하기](#앱이-보낸-요청-확인하기)
- [시계](#시계)
- [타입](#타입)
- [단위 테스트(Vitest)](#단위-테스트vitest)
- [예제](#예제)

## 상태 진입하기

되도록 `?cue=`를 붙여 페이지를 여세요. 그러면 앱이 첫 요청을 보내거나 날짜를 읽기 전에 상태가 이미
맞춰져 있습니다.

```ts
await page.goto(`/?cue=${encodeURIComponent('getCoupons:Empty,delay:0')}`)
await expect(page.getByText('No coupons available')).toBeVisible()
```

테스트 도중 다른 상태가 필요하면 페이지에서 바꾸세요. 앱이 상태를
[구독](./getting-started.ko.md#상태가-바뀌면-화면-새로-고치기)하고 있다면 데이터를 다시 가져옵니다.

```ts
await page.waitForFunction(() => window.__cuesheet__ !== undefined)
await page.evaluate(() => window.__cuesheet__!.select('getCoupons', 'Server error'))
```

`select()`에 모르는 핸들러나 시나리오를 넘기면 쓸 수 있는 값을 담아 예외를 던집니다. 그래서 오타가 있으면
테스트가 확실히 깨집니다. 쓸 수 있는 값은 `window.__cuesheet__.getCatalog()`로 확인하세요.

> [!IMPORTANT]
> 앱이 개발 환경에서만 cuesheet를 동적 import한다면([권장하는 설정](./getting-started.ko.md#설정하기-권장)),
> `window.__cuesheet__`는 `page.goto()`가 기다리는 `load` 이벤트 뒤에 생길 수 있습니다. 그 전에는
> `window.__cuesheet__?.…`가 아무 일도 하지 않고 넘어가니, 위처럼 첫 호출 전에 기다리세요. React 예제의
> `enter()` 헬퍼는 `goto` 뒤마다 이렇게 합니다.

## 앱이 보낸 요청 확인하기

cuesheet가 응답한 요청은 네트워크에 나가지 않으니 DevTools나 Playwright의 네트워크 이벤트에 안 보입니다.
대신 cuesheet가 기록해 둡니다(기본 최근 100건).

```ts
await page.evaluate(() => {
  window.__cuesheet__!.select('redeemCoupon', 'Success')
  window.__cuesheet__!.clearRecords()
})
await page.getByRole('button', { name: 'Redeem' }).first().click()

await expect
  .poll(() => page.evaluate(() => window.__cuesheet__!.getRecords({ handlerId: 'redeemCoupon' }).length))
  .toBe(1)
const [record] = await page.evaluate(() => window.__cuesheet__!.getRecords({ handlerId: 'redeemCoupon' }))
expect(record.method).toBe('POST')
expect(record.scenario).toBe('Success')
// record.requestBody에 앱이 보낸 내용. 화면에 안 드러나는 변경도 확인 가능
```

순서는 이렇습니다.

1. 기록을 비웁니다.
2. 동작을 실행합니다.
3. 폴링합니다.

> [!WARNING]
> 기록은 본문을 다 읽은 뒤에 추가되는데, 앱이 응답을 받은 시점보다 조금 늦을 수 있습니다. 그러니 화면이
> 바뀌자마자 기록을 한 번만 읽지 마세요. `waitForRequest()`는 **호출한 뒤에** 보낸 요청만 세니까,
> 클릭하고 나서 부르면 그 클릭이 보낸 요청을 놓칩니다.

### 기록 필드

| 필드 | 설명 |
|---|---|
| `method`, `url`, `path` | 요청 정보. `path`는 origin을 뺀 경로와 쿼리입니다 |
| `handlerId`, `scenario` | 응답한 핸들러와 실제로 응답한 시나리오 |
| `status` | 응답 상태 코드. cuesheet가 요청을 실패시켰다면(오프라인) `0` |
| `error` | 실패했다면 그 이유 |
| `requestBody`, `responseBody` | 파싱한 본문. 최대 1 MiB |
| `durationMs`, `startedAt` | 시간 정보. 지연 포함 |

- `scenario`는 아무것도 고르지 않았다면 첫 번째 시나리오입니다. 응답이 하나뿐인 핸들러에서만 없습니다.
- 본문 기록은 `record: { bodies: false }`로 끕니다. Server-Sent Events 응답은 본문 없이 기록합니다.

### 기록 거르기

- `handlerId`, `scenario`, `method`, `path`(부분 문자열 또는 RegExp), `status`, `failed`로 거릅니다.
- **`failed: true`는 오프라인일 때 cuesheet가 끊은 요청을 찾습니다.**
- `500` 응답은 `failed`가 아니니 `status: 500`으로 찾으세요.
- `HttpResponse.error()`를 반환하는 시나리오도 `fetch`를 실패시키지만, 응답한 요청으로 보고
  `status: 0`으로 기록하니 `status: 0`으로 찾으세요.
- 이 밖의 키를 넣으면 모든 기록과 일치하는 대신 예외를 던집니다(`waitForRequest()`는 reject). 핸들러
  필드 이름은 기록과 같은 `handlerId`이고, `{ id }`를 넣으면 예외 메시지가 그렇게 알려 줍니다.

아무 핸들러도 응답하지 않은 요청은 실제 네트워크로 나가고 기록에 남지 않습니다(오프라인으로 끊긴 경우는
제외).

## 시계

시계는 `Date.now()`와 인자 없는 `new Date()`를 대체합니다.

> [!IMPORTANT]
> 앱이 이미 읽은 날짜(모듈을 로드할 때 읽은 값 등)는 나중에 못 바꿉니다. **시간은 처음 여는 URL에
> 넣으세요.** 페이지가 로드된 뒤 `patch()`로 바꾸면 늦습니다.

```ts
await page.goto(`/?cue=${encodeURIComponent('time:2026-01-15T09:00:00Z')}`)
```

cuesheet가 시작되기 전에 원래 `Date`를 잡아 둔 코드(`const now = Date.now`, 먼저 평가된
`class X extends Date`)와 인자 없는 `Intl.DateTimeFormat#format()` 같은 엔진 내부 동작은 실제 시간을 그대로
씁니다.

> [!TIP]
> 시간과 상관없는 테스트 스위트라도 시간은 고정해 두세요. 안 그러면 날짜가 들어간 픽스처가 실제 시간이
> 흐르면서 만료되고, 어느 날 갑자기 테스트가 깨지기 시작합니다. React 예제는 `e2e/cue.ts`에서 모든
> 테스트를 한 날짜로 고정합니다.

## 타입

프로젝트 어디서든 `cuesheet`를 import하면 `Window`에 `__cuesheet__`가 추가됩니다. 타입 전용 import여도
마찬가지입니다. 시나리오 이름을 선언하는 `d.ts`([시나리오 이름 타입](./handlers.ko.md#시나리오-이름-타입) 참고)가
`import 'cuesheet'`로 시작하니 이미 해 줍니다.

## 단위 테스트(Vitest)

단위 테스트는 앱 진입점을 실행하지 않으므로, 테스트가 `start()`를 부르는 인스턴스 모듈(`src/mocks/cuesheet.ts`)을
import할 때만 cuesheet가 시작됩니다. 거기서 import하지 않으면 단위 테스트가 자기 MSW 핸들러로 모킹하는
요청에 끼어들지 않습니다. 핸들러의 응답이 필요하면 핸들러 파일을 직접 import하세요.

## 예제

[`examples/react`](../examples/react)에는 기본 스펙과, 변경 요청 네 건의 인수 스펙이 있습니다. 인수 스펙은
`?cue=` 상태와 요청 기록 검사로 썼습니다. `e2e/cue.ts`의 작은 헬퍼(`enter`, `select`, `lastRequest`)는 그대로
가져다 쓰세요.

---

**다음:** [API 레퍼런스](./api.ko.md) · **함께 보기:** [`?cue=` 링크](./cue-links.ko.md) · [API 레퍼런스의 요청 기록](./api.ko.md#요청-기록)
