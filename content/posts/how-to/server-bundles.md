---
title: 'Server Bundles'
date: '2026-03-31'
category: 'how-to'
order: 14
tags: ['react-router', 'server-bundles', 'deployment', 'hosting', 'build']
description: 'React Router에서 라우트 트리를 여러 서버 번들로 분할 — serverBundles 설정, buildEnd 훅, 빌드 매니페스트'
---

> 공식 문서: [https://reactrouter.com/how-to/server-bundles](https://reactrouter.com/how-to/server-bundles)
> React Router v7 기준 — **Framework Mode 전용**

---

# 들어가며

React Router는 기본적으로 서버 코드를 **단일 번들**로 빌드하고, 하나의 요청 핸들러 함수를 export한다. 하지만 호스팅 환경에 따라 라우트 트리를 **여러 서버 번들로 분할**해야 할 때가 있다.

Server Bundles는 주로 **호스팅 프로바이더 통합**을 위한 고급 기능이다. 커스텀 라우팅 레이어가 앞단에서 요청을 적절한 번들로 전달하는 구조를 전제한다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ❌ |
| Declarative Mode | ❌ |

---

# serverBundles 설정

`react-router.config.ts`의 `serverBundles` 옵션은 각 라우트를 어떤 번들에 배치할지 결정하는 함수다.

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  serverBundles: ({ branch }) => {
    const isAuthenticatedRoute = branch.some((route) =>
      route.id.split("/").includes("_authenticated"),
    );

    return isAuthenticatedRoute
      ? "authenticated"
      : "unauthenticated";
  },
} satisfies Config;
```

## 동작 방식

- 라우트 트리의 **주소를 가진(addressable) 라우트**마다 호출된다 (경로 없는 레이아웃 라우트는 제외)
- `branch` 파라미터는 해당 라우트까지의 경로에 있는 라우트 배열이다
- 반환값은 **서버 번들 ID**로, `build/server/` 아래 디렉토리명이 된다. 같은 ID를 반환한 라우트끼리 하나의 번들로 묶인다

### 예시 코드 해석

위 코드의 라우트 구조가 다음과 같다고 가정하면:

```
app/routes/
├── home.tsx
├── about.tsx
├── _authenticated/          ← 폴더
│   ├── dashboard.tsx
│   └── settings.tsx
```

`serverBundles` 함수가 라우트마다 호출될 때:

```typescript
// /home → branch: [{ id: "routes/home" }]
"routes/home".split("/") → ["routes", "home"]
.includes("_authenticated") → false
→ return "unauthenticated"

// /dashboard → branch: [{ id: "routes/_authenticated/dashboard" }]
"routes/_authenticated/dashboard".split("/") → ["routes", "_authenticated", "dashboard"]
.includes("_authenticated") → true
→ return "authenticated"
```

반환된 문자열이 빌드 폴더명이 된다:

```
build/server/
├── unauthenticated/
│   └── index.js      ← home, about 라우트만 포함
└── authenticated/
    └── index.js      ← dashboard, settings 라우트만 포함
```

문자열 자체는 임의의 값이다. `"a"`, `"public"` 등 무엇이든 상관없고, 같은 문자열을 반환한 라우트가 같은 번들로 묶이는 **그룹 키** 역할을 한다.

## branch 배열의 route 속성

| 속성 | 설명 | 예시 |
|---|---|---|
| `id` | 라우트 고유 식별자 (app 디렉토리 기준 상대 경로, 확장자 제외) | `routes/gists.$username` |
| `path` | URL 매칭에 사용되는 경로 패턴 | `gists/:username` |
| `file` | 라우트 파일의 절대 경로 | `/app/routes/gists.$username.tsx` |
| `index` | 인덱스 라우트 여부 | `true` / `false` |

---

# 빌드 매니페스트

빌드 완료 시 React Router는 `buildEnd` 훅을 호출하면서 `buildManifest` 객체를 전달한다. 이를 통해 커스텀 라우팅 레이어를 구성할 수 있다.

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  serverBundles: ({ branch }) => {
    // ... 번들 분할 로직
  },
  buildEnd: async ({ buildManifest }) => {
    console.log(buildManifest);
  },
} satisfies Config;
```

## buildManifest 속성

| 속성 | 설명 |
|---|---|
| `serverBundles` | 번들 ID → `{ id, file }` 매핑. 각 번들의 빌드 파일 위치 |
| `routeIdToServerBundleId` | 라우트 ID → 번들 ID 매핑. 요청 라우팅에 사용 |
| `routes` | 라우트 ID → 라우트 메타데이터 매핑. 커스텀 라우팅 레이어 구성에 사용 |

예를 들어 `routeIdToServerBundleId`는 이런 형태다:

```json
{
  "routes/home": "unauthenticated",
  "routes/dashboard": "authenticated",
  "routes/settings": "authenticated"
}
```

이 정보를 기반으로 앞단의 라우팅 레이어(Nginx, Cloudflare Workers 등)가 요청을 올바른 서버 번들로 전달할 수 있다.

---

# 사용 사례

- **인증/비인증 분리**: 인증이 필요한 라우트와 공개 라우트를 별도 번들로 분리
- **호스팅 프로바이더 통합**: 여러 진입점이 필요한 배포 환경 지원
- **독립 스케일링**: 트래픽 패턴이 다른 라우트 그룹을 독립적으로 확장

---

# 정리

| 항목 | 내용 |
|---|---|
| 목적 | 라우트 트리를 여러 서버 번들로 분할 |
| 설정 | `react-router.config.ts`의 `serverBundles` 함수 |
| 분할 기준 | `branch` 배열을 보고 번들 ID 반환 |
| 빌드 후처리 | `buildEnd` 훅에서 `buildManifest` 활용 |
| 대상 | 호스팅 프로바이더 통합, 고급 배포 구성 |
