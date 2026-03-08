---
title: "entry.server.tsx — 서버 진입점"
date: "2026-03-08"
description: "React Router Framework Mode의 서버 진입점 entry.server.tsx와 4가지 export 정리"
tags: ["react-router", "framework-conventions", "ssr", "streaming"]
category: "framework-conventions"
order: 5
---

> 공식 문서: [https://reactrouter.com/api/framework-conventions/entry.server.tsx](https://reactrouter.com/api/framework-conventions/entry.server.tsx)
> React Router v7 기준 (Framework Mode 전용)

---

# 들어가며

`entry.server.tsx`는 **서버에서 HTTP 응답을 만드는 진입점**이다.
클라이언트가 페이지를 요청하면, 이 파일이 HTML을 생성해서 응답한다.

`entry.client.tsx`와 짝을 이룬다.

```
브라우저 요청
  → entry.server.tsx 가 HTML 생성 (SSR)
  → 브라우저가 HTML 수신
  → entry.client.tsx 가 hydration (React 연결)
```

### 이 파일이 없으면?

**Node.js 환경**에서는 React Router가 기본 구현을 자동으로 사용하므로 없어도 된다.
**비 Node.js 환경**(Cloudflare Workers 등)에서는 직접 작성해야 한다.

기본 구현으로 제어할 수 없는 것이 필요할 때만 작성한다.

| 필요한 상황 | 사용하는 export |
|---|---|
| 에러를 Sentry 등으로 전송 | `handleError` |
| 모든 데이터 응답에 공통 헤더 추가 | `handleDataRequest` |
| 스트리밍이 오래 걸리면 강제 종료 | `streamTimeout` |
| Cloudflare Workers 같은 비 Node.js 환경 | `default` 직접 구현 |

### Cloudflare Workers는 왜 직접 작성해야 하나

기본 구현은 `node:stream`, `@react-router/node` 같은 **Node.js 전용 패키지**를 사용한다.
Cloudflare Workers는 V8 엔진을 직접 실행하는 환경으로 Node.js API를 사용할 수 없고, **Web 표준 API만** 사용 가능하다.

```tsx
// Cloudflare Workers용 — Node.js stream 대신 Web 표준 ReadableStream 사용
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  const stream = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
  );

  return new Response(stream, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
```

단, Vercel·Netlify·Cloudflare 같은 주요 플랫폼은 **preset이 이 파일을 대신 처리**해주므로 직접 작성할 필요가 없다. 직접 작성이 필요한 경우는 preset 없이 커스텀 환경을 구성할 때뿐이다.

```bash
npx react-router reveal  # 기본 구현 파일로 꺼내기
```

---

# 1. default export — handleRequest

요청을 받아 HTML 응답을 만드는 **핵심 함수**다.

```typescript
export default function handleRequest(
  request: Request,           // 들어온 HTTP 요청
  responseStatusCode: number, // 응답 상태 코드
  responseHeaders: Headers,   // 응답 헤더
  routerContext: EntryContext, // 현재 요청의 라우터 컨텍스트
): Promise<Response>
```

### 기본 구현 (Node.js)

```tsx
import { PassThrough } from "node:stream";
import type { EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { renderToPipeableStream } from "react-dom/server";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          // HTML shell이 준비되면 스트리밍 시작
          responseHeaders.set("Content-Type", "text/html");

          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
      },
    );
  });
}
```

`renderToPipeableStream`으로 HTML을 **스트리밍** 방식으로 전송한다.
shell(기본 HTML 구조)이 준비되는 즉시 응답을 시작하고, 나머지 콘텐츠는 이후에 순차적으로 전송된다.

---

# 2. streamTimeout (선택)

스트리밍 중인 Promise들이 얼마나 기다릴지 제한하는 타임아웃 값 (밀리초).

`Suspense`로 감싼 비동기 컴포넌트가 너무 오래 걸릴 때, 무한정 기다리지 않고 에러 바운더리로 fallback하도록 강제한다.

```typescript
// 10초 후 미완료 Promise를 강제 거부
export const streamTimeout = 10000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() { /* ... */ },
        onShellError(error: unknown) { reject(error); },
      },
    );

    // streamTimeout보다 1초 늦게 abort — 거부된 바운더리가 flush될 시간 확보
    setTimeout(abort, streamTimeout + 1000);
  });
}
```

`streamTimeout`(Promise 거부) 후 React 렌더러가 에러 바운더리를 flush할 시간이 필요하므로,
`abort` 호출은 `streamTimeout + 1000ms` 뒤에 한다.

---

# 3. handleDataRequest (선택)

클라이언트 hydration 이후 발생하는 **데이터 요청의 응답을 수정**한다.

페이지 전체 HTML이 아니라, 클라이언트 라우팅 시 loader/action 데이터만 JSON으로 주고받는 요청에 적용된다.

```typescript
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

export function handleDataRequest(
  response: Response,
  { request, params, context }: LoaderFunctionArgs | ActionFunctionArgs,
) {
  // 모든 데이터 응답에 커스텀 헤더 추가
  response.headers.set("X-Custom-Header", "value");
  return response;
}
```

공통 헤더 추가, 캐시 제어, 데이터 응답 로깅 등에 활용한다.

---

# 4. handleError (선택)

서버에서 발생하는 에러를 처리한다. 구현하면 React Router의 기본 에러 로깅이 비활성화된다.

```typescript
export function handleError(
  error: unknown,
  { request, params, context }: LoaderFunctionArgs | ActionFunctionArgs,
) {
  // 요청이 취소된 경우 로깅 스킵
  if (!request.signal.aborted) {
    sendErrorToSentry(error);
    console.error(error);
  }
}
```

### 주의사항

**`request.signal.aborted` 체크가 중요하다.**
사용자가 페이지를 떠나거나 새 요청을 보내면 이전 요청이 취소(abort)되는데,
이 경우에도 에러가 발생할 수 있어 체크 없이 로깅하면 노이즈가 많아진다.

**`handleError`가 처리하지 않는 것들**
- loader/action에서 의도적으로 `throw new Response(404)` 한 경우 → 에러가 아닌 정상 흐름
- 스트리밍 중 발생한 에러 → `renderToPipeableStream`의 `onError` 콜백에서 처리

### 스트리밍 에러 처리

```tsx
let shellRendered = false;

const { pipe, abort } = renderToPipeableStream(
  <ServerRouter context={routerContext} url={request.url} />,
  {
    onShellReady() {
      shellRendered = true;
      // ...
    },
    onError(error: unknown) {
      // shell 렌더링 전 에러 vs 스트리밍 중 에러 구분
      if (shellRendered) {
        console.error("스트리밍 중 에러:", error);
      }
    },
  },
);
```

---

# export 정리

| export | 필수 | 역할 |
|---|---|---|
| `default` (handleRequest) | O | HTML 응답 생성 |
| `streamTimeout` | X | 스트리밍 타임아웃 설정 |
| `handleDataRequest` | X | 데이터 요청 응답 수정 |
| `handleError` | X | 서버 에러 처리 및 리포팅 |

---

# entry.server.tsx vs entry.client.tsx

| | entry.server.tsx | entry.client.tsx |
|---|---|---|
| 실행 환경 | 서버 | 브라우저 |
| 역할 | HTML 생성 | hydration |
| 핵심 API | `renderToPipeableStream` | `hydrateRoot` |
| 핵심 컴포넌트 | `<ServerRouter />` | `<HydratedRouter />` |
