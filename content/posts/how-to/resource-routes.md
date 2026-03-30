---
title: 'Resource Routes'
date: '2026-03-31'
category: 'how-to'
order: 11
tags: ['react-router', 'resource-routes', 'api', 'loader', 'action']
description: 'React Router에서 Resource Route로 PDF, JSON, 웹훅 등 비-UI 리소스 서빙 — 정의, 링크, HTTP 메서드, 반환 타입, 에러 처리'
---

> 공식 문서: [https://reactrouter.com/how-to/resource-routes](https://reactrouter.com/how-to/resource-routes)
> React Router v7 기준

---

# 들어가며

일반적인 라우트는 loader로 데이터를 가져오고 컴포넌트를 렌더링해서 HTML을 반환한다. 하지만 때로는 HTML이 아닌 **다른 형태의 응답**이 필요하다 — PDF 파일, JSON API, 이미지, CSV 다운로드, 웹훅 엔드포인트 등.

Resource Route는 **UI 컴포넌트 없이 loader/action만으로** 이런 리소스를 서빙하는 라우트다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ✅ |
| Declarative Mode | ❌ |

---

# Resource Route 정의

라우트 모듈에서 `loader`나 `action`은 export하되, **default component를 export하지 않으면** Resource Route가 된다. 컨벤션일 뿐 별도의 설정이 필요 없다.

## 라우트 등록

```typescript
// app/routes.ts
import { route } from "@react-router/dev/routes";

export default [
  route("/reports/pdf/:id", "pdf-report.ts"),
];
```

## 라우트 모듈

```typescript
// app/pdf-report.ts
import type { Route } from "./+types/pdf-report";

export async function loader({ params }: Route.LoaderArgs) {
  const report = await getReport(params.id);
  const pdf = await generateReportPDF(report);
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
    },
  });
}
```

default export(컴포넌트)가 없다는 점이 핵심이다. 이 라우트에 접근하면 PDF 바이너리가 응답으로 반환된다.

---

# Resource Route에 링크 연결

Resource Route로 이동할 때는 반드시 `<a>` 태그 또는 `<Link reloadDocument>`를 사용해야 한다:

```tsx
<Link reloadDocument to="/reports/pdf/123">
  View as PDF
</Link>
```

일반 `<Link to="/reports/pdf/123">`를 사용하면 React Router가 **클라이언트 사이드 라우팅**을 시도한다. Resource Route에는 렌더링할 컴포넌트가 없으므로 에러가 발생한다. `reloadDocument`를 붙이면 브라우저의 기본 동작(전체 페이지 요청)으로 전환된다.

---

# HTTP 메서드 처리

loader와 action이 HTTP 메서드에 따라 분기된다:

| HTTP 메서드 | 핸들러 |
|---|---|
| GET | `loader` |
| POST, PUT, PATCH, DELETE | `action` |

```typescript
import type { Route } from "./+types/resource";

export function loader(_: Route.LoaderArgs) {
  return Response.json({ message: "GET 요청 처리" });
}

export function action(_: Route.ActionArgs) {
  return Response.json({ message: "POST/PUT/PATCH/DELETE 요청 처리" });
}
```

REST API 엔드포인트처럼 사용할 수 있다.

---

# 반환 타입

Resource Route는 반환 타입에 유연하다. `Response` 객체와 `data()` 유틸리티 중 선택할 수 있으며, **누가 이 라우트를 호출하느냐**에 따라 구분해서 사용한다.

## Response — 외부에서 직접 호출할 때

모바일 앱, 외부 서비스, 브라우저가 URL로 직접 접근하는 경우에 적합하다. React Router를 거치지 않는 순수 HTTP 통신이므로 응답을 명시적으로 구성한다:

```typescript
// app/api/search.ts
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const results = await db.products.search(q);

  return Response.json({ results, total: results.length });
}
```

```bash
# 외부에서 직접 HTTP 요청
curl https://myapp.com/api/search?q=shoes
# → { "results": [...], "total": 5 }
```

## data() — 앱 내부 fetcher/form으로 호출할 때

같은 앱의 컴포넌트에서 `useFetcher`로 호출하는 경우에 적합하다. React Router 내부를 통해 처리되므로 타입 추론과 스트리밍(`Await`)을 활용할 수 있다:

```typescript
// app/api/search.ts
import { data } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const results = await db.products.search(q);

  return data({ results, total: results.length });
}
```

```tsx
// app/components/search-box.tsx
import { useFetcher } from "react-router";

export function SearchBox() {
  const fetcher = useFetcher();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    fetcher.load(`/api/search?q=${e.target.value}`);
  }

  return (
    <div>
      <input onChange={handleChange} placeholder="검색..." />
      <ul>
        {fetcher.data?.results.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## 어떤 걸 써야 하나?

둘 다 결과는 같은 JSON이다. 차이는 React Router의 기능(타입 추론, `Await` 스트리밍)을 활용하느냐 마느냐다:

```
Response.json()  →  순수 HTTP 응답을 직접 구성 (React Router 관여 X)
data()           →  React Router가 중간에서 처리 (타입 추론, 스트리밍 지원)
```

| 호출 주체 | 추천 반환 방식 |
|---|---|
| 외부 시스템 / 브라우저 직접 접근 | `Response` |
| 앱 내부 `useFetcher` / `<Form>` | `data()` |

---

# 에러 처리

## throw Error → 500 응답 + handleError

`Error` 객체를 throw하면 500 HTTP 응답이 반환되고, `entry.server.tsx`의 `handleError`가 트리거된다:

```typescript
export async function action() {
  const db = await getDb();
  if (!db) {
    // 치명적 에러 — 500 응답 + handleError 트리거
    throw new Error("Could not connect to DB");
  }
  // ...
}
```

## throw/return Response → handleError 안 탐

`Response` 객체(또는 `data()`)를 throw하거나 return하면, 4xx/5xx 상태 코드라도 `handleError`가 **트리거되지 않는다**. 이는 `fetch()` API의 동작과 일치한다 — `fetch()`도 4xx/5xx 응답을 reject하지 않는다:

```typescript
export function action() {
  // 아래 4가지는 모두 동일하게 동작한다 — handleError를 트리거하지 않음

  // throw Response
  throw new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401 },
  );

  // return Response
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401 },
  );

  // throw data()
  throw data({ error: "Unauthorized" }, { status: 401 });

  // return data()
  return data({ error: "Unauthorized" }, { status: 401 });
}
```

정리하면:

| throw/return 대상 | handleError 트리거 | HTTP 상태 |
|---|---|---|
| `new Error("...")` | ✅ 트리거 | 500 |
| `new Response(...)` | ❌ | Response에 지정한 상태 코드 |
| `data(...)` | ❌ | data에 지정한 상태 코드 |

## ErrorBoundary와의 관계

Resource Route에서 에러를 throw하면, 해당 라우트를 **UI에서 fetcher나 Form으로 호출한 경우에만** 가장 가까운 `ErrorBoundary`로 버블링된다. 브라우저가 직접 접근한 경우에는 단순히 HTTP 에러 응답이 반환된다.

---

# 정리

| 항목 | 내용 |
|---|---|
| 정의 | loader/action만 export, default component 없음 |
| 링크 | `<a>` 또는 `<Link reloadDocument>` 필수 |
| GET 요청 | `loader`에서 처리 |
| POST/PUT/PATCH/DELETE | `action`에서 처리 |
| 외부 API 응답 | `Response` 객체 반환 |
| 내부 fetcher 응답 | `data()` 반환 |
| 치명적 에러 | `throw new Error()` → 500 + handleError |
| 비치명적 에러 | `throw/return Response` → handleError 안 탐 |
