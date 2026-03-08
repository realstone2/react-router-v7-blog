---
title: ".server 모듈 — 서버 전용 파일"
date: "2026-03-08"
description: "React Router에서 .server 접미사로 민감한 코드를 클라이언트 번들에서 완전히 제외하는 방법"
tags: ["react-router", "framework-conventions", "server-only"]
category: "framework-conventions"
order: 7
---

> 공식 문서: [https://reactrouter.com/api/framework-conventions/server-modules](https://reactrouter.com/api/framework-conventions/server-modules)
> React Router v7 기준 (Framework Mode 전용)

---

# 들어가며

`npm run build` 시 Vite는 **서버 번들**과 **클라이언트 번들** 두 개를 만든다.
일반 파일은 두 번들 모두에 포함된다.

```
build/
├── server/index.js      ← 서버용 번들
└── client/assets/...    ← 클라이언트용 번들 (브라우저에 전달됨)
```

DB 연결 정보(`DATABASE_URL`), JWT 시크릿 같은 민감한 코드가 **클라이언트 번들에 포함되면 브라우저에서 소스를 열었을 때 그대로 노출**된다.

`.server` 접미사를 붙이면 **클라이언트 번들에서 해당 파일을 완전히 제외**한다.
실수로 `.server` 파일이 클라이언트 번들에 포함되면 **빌드 자체가 실패**하므로 안전하다.

| | 서버 번들 | 클라이언트 번들 |
|---|---|---|
| 일반 파일 | O | O |
| `.client` 파일 | X | O |
| `.server` 파일 | O | X |

---

# .client와의 차이

| | `.client` | `.server` |
|---|---|---|
| 서버 번들 포함 | X | O |
| 클라이언트 번들 포함 | O | X |
| 서버에서 import 시 | `undefined` | 정상 동작 |
| 클라이언트에서 import 시 | 정상 동작 | 빌드 에러 |
| 주요 용도 | 브라우저 API, 클라이언트 라이브러리 | DB, 시크릿, 인증 로직 |

---

# 사용 방법

### 파일 단위

```
app/
├── auth.server.ts       ← 서버 전용
├── db.server.ts         ← 서버 전용
├── email.server.ts      ← 서버 전용
└── root.tsx
```

### 디렉토리 단위

```
app/
├── .server/             ← 디렉토리 내 전체가 서버 전용
│   ├── auth.ts
│   ├── db.ts
│   └── email.ts
└── root.tsx
```

---

# 주의사항

**라우트 모듈(`routes/` 내 파일)에는 `.server` / `.client`를 붙이면 안 된다.**
라우트 모듈은 서버와 클라이언트 번들 그래프 양쪽에 참조되는 특수한 파일이므로, 붙이면 빌드 에러가 발생한다.

---

# 주요 사용 사례

### 1. DB 연결

DB 연결 정보(`DATABASE_URL`)가 클라이언트에 노출되면 안 된다.

```typescript
// app/utils/db.server.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

export { db };
```

### 2. 인증 유틸리티

JWT 시크릿, 비밀번호 해싱 같은 민감한 로직은 서버에서만 실행돼야 한다.

```typescript
// app/utils/auth.server.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET!;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function createToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
}
```

### 3. 라우트 action에서 사용

`.server` 모듈은 `loader`, `action` 같은 **서버에서만 실행되는 함수 안에서** import해서 사용한다.

```typescript
// app/routes/login.tsx
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { hashPassword, createToken } from "../utils/auth.server";
import { db } from "../utils/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const hashedPassword = await hashPassword(password);
  const user = await db.user.create({
    data: { email, password: hashedPassword },
  });

  const token = createToken(user.id);

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": `token=${token}; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}

export default function Login() {
  return (
    <form method="post">
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">로그인</button>
    </form>
  );
}
```

---

# 정리

| | 내용 |
|---|---|
| 파일명 규칙 | `*.server.ts`, `*.server.tsx` 또는 `.server/` 디렉토리 |
| 클라이언트 번들 포함 여부 | X (완전 제외) |
| 실수로 클라이언트에 포함되면 | 빌드 실패 |
| 주요 용도 | DB 연결, API 시크릿, JWT, 비밀번호 해싱 |
| 사용 위치 | `loader`, `action` 등 서버 전용 함수 안 |
