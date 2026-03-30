---
title: '라우트 모듈 타입 안전성'
date: '2026-03-31'
category: 'how-to'
order: 12
tags: ['react-router', 'typescript', 'type-safety', 'typegen', 'loader']
description: 'React Router v7 Framework Mode에서 라우트별 타입 자동 생성 설정 — tsconfig 구성, typegen, AppLoadContext 타이핑'
---

> 공식 문서: [https://reactrouter.com/how-to/route-module-type-safety](https://reactrouter.com/how-to/route-module-type-safety)
> React Router v7 기준 — **Framework Mode 전용**

---

# 들어가며

React Router는 라우트별 타입을 자동 생성해서 URL params, loader 데이터 등에 대한 타입 추론을 제공한다. 템플릿으로 시작하면 이미 설정되어 있지만, 기존 프로젝트에 적용하려면 수동 설정이 필요하다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ❌ |
| Declarative Mode | ❌ |

---

# 설정

## 1. `.react-router/`를 `.gitignore`에 추가

React Router는 앱 루트에 `.react-router/` 디렉토리를 생성하고, 이곳에 타입 파일을 자동 관리한다. git에 포함시킬 필요가 없다:

```txt
.react-router/
```

## 2. tsconfig에 생성된 타입 포함

생성된 타입을 TypeScript가 인식하도록 `include`와 `rootDirs`를 설정한다. `rootDirs`를 설정하면 생성된 타입을 라우트 모듈의 **상대 경로 형제 파일**처럼 import할 수 있다:

```json
{
  "include": [".react-router/types/**/*"],
  "compilerOptions": {
    "rootDirs": [".", "./.react-router/types"]
  }
}
```

`rootDirs`가 없으면 `import type { Route } from "./+types/my-route"`처럼 import할 수 없다. TypeScript가 `.react-router/types/` 경로를 현재 디렉토리와 동일 루트로 취급하게 해주는 설정이다.

**멀티 tsconfig 프로젝트**: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.vite.json` 등 여러 설정 파일이 있다면, app 디렉토리를 `include`하는 설정 파일에 위 내용을 추가해야 한다.

## 3. 타입 체크 전 타입 생성

CI/CD 등에서 타입 체크를 별도 명령으로 실행하는 경우, **typegen을 먼저 실행**해야 한다:

```json
{
  "scripts": {
    "typecheck": "react-router typegen && tsc"
  }
}
```

개발 서버(`react-router dev`)를 실행하면 `routes.ts` 수정 시 타입이 자동으로 재생성되므로 별도 실행이 필요 없다.

## 4. AppLoadContext 타이핑

loader/action에서 사용하는 context 객체에 타입을 부여하려면 모듈 확장(declaration merging)을 사용한다:

```typescript
// app/env.d.ts 또는 별도 .d.ts 파일
import "react-router";

declare module "react-router" {
  interface AppLoadContext {
    db: Database;
    user: User | null;
  }
}
```

이렇게 하면 모든 loader/action의 `context` 파라미터에 타입이 적용된다.

## 5. Type-Only Auto-Import (선택)

TypeScript가 `Route` 타입을 auto-import하면 기본적으로 이렇게 생성된다:

```typescript
import { Route } from "./+types/my-route";
```

`verbatimModuleSyntax`를 활성화하면 `type` 수식어가 자동으로 붙는다:

```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

```typescript
import type { Route } from "./+types/my-route";
//     ^^^^
```

번들러가 타입 전용 모듈을 감지해서 번들에서 안전하게 제외할 수 있게 된다.

---

# 생성된 타입 사용 예시

`routes.ts`에 라우트를 등록하면 `.react-router/types/` 아래에 라우트별 타입이 자동 생성된다:

```typescript
// app/routes/product.tsx
import type { Route } from "./+types/product";

// params 타입이 자동 추론됨 — route("products/:id", "routes/product.tsx")
export async function loader({ params }: Route.LoaderArgs) {
  // params.id: string ← 자동 타이핑
  const product = await getProduct(params.id);
  return { product };
}

// loaderData 타입이 loader 반환값에서 자동 추론됨
export default function Product({ loaderData }: Route.ComponentProps) {
  // loaderData.product ← loader 반환 타입 그대로
  return <h1>{loaderData.product.name}</h1>;
}
```

수동으로 타입을 작성할 필요 없이, loader의 반환값이 컴포넌트의 `loaderData`까지 자동으로 흐른다.

---

# 정리

| 항목 | 내용 |
|---|---|
| 타입 생성 위치 | `.react-router/types/` (자동 관리, gitignore 대상) |
| tsconfig 설정 | `include` + `rootDirs` 필수 |
| CI/CD | `react-router typegen && tsc` |
| 개발 서버 | `routes.ts` 수정 시 자동 재생성 |
| Context 타이핑 | `declare module "react-router"` 모듈 확장 |
| import 스타일 | `verbatimModuleSyntax`로 `import type` 자동화 |
