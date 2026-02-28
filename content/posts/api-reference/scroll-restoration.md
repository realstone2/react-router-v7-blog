---
title: "<ScrollRestoration>"
date: "2026-02-22"
description: "SPA에서의 스크롤 위치 복원 컴포넌트"
tags: ["react-router", "scroll-restoration", "api"]
category: "api-reference"
order: 18
---

> 공식 문서: [https://reactrouter.com/api/components/ScrollRestoration](https://reactrouter.com/api/components/ScrollRestoration)
> Framework ✅ / Data ✅ / Declarative ❌

# 개요

브라우저의 **스크롤 복원(scroll restoration)** 동작을 SPA에서 에뮬레이션하는 컴포넌트다.
기본 브라우저는 페이지를 이동하면 스크롤 위치를 기억했다가 뒤로가기 시 복원해주는데, 클라이언트 사이드 라우팅에서는 이게 자동으로 동작하지 않는다. `<ScrollRestoration>`이 이 역할을 대신한다.

**앱 전체에 딱 하나만 렌더링해야 한다.** `<Scripts>` 바로 앞에 배치하는 게 관례다.

```typescript
// app/root.tsx
import { ScrollRestoration, Scripts } from "react-router";

export default function Root() {
  return (
    <html>
      <body>
        {/* ... */}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

---

# 동작 원리

내부적으로 인라인 `<script>` 태그를 렌더링해서 **스크롤 깜빡임(scroll flash)을 방지**한다.

```javascript
페이지 이동 시:
  이동 전 스크롤 위치 → sessionStorage에 저장

페이지 복귀 시 (뒤로가기 등):
  sessionStorage에서 위치 꺼내서 즉시 복원
  (인라인 <script>로 DOM 로드 전에 실행 → 깜빡임 없음)
```

sessionStorage 키 기본값: `"react-router-scroll-positions"`

---

# Signature

```typescript
function ScrollRestoration({
  getKey,
  storageKey,
  nonce,
  ...props
}: ScrollRestorationProps)
```

---

# Props

## `getKey`

스크롤 위치를 **어떤 키로 저장할지** 결정하는 함수. 기본값은 `location.key`.
`location.key`는 히스토리 스택의 각 엔트리마다 고유한 값이다. 같은 URL이라도 다른 히스토리 엔트리면 다른 키를 갖는다.

```typescript
<ScrollRestoration
  getKey={(location, matches) => {
    // 기본 동작: 히스토리 엔트리마다 개별 저장
    return location.key;

    // pathname 기준: 같은 경로는 어디서 왔든 동일한 스크롤 위치 복원
    return location.pathname;
  }}
/>
```

### `location.key` vs `location.pathname` — 언제 뭘 쓸까

| 기준 | 동작 | 적합한 상황 |
|---|---|---|
| `location.key` (default) | 히스토리 엔트리마다 독립 저장 | 일반적인 뒤로가기/앞으로가기 복원 |
| `location.pathname` | 같은 경로면 항상 같은 위치 복원 | 검색 결과 → 상세 → 뒤로가기 시 목록 위치 유지 |

```typescript
// 실전 예시: 상품 목록 → 상세 → 뒤로가기 시 목록 스크롤 위치 복원
// pathname 기준으로 하면 /products는 항상 마지막으로 본 위치로 복원
<ScrollRestoration
  getKey={(location) => location.pathname}
/>

// 더 세밀한 제어: 특정 경로만 pathname 기준, 나머지는 key 기준
<ScrollRestoration
  getKey={(location, matches) => {
    const scrollableRoutes = ["/products", "/blog"];
    return scrollableRoutes.includes(location.pathname)
      ? location.pathname
      : location.key;
  }}
/>
```

## `nonce`

inline `<script>` 태그에 붙는 CSP(Content Security Policy) nonce 값.

```typescript
// CSP 설정 시
<ScrollRestoration nonce={cspNonce} />
```

## `storageKey`

scroll 위치를 저장하는 `sessionStorage` 키. 기본값: `"react-router-scroll-positions"`.

```typescript
// 여러 앱이 같은 도메인에서 실행될 때 충돌 방지
<ScrollRestoration storageKey="my-app-scroll" />
```

---

# `<Link preventScrollReset>`과의 관계

`<ScrollRestoration>`을 쓰면 기본적으로 모든 네비게이션 시 스크롤이 상단으로 리셋된다.
`<Link preventScrollReset>`은 특정 링크 클릭 시 이 리셋을 막는 opt-out 옵션이다.

```typescript
// 탭 UI: 탭 전환 시 스크롤이 상단으로 가지 않도록
<Link to="?tab=reviews" preventScrollReset replace>
  후기
</Link>
```

> **동작 차이 주의**: `preventScrollReset`은 스크롤 위치를 *복원*하는 게 아니라
> 단지 상단으로 *리셋되는 것을 방지*할 뿐이다.

---

# 주의사항

**1. 앱 전체에 딱 하나만**

여러 개 렌더링하면 스크롤 상태가 충돌한다.

**2. `<Scripts>` 바로 앞에 배치**

인라인 script가 `<Scripts>` 이전에 실행되어야 스크롤 깜빡임이 없다.

```typescript
// ✅ 올바른 순서
<ScrollRestoration />
<Scripts />

// ❌ 잘못된 순서
<Scripts />
<ScrollRestoration />
```

**3. sessionStorage 기반**

탭 닫으면 저장된 스크롤 위치가 사라진다. localStorage가 아니다.
