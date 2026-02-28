---
title: "Using Fetchers"
date: "2026-02-22"
description: "useFetcher를 활용한 비내비게이션 데이터 처리"
tags: ["react-router", "fetcher"]
category: "core-concepts"
order: 7
---

> 공식 문서: [https://reactrouter.com/how-to/fetchers](https://reactrouter.com/how-to/fetchers)
> 네비게이션 없이 독립적으로 데이터를 로드하거나 뮤테이션할 때 사용

# 개요

**Fetcher**는 네비게이션을 일으키지 않고 loader/action과 상호작용하는 독립적인 비동기 단위다.

- 각 fetcher는 **자신만의 state**를 가진다 (`idle` / `loading` / `submitting`)
- 여러 fetcher를 동시에 사용할 수 있다
- 주요 use case: **action 호출**(데이터 뮤테이션) + **data loading**(combobox 등)

```javascript
일반 Form / navigate → URL 변경 O, 전체 로더 재검증
fetcher.Form / fetcher.submit → URL 변경 X, 독립 실행
```

---

# Part 1 — Calling Actions (데이터 뮤테이션)

## 1. Action 추가

```typescript
export async function clientAction({ request }: Route.ClientActionArgs) {
  let data = await request.formData();
  let title = data.get("title") as string;

  if (title.trim() === "") {
    return { ok: false, error: "Title cannot be empty" };
  }

  localStorage.setItem("title", title);
  return { ok: true, error: null };
}
```

## 2. useFetcher로 Form 렌더링

```typescript
import { useLoaderData, useFetcher } from "react-router";

export default function Component() {
  const data = useLoaderData();
  const fetcher = useFetcher();

  return (
    <div>
      <h1>{data.title}</h1>
      <fetcher.Form method="post">
        <input type="text" name="title" />
      </fetcher.Form>
    </div>
  );
}
```

> `fetcher.Form`을 submit하면 action을 호출하고 route data를 자동 재검증한다.
> `<Form>`과 달리 페이지 이동이 없다.

## 3. Pending State

```typescript
{fetcher.state !== "idle" && <p>Saving...</p>}
```

## 4. Optimistic UI

action이 완료되기 전에 form data를 읽어서 미리 UI를 업데이트한다.

```typescript
const title = fetcher.formData?.get("title") || data.title;
// fetcher.formData: 제출 중인 폼 데이터 (submitting 상태일 때 존재)
// action 완료 전에도 새 title을 바로 표시
```

## 5. fetcher.data — 에러 처리

action에서 반환한 데이터는 `fetcher.data`로 접근한다. 성공/실패 메시지 처리에 유용.

```typescript
{fetcher.data?.error && (
  <p style={{ color: "red" }}>{fetcher.data.error}</p>
)}
```

## 전체 흐름 요약

```javascript
[유저 입력]
  ↓ fetcher.Form submit
[action 실행]
  ↓ return { ok, error }
[fetcher.data에 결과 저장]
  ↓ 자동 재검증 (loader 재실행)
[UI 업데이트]
```

---

# Part 2 — Loading Data (데이터 로딩)

URL 변경 없이 다른 라우트의 loader를 호출해 데이터를 가져온다.
대표적인 use case: **검색 combobox**

## 1. 검색 라우트 생성

```typescript
// app/routes/search-users.tsx
// route: /search-users

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  return users.filter((user) =>
    user.name.toLowerCase().includes(query!.toLowerCase())
  );
}
```

## 2. Combobox 컴포넌트에서 fetcher 사용

```typescript
import { useFetcher } from "react-router";
import type { loader } from "./search-users"; // 타입만 import

export function UserSearchCombobox() {
  const fetcher = useFetcher<typeof loader>(); // 타입 추론

  return (
    <div>
      <fetcher.Form method="get" action="/search-users">
        <input
          type="text"
          name="q"
          onChange={(event) => {
            fetcher.submit(event.currentTarget.form); // 타이핑마다 즉시 검색
          }}
        />
      </fetcher.Form>

      {fetcher.data && (
        <ul style={{ opacity: fetcher.state === "idle" ? 1 : 0.25 }}>
          {fetcher.data.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**포인트:**

- `action="/search-users"` → 다른 라우트의 loader 호출
- `method="get"` → loader 호출 (action 아님)
- `useFetcher<typeof loader>()` → `fetcher.data` 타입 자동 추론
- `fetcher.submit(form)` → 엔터 없이 onChange마다 즉시 제출
- `opacity` 조절로 로딩 중 시각적 피드백

## 전체 흐름

```javascript
[유저 타이핑]
  ↓ fetcher.submit (onChange)
[/search-users loader 실행]
  ↓ return 필터된 유저 목록
[fetcher.data 업데이트]
  ↓
[<ul> 렌더링, 로딩 중엔 opacity 0.25]
```

---

# fetcher 핵심 API 정리

| API | 설명 |
|---|---|
| `fetcher.state` | `"idle"` / `"loading"` / `"submitting"` |
| `fetcher.data` | loader/action의 반환값 |
| `fetcher.formData` | 제출 중인 폼 데이터 (Optimistic UI용) |
| `fetcher.Form` | 네비게이션 없는 form 컴포넌트 |
| `fetcher.submit(form)` | 프로그래밍 방식으로 제출 |
| `useFetcher<typeof loader>()` | fetcher.data 타입 추론 |

---

# Form vs fetcher.Form vs navigate 비교

| | `<Form>` | `<fetcher.Form>` | `navigate()` |
|---|---|---|---|
| URL 변경 | ✅ | ❌ | ✅ |
| loader 재검증 | ✅ (전체) | ✅ (action 후) | ✅ |
| 독립 state | ❌ | ✅ | ❌ |
| 동시 실행 | ❌ | ✅ (여러 개) | ❌ |
| Optimistic UI | 어렵 | ✅ (`fetcher.formData`) | ❌ |

---

# TanStack Query와의 관계

**Loading Data** use case는 TanStack Query의 역할과 겹친다.

| | `fetcher` (Loading Data) | TanStack Query |
|---|---|---|
| 데이터 로드 | 다른 라우트의 loader 호출 | queryFn 직접 정의 |
| 캐싱 | ❌ (캐시 없음) | ✅ (staleTime 기반) |
| 백그라운드 리페치 | ❌ | ✅ |
| 사용 위치 | RR v7 라우트와 강하게 결합 | 어디서든 사용 가능 |

> 검색 combobox처럼 **캐싱이 필요 없거나**, RR v7 라우트 구조를 그대로 활용하고 싶을 때 fetcher가 적합.
> 캐싱, 백그라운드 리페치, stale 관리가 필요하면 TanStack Query를 쓰는 게 낫다.

---

# 정리

> **Fetcher는 "네비게이션 없는 loader/action 호출기"다.**
> - 뮤테이션: `fetcher.Form method="post"` → action 호출 → 자동 재검증
> - 데이터 로딩: `fetcher.Form method="get"` → 다른 라우트 loader 호출
> - Optimistic UI: `fetcher.formData`로 즉각적인 UI 업데이트
> - 타입 안전: `useFetcher<typeof loader>()`로 자동 추론
