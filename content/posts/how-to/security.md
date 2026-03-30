---
title: '보안 (CSP)'
date: '2026-03-31'
category: 'how-to'
order: 13
tags: ['react-router', 'security', 'csp', 'nonce', 'content-security-policy']
description: 'React Router에서 Content-Security-Policy(CSP) 구현 — nonce 설정, inline script 보안 처리'
---

> 공식 문서: [https://reactrouter.com/how-to/security](https://reactrouter.com/how-to/security)
> React Router v7 기준 — **Framework Mode 전용**

---

# 들어가며

이 문서는 React Router에서 Content-Security-Policy(CSP)를 구현하는 방법을 다룬다. 포괄적인 보안 가이드가 아니라, React Router가 생성하는 인라인 스크립트에 대한 CSP 설정에 초점을 맞춘다.

---

# Content-Security-Policy (CSP)

## CSP란?

CSP는 브라우저에게 "이 페이지에서 허용하는 리소스 출처"를 알려주는 HTTP 헤더다. XSS(Cross-Site Scripting) 공격을 방어하는 핵심 메커니즘이다.

CSP에서 `script-src` 정책을 설정하면, 허용되지 않은 인라인 `<script>`는 브라우저가 실행을 차단한다. 문제는 React Router가 hydration 등을 위해 인라인 스크립트를 생성한다는 점이다.

## nonce를 사용한 인라인 스크립트 허용

`nonce`(number used once)는 **요청마다 생성되는 고유 문자열**이다. 서버가 CSP 헤더에 nonce 값을 포함하고, 인라인 스크립트에도 같은 nonce를 부여하면 브라우저가 해당 스크립트를 신뢰한다:

```
Content-Security-Policy: script-src 'nonce-abc123'
```

```html
<!-- nonce가 일치하므로 실행 허용 -->
<script nonce="abc123">/* ... */</script>

<!-- nonce가 없으므로 실행 차단 -->
<script>/* 악성 코드 */</script>
```

## React Router에서 nonce 설정

인라인 스크립트를 생성하는 **모든 API에 동일한 nonce를 전달**해야 한다:

### root.tsx

```tsx
export default function Root() {
  const nonce = useNonce(); // 요청별 nonce를 가져오는 커스텀 hook

  return (
    <html>
      <head>{/* ... */}</head>
      <body>
        <Outlet />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}
```

### entry.server.tsx

```tsx
// Streaming 방식 (Node.js)
const stream = renderToPipeableStream(
  <ServerRouter nonce={nonce} />,
  { nonce }
);

// Streaming 방식 (Edge)
const stream = renderToReadableStream(
  <ServerRouter nonce={nonce} />,
  { nonce }
);
```

## nonce 전달이 필요한 API 목록

| API | 위치 | 설명 |
|---|---|---|
| `<Scripts nonce>` | root.tsx | 클라이언트 번들 스크립트 |
| `<ScrollRestoration nonce>` | root.tsx | 스크롤 복원 인라인 스크립트 |
| `<ServerRouter nonce>` | entry.server.tsx | 서버 렌더링 시 인라인 스크립트 |
| `renderToPipeableStream({ nonce })` | entry.server.tsx | Node.js 스트리밍 렌더링 |
| `renderToReadableStream({ nonce })` | entry.server.tsx | Edge 스트리밍 렌더링 |

**핵심:** 모든 API에 **동일한 nonce 값**을 전달해야 한다. nonce는 요청마다 새로 생성해야 하며, 재사용하면 보안 효과가 사라진다.

---

# 정리

| 항목 | 내용 |
|---|---|
| 목적 | CSP 정책 하에서 인라인 스크립트 허용 |
| 방법 | 요청마다 고유 nonce 생성 → 모든 스크립트 API에 전달 |
| 대상 API | `Scripts`, `ScrollRestoration`, `ServerRouter`, `renderTo*Stream` |
| 주의 | nonce는 요청마다 새로 생성, 재사용 금지 |
