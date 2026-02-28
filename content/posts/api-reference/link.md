---
title: "<Link>"
date: "2026-02-22"
description: "React Router v7의 Link 컴포넌트 API와 prefetch 동작 원리"
tags: ["react-router", "link", "api"]
category: "api-reference"
order: 11
---

> 공식 문서: [https://reactrouter.com/api/components/Link](https://reactrouter.com/api/components/Link)
> 소스코드: packages/react-router/lib/dom/lib.tsx (usePrefetchBehavior, PrefetchPageLinks) / ssr/components.tsx (Link)

# 개요

`<a href>`를 확장한 **클라이언트 사이드 라우팅용 네비게이션 컴포넌트**다.
JS를 쓰지 못하면 `<a href>`로 fallback되는 Progressive Enhancement 동작을 한다.

```typescript
import { Link } from "react-router";

<Link to="/dashboard">Dashboard</Link>

<Link to={{
  pathname: "/some/path",
  search: "?query=string",
  hash: "#hash",
}} />
```

---

# Props 전체 정리

## `to` (required)

이동할 경로. string 또는 `{ pathname, search, hash }` 객체.

```typescript
<Link to="/products" />
<Link to={{ pathname: "/products", search: "?sort=asc" }} />
<Link to=".." relative="path" />  // 상대 경로
```

## `prefetch` — 핵심 (Framework Mode 전용)

페이지의 **JS 모듈 + CSS + loader 데이터**를 미리 가져오는 타이밍을 제어한다.

| 값 | 트리거 | 설명 |
|---|---|---|
| `"none"` | 없음 (default) | 프리패치 안 함 |
| `"intent"` | hover 또는 focus | 유저가 클릭할 것 같을 때 |
| `"render"` | 컴포넌트 렌더링 시 | 화면에 등장하자마자 즉시 |
| `"viewport"` | 뷰포트 진입 시 | 스크롤로 보일 때 |

```typescript
<Link to="/products" prefetch="intent" />   // 가장 자주 쓰는 패턴
<Link to="/about" prefetch="render" />      // 다음 단계가 확실한 UI
<Link to="/next-step" prefetch="viewport" /> // 인피니트 스크롤 리스트
```

내부적으로 HTML `<link rel="prefetch">` / `<link rel="modulepreload">` 태그를 DOM에 삽입해 브라우저 수준에서 리소스를 다운로드한다.

```html
<!-- shouldPrefetch=true일 때 렌더링되는 실제 HTML -->
<a href="/products">상품</a>
<link rel="prefetch" as="fetch" href="/products.data" />
<link rel="modulepreload" href="/assets/routes/products-abc123.js" />
```

> **CSS 주의**: `<link>` 태그가 `<a>` 바로 뒤에 조건부로 삽입되므로 `nav :last-child` CSS 선택자가 깨질 수 있다.
> → `nav :last-of-type`으로 대체

## `discover`

Lazy Route Discovery 동작 제어 (Framework Mode).

| 값 | 설명 |
|---|---|
| `"render"` | default. 렌더링 시 연결된 라우트 정보 탐색 |
| `"none"` | 클릭 시에만 탐색 |

```typescript
<Link to="/admin" discover="none" />
```

## `replace`

history stack에 push하는 대신 replace. 뒤로가기 방지에 쓴다.

```typescript
<Link to="/after-login" replace />
```

## `state`

History 스택에 상태를 남길 수 있다. 이동된 페이지에서 `useLocation().state`로 접근.

```typescript
<Link to="/product/123" state={{ from: "search", query: "sneakers" }} />

// 이동된 페이지에서
const location = useLocation();
console.log(location.state.from); // "search"
```

## `preventScrollReset`

`<ScrollRestoration>` 사용 시, 클릭해도 스크롤이 상단으로 리셋되지 않도록 한다. **탭 UI**에서 유용하다.

```typescript
<Link to="?tab=reviews" preventScrollReset />
```

## `relative`

상대 경로 해석 기준.

| 값 | 설명 |
|---|---|
| `"route"` | default. 라우트 계층 기준 |
| `"path"` | URL 세그먼트 기준 |

```typescript
// 현재 URL: /teams/react
<Link to=".." relative="route" />  // 부모 라우트로
<Link to=".." relative="path" />   // /teams로
```

## `reloadDocument`

클라이언트 사이드 라우팅 없이 `<a>` 태그처럼 전체 페이지 로드.

```typescript
<Link to="/legacy-page" reloadDocument />
```

## `viewTransition`

View Transition API를 활성화한다. CSS `view-transition-name`과 함께 사용.

```typescript
<Link to="/product/123" viewTransition>
  <img style={{ viewTransitionName: "product-image" }} />
</Link>
```

---

# `prefetch` 동작 심화

## 옵션별 적합한 상황

| 옵션 | 적합한 상황 |
|---|---|
| `none` | 이동할지 불확실한 페이지. 어드민, 모달 등 |
| `intent` | 일반적인 내비게이션 링크. 실무 기본값 |
| `render` | 다음 단계가 확정적인 UI. 체크아웃, 온보딩 |
| `viewport` | 인피니트 스크롤 목록, 상품 카드 그리드 |

`intent`가 가장 균형 있는 이유: `render`는 화면의 **모든 링크를 한 번에 프리패치**해 현재 페이지 로드를 방해할 수 있다. `intent`는 실제로 이동할 것 같은 링크만 hover/focus 시점에 프리패치하므로 리소스 낭비가 적다.

## prefetch vs prerender 비교

```javascript
유저가 /products 링크를 클릭할 때

[prefetch 없음]
  클릭 → JS 다운로드 → loader 실행 → 렌더링 (waterfall)

[prefetch="intent"]
  hover → JS + data 백그라운드 다운로드
  클릭 → 캐시에서 즉시 로드 → 렌더링

[prerender config 사용]
  빌드 타임에 HTML + data 파일 생성
  클릭 → 파일 서빙 (loader 실행 없음)
```

---

# 소스코드 분석 (react-router v7.13.0)

> 소스 위치
> - `usePrefetchBehavior`, `PrefetchPageLinks`: `packages/react-router/lib/dom/lib.tsx`
> - `Link` 컴포넌트: `packages/react-router/lib/dom/ssr/components.tsx`

## 1. `usePrefetchBehavior` — prefetch 옵션별 이벤트 제어

```typescript
function usePrefetchBehavior(prefetch, theirElementProps) {
  let frameworkContext = React.useContext(FrameworkContext);
  let [maybePrefetch, setMaybePrefetch] = React.useState(false);
  let [shouldPrefetch, setShouldPrefetch] = React.useState(false);
  let { onFocus, onBlur, onMouseEnter, onMouseLeave, onTouchStart } = theirElementProps;
  let ref = React.useRef(null);

  // "render" → 마운트 즉시 / "viewport" → IntersectionObserver
  React.useEffect(() => {
    if (prefetch === "render") {
      setShouldPrefetch(true);
    }
    if (prefetch === "viewport") {
      let callback = (entries) => {
        entries.forEach((entry) => {
          setShouldPrefetch(entry.isIntersecting);
        });
      };
      // threshold: 0.5 → 요소가 50% 이상 뷰포트에 들어왔을 때 트리거
      let observer = new IntersectionObserver(callback, { threshold: 0.5 });
      if (ref.current) observer.observe(ref.current);
      return () => { observer.disconnect(); };
    }
  }, [prefetch]);

  // "intent" → hover/focus 후 100ms 디바운스
  React.useEffect(() => {
    if (maybePrefetch) {
      let id = setTimeout(() => {
        setShouldPrefetch(true);
      }, 100); // 순간 스치는 hover는 무시
      return () => { clearTimeout(id); };
    }
  }, [maybePrefetch]);

  let setIntent = () => setMaybePrefetch(true);
  let cancelIntent = () => {
    setMaybePrefetch(false);
    setShouldPrefetch(false); // mouseLeave 시 PrefetchPageLinks 언마운트
  };

  // Framework Mode 외 환경(SPA)에서는 항상 false → prefetch 비활성
  if (!frameworkContext) {
    return [false, ref, {}];
  }

  if (prefetch !== "intent") {
    return [shouldPrefetch, ref, {}];
  }

  // "intent"일 때만 이벤트 핸들러 주입
  return [
    shouldPrefetch,
    ref,
    {
      onFocus: composeEventHandlers(onFocus, setIntent),
      onBlur: composeEventHandlers(onBlur, cancelIntent),
      onMouseEnter: composeEventHandlers(onMouseEnter, setIntent),
      onMouseLeave: composeEventHandlers(onMouseLeave, cancelIntent),
      onTouchStart: composeEventHandlers(onTouchStart, setIntent),
    },
  ];
}

// 사용자가 넘긴 핸들러와 내부 핸들러를 합성.
// event.defaultPrevented 체크로 외부에서 중단 가능.
function composeEventHandlers(theirHandler, ourHandler) {
  return (event) => {
    theirHandler && theirHandler(event);
    if (!event.defaultPrevented) {
      ourHandler(event);
    }
  };
}
```

**핵심 포인트:**

- `viewport`: `threshold: 0.5` — 요소의 **50% 이상**이 뷰포트에 진입할 때 트리거
- `intent`: `maybePrefetch` → 100ms 후 `shouldPrefetch`. 순간 스치는 hover 무시
- `cancelIntent`: `onMouseLeave`/`onBlur` 시 `shouldPrefetch=false` → `<PrefetchPageLinks>` 언마운트되어 `<link>` 태그 제거
- Framework Mode가 아닌 환경(`frameworkContext` 없음)은 항상 `false` 반환 — **prefetch는 Framework Mode 전용**

## 2. `Link` 컴포넌트 — `usePrefetchBehavior` + `PrefetchPageLinks` 연결

```typescript
var Link = React.forwardRef(
  function LinkWithRef({
    onClick,
    discover = "render",
    prefetch = "none",   // ← 기본값 "none"
    relative,
    reloadDocument,
    replace,
    state,
    target,
    to,
    preventScrollReset,
    viewTransition,
    ...rest
  }, forwardedRef) {
    let isAbsolute = typeof to === "string" && ABSOLUTE_URL_REGEX.test(to);
    let href = useHref(to, { relative });

    // 1) usePrefetchBehavior → [shouldPrefetch, ref, 이벤트핸들러] 반환
    let [shouldPrefetch, prefetchRef, prefetchHandlers] = usePrefetchBehavior(
      prefetch,
      rest // 사용자가 넘긴 onMouseEnter, onFocus 등 포함
    );

    // 2) <a> 태그 — prefetchHandlers를 spread해서 이벤트 주입
    let link = (
      <a
        {...rest}
        {...prefetchHandlers}                      // ← onMouseEnter 등 자동 주입
        href={href}
        onClick={handleClick}
        ref={mergeRefs(forwardedRef, prefetchRef)} // ← IntersectionObserver용 ref 연결
        target={target}
        data-discover={!isAbsolute && discover === "render" ? "true" : undefined}
      />
    );

    // 3) shouldPrefetch=true이고 절대 URL이 아닐 때만 PrefetchPageLinks 렌더링
    return shouldPrefetch && !isAbsolute
      ? (
        <>
          {link}
          <PrefetchPageLinks page={href} />  {/* ← <link rel="prefetch|modulepreload"> 삽입 */}
        </>
      )
      : link;
  }
);
```

**핵심 포인트:**

- `prefetchHandlers`를 `<a>`에 spread → `onMouseEnter` 등이 내부적으로 `setIntent`를 호출
- `prefetchRef`를 `mergeRefs`로 `forwardedRef`와 합성 → 외부 ref와 IntersectionObserver ref 동시 사용 가능
- `shouldPrefetch && !isAbsolute` 조건: **외부 URL(`http://...`)에는 절대 PrefetchPageLinks 렌더링 안 함**
- `PrefetchPageLinks`는 `<a>` 바로 뒤에 렌더링 → CSS `:last-child` 이슈 발생 지점이 정확히 여기

## 3. `PrefetchPageLinks` — 실제 `<link>` 태그 생성

```typescript
function PrefetchPageLinks({ page, ...linkProps }) {
  let { router } = useDataRouterContext();

  // page 경로가 현재 라우트와 매칭되는지 확인
  let matches = React.useMemo(
    () => matchRoutes(router.routes, page, router.basename),
    [router.routes, page, router.basename]
  );

  // 매칭되는 라우트가 없으면 null (아무것도 렌더링 안 함)
  if (!matches) {
    return null;
  }

  // 실제 <link> 태그 생성은 PrefetchPageLinksImpl에 위임
  return <PrefetchPageLinksImpl page={page} matches={matches} {...linkProps} />;
}
```

## 전체 데이터 흐름

```javascript
<Link to="/products" prefetch="intent">
  ↓
  usePrefetchBehavior("intent", rest)
    → [shouldPrefetch=false, ref, { onMouseEnter: setIntent, ... }] 반환
  ↓
  <a onMouseEnter={setIntent} ref={prefetchRef} />
  ↓
  [사용자가 hover]
  ↓
  setIntent() → maybePrefetch=true
  ↓
  setTimeout 100ms 후 → shouldPrefetch=true
  ↓
  React 리렌더링
  ↓
  shouldPrefetch=true → PrefetchPageLinks 마운트
  ↓
  matchRoutes로 매칭 확인 → PrefetchPageLinksImpl 호출
  ↓
  DOM에 <link rel="prefetch"> + <link rel="modulepreload"> 삽입
  ↓
  브라우저가 idle time에 /products.data + products.js 백그라운드 다운로드
  ↓
  [사용자가 클릭]
  ↓
  캐시에서 즉시 로드 → 네비게이션 체감 속도 대폭 향상
```

---

# `rel="prefetch"` vs `rel="modulepreload"` 브라우저 원리

`PrefetchPageLinks`가 삽입하는 `<link>` 태그는 두 종류인데, 동작 방식이 완전히 다르다.

## `rel="prefetch"` — 미래를 위한 낮은 우선순위 다운로드

브라우저에게 **"지금 당장은 아닌데, 나중에 아마 쓸 것 같아"** 라는 힌트.
현재 페이지 로드가 끝난 **idle 시간에** 낮은 우선순위로 요청해서 **HTTP 캐시(디스크)**에 저장한다.

- **의무가 아니라 힌트**. 네트워크가 느리거나 바쁘면 브라우저가 무시할 수 있다.
- 요청에 `Sec-Purpose: prefetch` 헤더 자동 첨부 — 서버에서 이를 보고 캐시 전략 조작 가능
- `fetch()`의 `priority: "low"`보다도 낮은 우선순위
- RR v7에서 `.data` 파일(loader 응답)을 이걸로 프리패치한다

## `rel="modulepreload"` — JS 모듈의 파싱·컴파일까지 미리

단순 다운로드가 아니라 **파싱 + 컴파일까지 완료하여 module map에 등록**한다.

```javascript
[rel="preload" 흐름]
다운로드 → HTTP 캐시 저장
  → 나중에 사용 시: 캐시에서 읽기 + 파싱 + 컴파일 + 실행

[rel="modulepreload" 흐름]
다운로드 → 파싱 + 컴파일 → module map 등록
  → 나중에 import 시: module map에서 즉시 실행 (네트워크 요청 없음!)
```

module map에 등록되면 `import` 할 때 네트워크 요청 없이 메모리에서 즉시 실행. 또한 브라우저가 **의존 모듈을 자동으로 함께 프리로드** 시도한다 (Chrome 기준).

## `rel="prefetch"` vs `rel="preload"` 핵심 차이

| | `prefetch` | `preload` |
|---|---|---|
| **대상** | **다음 페이지** 리소스 | **현재 페이지** 리소스 |
| **우선순위** | 낮음 (idle time) | 높음 (즉시) |
| **의무 여부** | 힌트 (무시 가능) | 의무 (반드시 다운로드) |
| **저장 위치** | HTTP 캐시 (디스크) | 메모리 캐시 |

> `preload`를 남용하면 **현재 페이지 리소스와 대역폭 경합** 발생 → 오히려 느려진다.
> `prefetch`는 idle time을 활용하므로 **현재 페이지에 거의 영향 없음**.

---

# `<Link>` vs `<NavLink>` 비교

| | `<Link>` | `<NavLink>` |
|---|---|---|
| 기본 동작 | 동일 | 동일 |
| active 클래스 | ❌ | ✅ 자동 |
| pending 클래스 | ❌ | ✅ 자동 |
| aria-current | ❌ | ✅ 자동 |
| render prop | ❌ | ✅ |
| 사용 상황 | 일반 링크 | GNB, 탭, 사이드바 |

> **기준**: active 상태 스타일이 필요하면 NavLink, 단순 이동이면 Link.

---

# 실전 패턴 모음

```typescript
// 패턴 1: 기본 사용
<Link to="/products">All Products</Link>

// 패턴 2: intent prefetch — 대부분의 링크
<Link to={`/products/${id}`} prefetch="intent">
  {product.name}
</Link>

// 패턴 3: 상태 전달
<Link
  to="/checkout"
  state={{ cartItems, coupon }}
  replace
>
  주문하기
</Link>

// 패턴 4: 탭 UI 내 스크롤 유지
<Link
  to="?tab=reviews"
  preventScrollReset
  replace
>
  후기 ({reviewCount})
</Link>

// 패턴 5: 외부 링크
<Link to="/legacy" reloadDocument>
  레거시 페이지
</Link>
```
