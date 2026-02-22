---
title: "Navigating"
date: "2026-02-22"
description: "React Router v7의 다양한 내비게이션 방법"
tags: ["react-router", "navigation"]
category: "core-concepts"
order: 8
---

> 공식 문서: [https://reactrouter.com/start/framework/navigating](https://reactrouter.com/start/framework/navigating)

# 개요

RR v7에서 네비게이션은 5가지 수단으로 이루어진다.

| 수단 | 주요 용도 |
|---|---|
| `<NavLink>` | active/pending 스타일이 필요한 네비게이션 링크 |
| `<Link>` | 일반 링크 |
| `<Form>` | URL 네비게이션 (GET) 또는 action 호출 (POST) |
| `redirect` | loader/action 내부에서 서버사이드 리다이렉트 |
| `useNavigate` | 유저 상호작용 없는 프로그래밍 네비게이션 |

---

# NavLink

active / pending / transitioning 상태를 자동으로 클래스명으로 제공한다.

```typescript
import { NavLink } from "react-router";

export function MyAppNav() {
  return (
    <nav>
      <NavLink to="/" end>Home</NavLink>
      <NavLink to="/trending" end>Trending</NavLink>
      <NavLink to="/concerts">All Concerts</NavLink>
    </nav>
  );
}
```

## CSS로 스타일링

```css
a.active    { color: red; }
a.pending   { animation: pulse 1s infinite; }
a.transitioning { /* View Transition 실행 중 */ }
```

## 콜백 prop으로 세밀한 제어

`className`, `style`, `children` prop에 콜백을 전달해 상태별 제어가 가능하다.

```typescript
// className
<NavLink
  to="/messages"
  className={({ isActive, isPending, isTransitioning }) =>
    [isPending ? "pending" : "", isActive ? "active" : ""].join(" ")
  }
>
  Messages
</NavLink>

// style
<NavLink
  to="/messages"
  style={({ isActive, isPending }) => ({
    fontWeight: isActive ? "bold" : "",
    color: isPending ? "red" : "black",
  })}
>
  Messages
</NavLink>

// children
<NavLink to="/tasks">
  {({ isActive }) => (
    <span className={isActive ? "active" : ""}>Tasks</span>
  )}
</NavLink>
```

> `end` prop: 정확히 해당 경로일 때만 active. 없으면 하위 경로에서도 active.
> 예) `/` NavLink에 `end` 없으면 모든 페이지에서 active.

---

# Link

active 스타일이 필요 없는 일반 링크.

```typescript
import { Link } from "react-router";

export function LoggedOutMessage() {
  return (
    <p>
      You've been logged out.{" "}
      <Link to="/login">Login again</Link>
    </p>
  );
}
```

---

# Form (GET 네비게이션)

`method="get"` Form은 입력값을 URLSearchParams로 변환해 네비게이션한다.

```typescript
<Form action="/search">
  <input type="text" name="q" />
</Form>
// "journey" 입력 후 submit → /search?q=journey 로 네비게이션
```

> `method="post"` Form도 action으로 네비게이션하지만, POST 데이터 제출에는 `useFetcher()`가 더 일반적.

---

# redirect

loader/action 내부에서 URL을 전환할 때 사용한다.

```typescript
import { redirect } from "react-router";

// loader에서 인증 코드
const loader = async ({ request }: Route.LoaderArgs) => {
  const user = await getUser(request);
  if (!user) return redirect("/login"); // 미인증 시 로그인으로
  return { userName: user.name };
};

// action에서 생성 후 리다이렉트
const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const project = await createProject(formData);
  return redirect(`/projects/${project.id}`); // 생성된 상세 페이지로
};
```

---

# useNavigate

> **사용빈도를 낮게 유지할 것.** 유저가 상호작용하지 않는데 프로그래밍으로 네비게이션해야 할 때만 사용.
> 대부분의 케이스는 `<Link>`, `<Form>`, `redirect`로 해결 가능.

```typescript
import { useNavigate } from "react-router";

export function useLogoutAfterInactivity() {
  const navigate = useNavigate();

  useFakeInactivityHook(() => {
    navigate("/logout"); // 비활성 감지 시 자동 로그아웃
  });
}
```

**`useNavigate` 적합한 케이스:**

- 비활성 후 자동 로그아웃
- 타이머 기반 컨트롤 (타이머 만료 시 자동 제출)
- 외부 SDK 이벤트 응답 (직접 클릭 없이 이동)

---

# 네비게이션 수단 선택 기준

| 상황 | 권장 수단 |
|---|---|
| 일반 링크 | `<Link>` |
| 네비게이션 링크 + active 스타일 | `<NavLink>` |
| 검색어 등 GET 폼 | `<Form action="/search">` |
| 인증 체크 후 리다이렉트 | `redirect` (loader/action) |
| 상태 기반 자동 이동 | `useNavigate` |
| POST 데이터 제출 (네비게이션 O) | `<Form method="post">` / `useSubmit` |
| POST 데이터 제출 (네비게이션 X) | `<fetcher.Form>` / `fetcher.submit` |
