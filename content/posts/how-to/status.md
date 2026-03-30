---
title: 'HTTP 상태 코드'
date: '2026-03-31'
category: 'how-to'
order: 16
tags: ['react-router', 'status-code', 'loader', 'action', 'data', 'error-boundary']
description: 'React Router에서 loader/action의 HTTP 상태 코드 설정 — data() 함수, 에러 처리, ErrorBoundary 연동'
---

> 공식 문서: [https://reactrouter.com/how-to/status](https://reactrouter.com/how-to/status)
> React Router v7 기준

---

# 들어가며

loader와 action에서 기본 HTTP 상태 코드는 200이다. 커스텀 상태 코드를 설정하려면 `data()` 함수를 사용한다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ✅ |
| Declarative Mode | ❌ |

---

# Action에서 상태 코드 설정

`data()` 함수의 두 번째 인자로 `{ status }` 옵션을 전달한다:

```tsx
// route('/projects/:projectId', './project.tsx')
import type { Route } from "./+types/project";
import { data } from "react-router";
import { fakeDb } from "../db";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get("title");

  if (!title) {
    // 400 Bad Request — 유효하지 않은 입력
    return data(
      { message: "Invalid title" },
      { status: 400 },
    );
  }

  if (!projectExists(title)) {
    // 201 Created — 새 리소스 생성
    const project = await fakeDb.createProject({ title });
    return data(project, { status: 201 });
  } else {
    // 200 OK — 기본 상태 코드이므로 data() 없이 반환 가능
    const project = await fakeDb.updateProject({ title });
    return project;
  }
}
```

- **200 OK**: 기본값이므로 `data()`로 감쌀 필요 없이 그대로 반환
- **201 Created**: 새 리소스 생성 시
- **400 Bad Request**: 유효성 검증 실패 시

---

# Loader에서 상태 코드 설정

리소스를 찾을 수 없을 때 404를 반환하는 가장 일반적인 패턴:

```tsx
import type { Route } from "./+types/project";
import { data } from "react-router";
import { fakeDb } from "../db";

export async function loader({ params }: Route.LoaderArgs) {
  const project = await fakeDb.getProject(params.id);

  if (!project) {
    // throw로 ErrorBoundary에 전달
    throw data(null, { status: 404 });
  }

  return project;
}
```

## return vs throw

| 방식 | 동작 |
|---|---|
| `return data(...)` | 컴포넌트가 정상 렌더링되고, 반환된 데이터를 `loaderData`로 사용 |
| `throw data(...)` | 가장 가까운 `ErrorBoundary`가 렌더링됨 |

404 같은 "더 이상 진행할 수 없는" 상황에서는 `throw`를 사용한다. 400 같은 "에러지만 컴포넌트에서 처리 가능한" 상황에서는 `return`을 사용한다.

---

# 정리

| 항목 | 내용 |
|---|---|
| 기본 상태 코드 | 200 (별도 설정 불필요) |
| 커스텀 상태 코드 | `data(payload, { status })` |
| 404 패턴 | `throw data(null, { status: 404 })` → ErrorBoundary |
| 400 패턴 | `return data({ message }, { status: 400 })` → 컴포넌트에서 처리 |
| return | 컴포넌트 정상 렌더링 |
| throw | ErrorBoundary로 전달 |
