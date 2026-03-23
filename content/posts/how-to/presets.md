---
title: "프리셋 (Presets)"
date: "2026-03-23"
description: "React Router Preset API로 재사용 가능한 설정 패키지 만들기 — 설정 구성, 유효성 검증"
tags: ["react-router", "presets", "config", "plugin", "build"]
category: "how-to"
order: 9
---

> 공식 문서: [https://reactrouter.com/how-to/presets](https://reactrouter.com/how-to/presets)
> React Router v7 기준

---

# 들어가며

React Router 설정을 다른 프로젝트에서도 재사용하려면 어떻게 할까?

Preset은 **react-router.config.ts의 설정을 재사용 가능한 패키지로 캡슐화하는 도구**다.
플랫폼 통합 라이브러리를 만들 때, 또는 팀 표준 설정을 배포할 때 유용하다.

> **주의:** Preset 소비 방법(사용자 관점)은 [react-router.config 가이드](../framework-conventions/react-router-config.md) 섹션 13을 참고하자.
> 이 글은 **Preset을 직접 만드는 방법**에 집중한다.

---

# Preset이란

Preset은 다음을 할 수 있다:

- **설정 구성**: react-router.config.ts의 옵션을 제공한다
- **설정 유효성 검증**: 최종 병합된 설정을 검증한다

Preset은 **빌드 타임에만 동작**하며, **런타임 동작을 변경할 수 없다.**

## 병합 우선순위

```
Preset 1 → Preset 2 → ... → 사용자 config
```

여러 Preset을 사용할 때는 배열 순서대로 적용되고, **사용자 config가 항상 최우선**이다.

---

# Preset 인터페이스

```typescript
import type { Preset } from "@react-router/dev/config";

interface Preset {
  name: string;
  reactRouterConfig?: () =>
    Partial<Config>;
  reactRouterConfigResolved?: (args: {
    reactRouterConfig: Config;
  }) => void | Promise<void>;
}
```

| 필드 | 설명 |
|------|------|
| `name` | 필수. 디버깅 용도의 식별자. 빌드 에러 메시지에 포함된다. |
| `reactRouterConfig()` | 선택. 이 Preset이 제공할 설정을 반환하는 함수 |
| `reactRouterConfigResolved()` | 선택. 모든 Preset과 사용자 config가 병합된 후 최종 설정을 검증하는 함수 |

---

# 기본 Preset 만들기

가장 간단한 Preset은 설정을 제공하기만 한다:

```typescript
// packages/my-preset/index.ts
import type { Preset } from "@react-router/dev/config";

export function myPreset(): Preset {
  return {
    name: "my-preset",
    reactRouterConfig: () => ({
      serverBundles: ({ branch }) => {
        const isAuth = branch.some((route) =>
          route.id.split("/").includes("_authenticated")
        );
        return isAuth ? "authenticated" : "unauthenticated";
      },
    }),
  };
}
```

사용 측에서는:

```typescript
// react-router.config.ts
import { myPreset } from "my-preset";

export default {
  presets: [myPreset()],
} satisfies Config;
```

빌드 타임에 `myPreset()`이 반환한 설정이 자동으로 병합된다.

---

# 설정 유효성 검증

`reactRouterConfigResolved`를 사용해 최종 설정을 검증할 수 있다.

다른 Preset이나 사용자 config가 필수 설정을 덮어쓰지 못하도록 보호하고 싶을 때 유용하다:

```typescript
import type { Preset, ServerBundlesFunction } from "@react-router/dev/config";

const serverBundles: ServerBundlesFunction = ({ branch }) => {
  const isAuth = branch.some((r) =>
    r.id.split("/").includes("_authenticated")
  );
  return isAuth ? "authenticated" : "unauthenticated";
};

export function myPreset(): Preset {
  return {
    name: "my-preset",
    reactRouterConfig: () => ({ serverBundles }),

    reactRouterConfigResolved: ({ reactRouterConfig }) => {
      // 최종 설정에서 내가 설정한 값이 유지되는지 확인
      if (reactRouterConfig.serverBundles !== serverBundles) {
        throw new Error(
          "[my-preset] `serverBundles`가 다른 설정에 의해 덮어쓰였습니다."
        );
      }
    },
  };
}
```

검증이 실패하면 **빌드가 즉시 중단**되고 에러 메시지가 표시된다.

---

# 실전 예시: 팀 표준 설정 Preset

회사 내부에서 표준 빌드 설정을 Preset으로 공유하는 패턴:

```typescript
// packages/company-rr-preset/index.ts
import type { Preset } from "@react-router/dev/config";

export function companyPreset(options?: {
  env: "prod" | "staging";
}): Preset {
  return {
    name: "company-preset",
    reactRouterConfig: () => ({
      // 팀 표준: 인증/비인증 번들 분리
      serverBundles: ({ branch }) => {
        const isAuth = branch.some((r) =>
          r.id.includes("_authenticated")
        );
        return isAuth ? "auth" : "public";
      },
      // 팀 표준: 공통 pre-render 경로
      prerender: ["/", "/login", "/about"],
    }),

    reactRouterConfigResolved: ({ reactRouterConfig }) => {
      // prod 환경에서는 ssr이 반드시 true여야 함
      if (options?.env === "prod" && !reactRouterConfig.ssr) {
        throw new Error(
          "[company-preset] prod 환경에서는 ssr:true 필수"
        );
      }
    },
  };
}
```

사용 측에서는 필요에 따라 override 가능:

```typescript
// react-router.config.ts
import { companyPreset } from "@company/rr-preset";

export default {
  presets: [companyPreset({ env: "prod" })],
  // 필요한 경우 사용자 설정으로 오버라이드
} satisfies Config;
```

---

# 여러 Preset 조합

여러 Preset을 한 번에 사용할 수 있다:

```typescript
export default {
  presets: [
    vercelPreset(),      // 플랫폼 설정
    companyPreset(),     // 팀 표준 설정
    featureFlagPreset(), // 기능 플래그 설정
  ],
  // 사용자 설정이 모든 preset보다 우선
  ssr: true,
} satisfies Config;
```

Preset은 배열 순서대로 적용되고, **뒤에 오는 것이 앞의 것을 덮어쓴다.**
가장 마지막은 항상 **사용자 config**이므로, 사용자는 항상 override 할 수 있다.

---

# 주의사항

## `reactRouterConfigResolved`는 신중하게

검증을 너무 강하게 하면 유연성이 떨어진다.

```typescript
// 너무 강한 예: 절대 override 불가
reactRouterConfigResolved: ({ reactRouterConfig }) => {
  if (reactRouterConfig.someOption !== myValue) {
    throw new Error("이 옵션은 변경할 수 없습니다.");
  }
};

// 더 나은 예: 경고만 하고 override는 허용
reactRouterConfigResolved: ({ reactRouterConfig }) => {
  if (reactRouterConfig.someOption !== myValue) {
    console.warn(
      "[my-preset] someOption을 변경했습니다. " +
      "의도된 경우라면 무시하세요."
    );
  }
};
```

## Preset은 설정만 제공

Preset은 **빌드 타임 설정만 제공**한다.
런타임 동작을 변경하려면 다른 방법을 사용해야 한다:

- 런타임 라우트 데이터: route loader/action
- 클라이언트 상태 초기화: React Context, Zustand 등
- 미들웨어 통합: loader/action 조합

---

# 정리

| 항목 | 설명 |
|------|------|
| 용도 | 재사용 가능한 react-router.config.ts 패키지 |
| 시점 | 빌드 타임만 |
| 제공 가능 | 설정 구성 및 유효성 검증 |
| 제공 불가 | 런타임 동작 변경 |
| 병합 순서 | Preset 배열 순서 → 사용자 config (최우선) |
| 배포 | npm 패키지로 배포 가능 |
