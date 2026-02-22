---
title: "<NavLink>"
date: "2026-02-22"
description: "활성 상태를 감지하는 NavLink 컴포넌트 API"
tags: ["react-router", "navlink", "api"]
category: "api-reference"
order: 12
---

> 공식 문서: [https://reactrouter.com/api/components/NavLink](https://reactrouter.com/api/components/NavLink)

# 개요

`<Link>`를 확장해 **active / pending / transitioning 상태**에 따른 스타일링을 자동으로 지원하는 컴포넌트다.

- active 상태일 때 `class="active"` 자동 적용
- 네비게이션 중(pending) `class="pending"` 자동 적용 (Framework / Data 모드만)
- active 링크에 `aria-current="page"` 자동 적용 (접근성)
- `className`, `style`, `children`을 **render prop**으로도 사용 가능

```typescript
import { NavLink } from "react-router";

// 기본 — CSS에서 .active, .pending 클래스로 제어
<NavLink to="/messages">Messages</NavLink>

// render prop — 조건부 클래스
<NavLink
  to="/messages"
  className={({ isActive, isPending }) =>
    isPending ? "pending" : isActive ? "active" : ""
  }
>
  Messages
</NavLink>
```

---

# 자동 클래스 & 상태

```css
a.active      { color: red; }    /* 현재 URL과 일치 */
a.pending     { color: blue; }   /* 네비게이션 진행 중 */
a.transitioning { view-transition-name: my-transition; } /* View Transition 중 */
```

## NavLinkRenderProps

`className`, `style`, `children` 세 곳에서 콜백으로 받을 수 있는 상태값이다.

```typescript
type NavLinkRenderProps = {
  isActive: boolean;      // 현재 URL과 매칭됨
  isPending: boolean;     // 이 링크로 네비게이션 진행 중
  isTransitioning: boolean; // View Transition 진행 중
};
```

```typescript
// className
<NavLink className={({ isActive, isPending }) =>
  isActive ? "active" : isPending ? "pending" : ""
} />

// style
<NavLink style={({ isActive, isPending }) => ({
  color: isActive ? "red" : isPending ? "blue" : "black"
})} />

// children
<NavLink to="/tasks">
  {({ isActive }) => (
    <span className={isActive ? "active" : ""}>Tasks</span>
  )}
</NavLink>
```

---

# Props 전체 정리

## `to` (required)

이동할 경로. 문자열 또는 Path 객체.

```typescript
<NavLink to="/some/path" />
<NavLink to={{ pathname: "/some/path", search: "?q=1", hash: "#section" }} />
```

## `end`

active 매칭 기준을 **정확히 이 경로로 끝날 때만**으로 제한한다.
생략 시 하위 경로도 active로 간주.

| Link | URL | isActive |
|---|---|---|
| `<NavLink to="/tasks" />` | `/tasks` | true |
| `<NavLink to="/tasks" />` | `/tasks/123` | true |
| `<NavLink to="/tasks" end />` | `/tasks` | true |
| `<NavLink to="/tasks" end />` | `/tasks/123` | false |

> **예외**: `<NavLink to="/">`는 모든 URL이 `/`를 포함하므로, `end` 없이도 루트 라우트에서만 active.

```typescript
// GNB에서 상위 메뉴가 하위 경로에서도 active가 되면 안 될 때
<NavLink to="/products" end>Products</NavLink>
```

## `caseSensitive`

URL 매칭을 대소문자 구분하도록 변경.

| Link | URL | isActive |
|---|---|---|
| `<NavLink to="/SpOnGe-bOB" />` | `/sponge-bob` | true |
| `<NavLink to="/SpOnGe-bOB" caseSensitive />` | `/sponge-bob` | false |

## `prefetch`

링크 대상의 데이터와 모듈을 미리 로드하는 시점을 설정.

```typescript
<NavLink prefetch="none" />     // 기본값, 프리패치 없음
<NavLink prefetch="intent" />   // hover / focus 시 프리패치
<NavLink prefetch="render" />   // 링크 렌더링 시 프리패치
<NavLink prefetch="viewport" /> // 뷰포트 진입 시 프리패치 (모바일에 유용)
```

내부적으로 `<link rel="prefetch">` 태그를 삽입한다.

> `nav :last-child` 같은 CSS 선택자 사용 시 `<link>` 태그가 끼어들어 스타일이 깨질 수 있음.
> `nav :last-of-type`으로 변경할 것.

## `replace`

History 스택을 push 대신 replace. 뒤로가기로 이전 위치로 못 돌아오게 할 때.

```typescript
// A -> B 에서 C로 이동 시
// 기본: A -> B -> C
// replace: A -> C
<NavLink to="/next-step" replace />
```

## `state`

History 스택 항목에 클라이언트 상태 추가. `useLocation().state`로 접근.

```typescript
<NavLink to="/detail" state={{ from: "list" }} />

const location = useLocation();
location.state; // { from: "list" }
// 서버에서는 접근 불가 (history.state 기반)
```

## `preventScrollReset`

`<ScrollRestoration>` 사용 시, 링크 클릭 후 스크롤이 맨 위로 초기화되는 것을 방지.

```typescript
<NavLink to="?tab=reviews" preventScrollReset />
```

## `relative`

상대 경로 기준 설정.

```typescript
<NavLink to=".." relative="route" /> // 기본: 라우트 계층 기준
<NavLink to=".." relative="path" />  // URL 세그먼트 기준
```

## `reloadDocument`

client-side routing 없이 브라우저 기본 링크 동작으로 이동.

```typescript
<NavLink to="/logout" reloadDocument />
```

## `viewTransition`

View Transition API를 이 네비게이션에 활성화.

```typescript
<NavLink to={to} viewTransition />
// 전환 중 특정 스타일은 useViewTransitionState 참조
```

## `discover`

Lazy Route Discovery 시점 설정.

```typescript
<NavLink discover="render" /> // 기본: 렌더링 시 탐색
<NavLink discover="none" />  // 클릭 시에만 탐색
```

---

# Props 한눈에 보기

| Prop | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `to` | string \| Path | (required) | 이동 경로 |
| `end` | boolean | false | 정확한 경로 끝 매칭만 active |
| `caseSensitive` | boolean | false | 대소문자 구분 매칭 |
| `prefetch` | string | `"none"` | 프리패치 시점 |
| `replace` | boolean | false | history.replace 동작 |
| `state` | object | - | History 상태 |
| `preventScrollReset` | boolean | false | 스크롤 초기화 방지 |
| `relative` | string | `"route"` | 상대 경로 기준 |
| `reloadDocument` | boolean | false | 전체 문서 이동 |
| `viewTransition` | boolean | false | View Transition 활성화 |
| `discover` | string | `"render"` | Lazy Route Discovery 시점 |
| `className` | string \| fn | - | 정적 또는 render prop |
| `style` | object \| fn | - | 정적 또는 render prop |
| `children` | ReactNode \| fn | - | 정적 또는 render prop |

---

# 실전 패턴

## GNB (전역 내비게이션)

```typescript
function GlobalNav() {
  return (
    <nav>
      <NavLink to="/" end>홈</NavLink>
      <NavLink to="/products">상품</NavLink>
      <NavLink to="/orders">주문</NavLink>
      <NavLink to="/mypage">마이페이지</NavLink>
    </nav>
  );
}
```

```css
nav a.active {
  font-weight: bold;
  color: var(--primary);
}
nav a.pending {
  opacity: 0.6;
}
```

## 로딩 인디케이터가 있는 NavLink

```typescript
<NavLink
  to="/heavy-page"
  prefetch="intent"
  className={({ isActive, isPending }) =>
    `nav-item ${isActive ? "active" : ""} ${isPending ? "loading" : ""}`
  }
>
  {({ isPending }) => (
    <>
      <span>Heavy Page</span>
      {isPending && <Spinner size="sm" />}
    </>
  )}
</NavLink>
```

## 탭 UI

```typescript
const tabs = [
  { to: "overview", label: "개요" },
  { to: "reviews", label: "리뷰" },
  { to: "qna", label: "Q&A" },
];

function ProductTabs() {
  return (
    <div className="tabs">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          preventScrollReset
          className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
```

---

# NavLink vs Link

| | `<NavLink>` | `<Link>` |
|---|---|---|
| active 클래스 | ✅ 자동 | ❌ |
| pending 클래스 | ✅ 자동 | ❌ |
| aria-current | ✅ 자동 | ❌ |
| render prop | ✅ | ❌ |
| prefetch | ✅ | ✅ |
| 사용 상황 | GNB, 탭, 사이드바 | 일반 링크 |

> **기준**: active 상태 스타일이 필요하면 `NavLink`, 그냥 이동만 하면 `Link`.
