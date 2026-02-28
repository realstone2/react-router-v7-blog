---
title: 'Actions'
date: '2026-02-22'
description: 'React Router v7에서 action을 사용한 데이터 변경 처리'
tags: ['react-router', 'actions', 'forms']
category: 'core-concepts'
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
- 제출 결과를 컴포넌트에서 읽을 때는 `useActionData`(또는 타입드 라우트의 `Route.ComponentProps.actionData`)를 사용

---

# clientAction vs action

## clientAction (브라우저 전용)

클라이언트 작업은 브라우저에서만 실행되며, 서버 작업보다 우선순위를 가진다.

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
import { fakeDb } from '../db'; // DB 접근 코드 — 클라이언트 번들에 포함되지 않음

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get('title');
  const project = await fakeDb.updateProject({ title }); // 서버에서 직접 DB 접근
  return project;
}
```

## action vs clientAction

|                   | `action`                                               | `clientAction` |
| ----------------- | ------------------------------------------------------ | -------------- |
| 실행 위치         | 서버                                                   | 브라우저       |
| 클라이언트 번들   | 포함 안 됨                                             | 포함됨         |
| DB/시크릿 키 사용 | 안전                                                   | 노출 위험      |
| 둘 다 정의 시     | 무시됨                                                 | 우선 실행      |
| 결과 읽기         | `useActionData` 또는 `Route.ComponentProps.actionData` | 동일           |

## `useActionData` 기본 사용

`action`/`clientAction`이 `return`한 값은 해당 라우트 컴포넌트에서 `useActionData<typeof action>()`로 읽을 수 있다.
단, 가장 최근 제출 결과만 유지되며 새 제출이 성공하면 이전 actionData는 덮어써진다.

```typescript
import { Form, useActionData } from "react-router";

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function action(): Promise<ActionResult> {
  return { ok: true, message: "저장 완료" };
}

export default function ProjectForm() {
  const actionData = useActionData<typeof action>();

  return (
    <>
      <Form method="post">
        <button type="submit">저장</button>
      </Form>
      {actionData?.ok ? <p>{actionData.message}</p> : null}
      {actionData && !actionData.ok ? <p>{actionData.error}</p> : null}
    </>
  );
}
```

- 페이지 최초 로드 시 `actionData`는 `undefined`
- 같은 라우트에서 발생한 가장 최근 제출 결과를 반환
- 리다이렉트(`redirect`)를 반환한 경우 현재 화면에는 actionData가 남지 않음
- `actionData`는 캐시가 아니라 **최근 제출 결과 스냅샷**이며, 지속적인 서버 상태 관리는 loader/useQuery가 담당

---

# Action 호출 방법 3가지

## 1. `Form` — 선언적 (네비게이션 발생)

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
import { useSubmit } from 'react-router';

function useQuizTimer() {
  const submit = useSubmit();

  const cb = useCallback(() => {
    submit({ quizTimedOut: true }, { action: '/end-quiz', method: 'post' });
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
- 이 경우 결과는 `useActionData`가 아니라 `fetcher.data`로 읽어야 함

## 호출 방법 비교

|               | `<Form>`     | `useSubmit`        | `fetcher.Form`  |
| ------------- | ------------ | ------------------ | --------------- |
| 네비게이션    | 발생         | 발생               | 없음            |
| 방식          | 선언적       | 명령적             | 선언적/명령적   |
| 주요 용도     | 일반 폼 제출 | 타이머/이벤트 기반 | 인라인 뮤테이션 |
| loader 재검증 | 자동         | 자동               | 자동            |

---

# TanStack Query와의 관계

action이 완료되면 RR v7이 loader를 자동 재검증한다.
TanStack Query 캐시는 별도 시스템이므로, 클라이언트의 `queryClient`가 있는 위치에서 수동으로 무효화해야 한다.
즉, 서버 `action`의 자동 재검증과 TanStack Query의 캐시 무효화는 서로 다른 메커니즘이다.

```typescript
export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  await updateProject(Object.fromEntries(formData));

  // RR v7 loader 재검증은 자동
  // TanStack Query 캐시는 클라이언트에서 수동 무효화
  await queryClient.invalidateQueries({ queryKey: ['projects'] });

  return { ok: true };
}
```

---

# React Router Action 패턴 vs `useMutation`

|                    | React Router action 패턴 (`<Form>`/`useSubmit`/`fetcher`) | `useMutation` (TanStack Query)                         |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------ |
| 실행 주체          | React Router 라우트 제출 흐름                             | 컴포넌트/훅에서 직접 호출                              |
| 서버 실행 지원     | `action`을 쓰면 서버에서 실행(클라이언트 번들 제외)       | 기본적으로 브라우저에서 실행(서버 함수 직접 실행 아님) |
| 보안/비밀값 처리   | DB 접근, 시크릿 키 처리에 유리(`action`)                  | 시크릿 키/DB 직접 접근 로직을 둘 수 없음               |
| 상태 읽기          | `useActionData`, `useNavigation`, `fetcher.state`         | `data`, `error`, `isPending`, `isSuccess`              |
| 결과 데이터 성격   | 최근 제출 1회 결과(캐시 아님)                             | mutation 상태 객체를 훅이 지속 관리                    |
| 캐시 동기화        | loader 재검증 자동                                        | `invalidateQueries` 등 직접 설계                       |
| 네트워크 경로 관점 | `<Form>`/`submit` → 라우트 action 처리(라우터 중심)       | `mutationFn` 안에서 API 엔드포인트를 직접 호출         |
| 고급 기능          | 폼/리다이렉트 중심, 단순한 흐름                           | retry, optimistic update, rollback에 강점              |
| 적합한 경우        | 라우트 폼 제출, 서버 액션 중심 앱                         | 복잡한 클라이언트 캐시 제어가 필요한 앱                |

참고: `useActionData`는 위 action 패턴에서 "제출 결과를 읽는 훅"이고, `useMutation`은 "클라이언트 mutation 상태를 관리하는 훅"이다.

---

# 정리

> **action = 서버 전용 뮤테이션, clientAction = 브라우저 전용 뮤테이션**
> 완료 시 모든 loader 자동 재검증 → UI 자동 동기화
>
> 결과 읽기:
>
> - 라우트 제출 결과는 `useActionData`(또는 `Route.ComponentProps.actionData`)
> - fetcher 제출 결과는 `fetcher.data`
>
> 호출 방법:
>
> - `<Form>` / `useSubmit` → 네비게이션 O
> - `fetcher.Form` / `fetcher.submit` → 네비게이션 X, 인라인 뮤테이션
>
> 선택 기준:
>
> - 서버에서 안전하게 처리해야 하는 폼 제출/리다이렉트 흐름이면 `action/useActionData`
> - 낙관적 업데이트/재시도/세밀한 캐시 제어가 핵심이면 `useMutation`
