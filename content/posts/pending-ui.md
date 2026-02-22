---
title: "Pending UI"
date: "2026-02-22"
description: "React Router v7의 Pending UI 패턴과 낙관적 업데이트"
tags: ["react-router", "pending-ui", "optimistic-ui"]
category: "core-concepts"
order: 9
---

> 공식 문서: [https://reactrouter.com/start/framework/pending-ui](https://reactrouter.com/start/framework/pending-ui)

# 개요

유저가 네비게이션하거나 데이터를 제출하면 UI는 **즉시** pending 또는 optimistic 상태로 응답해야 한다.
RR v7이 제공하는 Pending UI 패턴은 4가지다.

| 패턴 | 수단 | 범위 |
|---|---|---|
| Global Pending Navigation | `useNavigation` | 전체 페이지 |
| Local Pending Navigation | `<NavLink>` isPending | 링크 단위 |
| Pending Form Submission | `fetcher.state` / `useNavigation` | 폼 단위 |
| Optimistic UI | `fetcher.formData` | 즉시적 UX |

---

# 1. Global Pending Navigation

새 URL로 네비게이트할 때 다음 페이지의 loader가 완료될 때까지 전체 페이지가 대기한다.
`useNavigation().location`으로 대기 여부를 감지한다.

```typescript
import { useNavigation } from "react-router";

export default function Root() {
  const navigation = useNavigation();
  const isNavigating = Boolean(navigation.location);
  // navigation.location: 이동 중인 목적지 location, idle 시 undefined

  return (
    <html>
      <body>
        {isNavigating && <GlobalSpinner />}
        <Outlet />
      </body>
    </html>
  );
}
```

> `root.tsx`에 배치해 모든 네비게이션에 일괄 적용

---

# 2. Local Pending Navigation

링크 단위로 pending 상태를 표시한다. `<NavLink>`의 children/className/style prop에 콜백을 사용한다.

```typescript
import { NavLink } from "react-router";

function Navbar() {
  return (
    <nav>
      {/* children 콜백 */}
      <NavLink to="/home">
        {({ isPending }) => (
          <span>Home {isPending && <Spinner />}</span>
        )}
      </NavLink>

      {/* style 콜백 */}
      <NavLink
        to="/about"
        style={({ isPending }) => ({
          color: isPending ? "gray" : "black",
        })}
      >
        About
      </NavLink>
    </nav>
  );
}
```

> Global Spinner대신 클릭한 링크에만 스피너를 표시할 때 유용하다.

---

# 3. Pending Form Submission

## fetcher form (권장)

fetcher는 독립적인 state를 가지므로 폼 단위로 pending UI를 제어하기 쉽다.

```typescript
import { useFetcher } from "react-router";

function NewProjectForm() {
  const fetcher = useFetcher();

  return (
    <fetcher.Form method="post">
      <input type="text" name="title" />
      <button type="submit">
        {fetcher.state !== "idle" ? "Submitting..." : "Submit"}
      </button>
    </fetcher.Form>
  );
}
```

## 일반 Form (useNavigation)

`<Form>`은 전역 네비게이션을 일으키므로 `useNavigation`으로 pending 상태를 감지한다.

```typescript
import { useNavigation, Form } from "react-router";

function NewProjectForm() {
  const navigation = useNavigation();

  return (
    <Form method="post" action="/projects/new">
      <input type="text" name="title" />
      <button type="submit">
        {navigation.formAction === "/projects/new"
          ? "Submitting..."
          : "Submit"}
      </button>
    </Form>
  );
}
// navigation.formAction: 현재 제출 중인 action URL
// 여러 폼이 있을 때 어떤 폼이 제출 중인지 식별 가능
```

---

# 4. Optimistic UI

폼 제출 데이터로 다음 상태를 예측할 수 있을 때, 서버 응답을 기다리지 않고 즉시 UI를 업데이트한다.

```typescript
function Task({ task }) {
  const fetcher = useFetcher();

  // 서버 응답 전: fetcher.formData로 다음 상태 예측
  // 서버 응답 후: task.status로 실제 상태 반영
  let isComplete = task.status === "complete";
  if (fetcher.formData) {
    isComplete = fetcher.formData.get("status") === "complete";
  }

  return (
    <div>
      <div>{task.title}</div>
      <fetcher.Form method="post">
        <button name="status" value={isComplete ? "incomplete" : "complete"}>
          {isComplete ? "Mark Incomplete" : "Mark Complete"}
        </button>
      </fetcher.Form>
    </div>
  );
}
```

**동작 흐름:**

```javascript
[유저 클릭] → fetcher.formData 존재
  → isComplete = formData로 즉시 교체 (UI 즉시 변경)
[서버 응답] → fetcher.formData = null
  → isComplete = task.status (DB 값으로 확정)
[실패 시] → fetcher.formData = null, task.status 불변
  → UI 자동 롤백
```

---

# 패턴 선택 기준

| 상황 | 권장 패턴 |
|---|---|
| 전체 페이지 로딩 인디케이터 | Global (`useNavigation`) |
| 클릭한 링크에만 스피너 | Local (`NavLink isPending`) |
| 인라인 뮤테이션 폼 | `fetcher.state` |
| 일반 폼 + 페이지 이동 | `useNavigation.formAction` |
| 즉시 응답이 필요한 UX | Optimistic UI (`fetcher.formData`) |

---

# useNavigation 상태값

```typescript
navigation.state
// "idle"       — 대기 없음
// "loading"    — 다음 페이지 loader 실행 중
// "submitting" — action 실행 중

navigation.location  // 이동 중인 목적지 location
navigation.formAction // 제출 중인 form의 action URL
navigation.formData  // 제출 중인 form data (Optimistic UI용)
```

> **핵심**
> 네비게이션/폼 제출 시 코드가 자동으로 pending state를 만들어주지 않는다.
> `useNavigation` 또는 `fetcher.state`로 **애플리케이션 코드가 직접 처리**해야 한다.
