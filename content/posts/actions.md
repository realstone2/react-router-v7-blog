---
title: "Actions"
date: "2026-02-22"
description: "React Router v7에서 action을 사용한 데이터 변경 처리"
tags: ["react-router", "actions", "forms"]
category: "core-concepts"
order: 5
---

> 공식 문서: [https://reactrouter.com/start/framework/actions](https://reactrouter.com/start/framework/actions)
> 데이터 뮤테이션의 핵심 — action / clientAction + 호출 방법 3가지

# 개요

RR v7에서 데이터 뮤테이션은 **Route action**을 통해 이루어진다.

> action이 완료되면 페이지의 **모든 loader 데이터가 자동 재검증**된다.
> 별도 코드 없이 UI가 서버 상태와 자동으로 동기화된다.

- `action` → 서버에서만 실행, 클라이언트 번들에서 제거됨
- `clientAction` → 브라우저에서만 실행, 둘 다 정의 시 우선순위 가짐

---

# clientAction vs action

## clientAction (브라우저 전용)

```typescript
// route('/projects/:projectId', './project.tsx')
import type { Route } from "./+types/project";
import { Form } from "react-router";
import { someApi } from "./api";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const title = formData.get("title");
  const project = await someApi.updateProject({ title }); // 클라이언트에서 직접 API 호출
  return project;
}

export default function Project({ actionData }: Route.ComponentProps) {
  return (
    <div>
      <Form method="post">
        <input type="text" name="title" />
        <button type="submit">Submit</button>
      </Form>
      {actionData ? <p>{actionData.title} updated</p> : null}
    </div>
  );
}
```

## action (서버 전용)

```typescript
import { fakeDb } from "../db"; // DB 접근 코드 — 클라이언트 번들에 포함되지 않음

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get("title");
  const project = await fakeDb.updateProject({ title }); // 서버에서 직접 DB 접근
  return project;
}
```

| | `action` | `clientAction` |
|---|---|---|
| 실행 위치 | 서버 | 브라우저 |
| 클라이언트 번들 | 포함 안 됨 | 포함됨 |
| DB/시크릿 키 사용 | 안전 | 노출 위험 |
| 둘 다 정의 시 | 무시됨 | 우선 실행 |
| actionData | `Route.ComponentProps`로 수신 | 동일 |

---

# Action 호출 방법 3가지

## 1. `<Form>` — 선언적 (네비게이션 발생)

```typescript
import { Form } from "react-router";

function SomeComponent() {
  return (
    <Form action="/projects/123" method="post">
      <input type="text" name="title" />
      <button type="submit">Submit</button>
    </Form>
  );
}
```

- submit 시 **네비게이션 발생** → 브라우저 history에 새 항목 추가
- `action` prop을 생략하면 현재 라우트의 action 호출

## 2. `useSubmit` — 명령적 (네비게이션 발생)

```typescript
import { useSubmit } from "react-router";

function useQuizTimer() {
  const submit = useSubmit();

  const cb = useCallback(() => {
    submit(
      { quizTimedOut: true },
      { action: "/end-quiz", method: "post" },
    );
  }, []);

  useFakeTimer(10 * 60 * 1000, cb); // 10분 후 자동 제출
}
```

- 폼 없이 **프로그래밍 방식**으로 action 호출
- 타이머, 이벤트 등 비폼 상황에서 유용
- 마찬가지로 네비게이션 발생

## 3. `fetcher.Form` / `fetcher.submit` — 네비게이션 없음

```typescript
import { useFetcher } from "react-router";

function Task() {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" action="/update-task/123">
      <input type="text" name="title" />
      <button type="submit">{busy ? "Saving..." : "Save"}</button>
    </fetcher.Form>
  );
}

// 명령적 버전
fetcher.submit(
  { title: "New Title" },
  { action: "/update-task/123", method: "post" },
);
```

- **URL 변경 없음**, history에 항목 추가 안 함
- 독립적인 `fetcher.state`로 개별 pending UI 가능
- 여러 개 동시 실행 가능

## 호출 방법 비교

| | `<Form>` | `useSubmit` | `fetcher.Form` |
|---|---|---|---|
| 네비게이션 | 발생 | 발생 | 없음 |
| 방식 | 선언적 | 명령적 | 선언적/명령적 |
| 주요 용도 | 일반 폼 제출 | 타이머/이벤트 기반 | 인라인 뮤테이션 |
| loader 재검증 | 자동 | 자동 | 자동 |

---

# TanStack Query와의 관계

action이 완료되면 RR v7이 loader를 자동 재검증한다.
TanStack Query와 함께 쓸 때는 **action 내에서 `queryClient.invalidateQueries`를 수동으로 호출**해야 TQ 캐시도 갱신된다.

```typescript
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  await fakeDb.updateProject(Object.fromEntries(formData));

  // RR v7 loader 재검증은 자동
  // TanStack Query 캐시는 수동 무효화 필요
  await queryClient.invalidateQueries({ queryKey: ["projects"] });

  return { ok: true };
}
```

---

# 정리

> **action = 서버 전용 뮤테이션, clientAction = 브라우저 전용 뮤테이션**
> 완료 시 모든 loader 자동 재검증 → UI 자동 동기화
>
> 호출 방법:
> - `<Form>` / `useSubmit` → 네비게이션 O
> - `fetcher.Form` / `fetcher.submit` → 네비게이션 X, 인라인 뮤테이션
