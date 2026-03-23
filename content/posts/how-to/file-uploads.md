---
title: "파일 업로드"
date: "2026-03-23"
description: "React Router에서 파일 업로드 처리 — 폼 제출, 스트리밍 파싱, 로컬 저장소 활용까지 전체 파이프라인"
tags: ["react-router", "file-upload", "form", "streaming", "form-data"]
category: "how-to"
order: 2
---

> 공식 문서: [https://reactrouter.com/how-to/file-uploads](https://reactrouter.com/how-to/file-uploads)
> React Router v7 Framework Mode 기준

---

# 들어가며

파일 업로드는 웹 앱에서 흔한 요구사항이지만, React Router의 Server Action에서 올바르게 처리하려면 몇 가지 주의할 점이 있다.

특히 **큰 파일을 다룰 때는 스트리밍을 지원하는 파서**가 필수다.
기본 `request.formData()`는 전체 바디를 메모리에 로드하기 때문에, 수백 MB의 파일을 업로드할 때 서버가 과부하에 빠질 수 있다.

React Router는 `@remix-run/form-data-parser` 패키지로 스트리밍 FormData 파싱을 지원하고,
`@remix-run/file-storage`로 파일을 체계적으로 관리할 수 있게 해준다.

이 글에서는 **파일 업로드의 전체 파이프라인**을 실전 예시로 다룬다.

---

# 대전제: Framework Mode 전용

**지원 모드:** Framework Mode만 가능

이 가이드의 모든 기법은 React Router의 Framework Mode(`<Scripts>` 렌더링)에서만 작동한다.
Data Router나 Declarative Mode에서는 Server Action이 없으므로 파일 업로드 처리가 불가능하다.

---

# 1. 언제 이 방식을 써야 하나

파일 업로드에는 크게 두 가지 패턴이 있다.

## 패턴 A: 서버 경유 업로드 (이 글의 방식)

```
클라이언트 → 서버 (action) → 저장소 (로컬 디스크 / S3 등)
```

파일이 서버를 **통과**한다. `parseFormData()`가 필요한 이유가 여기에 있다.

## 패턴 B: Presigned URL 직접 업로드 (클라우드 환경 일반적)

```
클라이언트 → 서버 (URL 발급만)
           ↘ S3 직접 업로드
```

파일이 서버를 **거치지 않는다.** S3가 직접 받는다.

---

## 어떤 패턴을 선택할까

| | 서버 경유 (Pattern A) | Presigned URL (Pattern B) |
|---|---|---|
| 파일이 서버 메모리에 올라가는가 | O (스트리밍으로 최소화) | X |
| 서버 처리 가능 여부 | 가능 (바이러스 스캔, 리사이징 등) | 어려움 |
| 구현 복잡도 | 낮음 | 중간 (URL 발급 로직 필요) |
| 대용량 파일 | 스트리밍 필요 | 유리 (서버 부하 없음) |
| 비공개 파일 접근 제어 | 서버에서 직접 제어 | 별도 인증 로직 필요 |

**Presigned URL이 맞는 경우** → S3 같은 클라우드 스토리지를 쓰고, 파일을 서버에서 특별히 처리할 필요가 없을 때. 대부분의 프로덕션 환경.

**서버 경유가 맞는 경우** → 자체 서버 저장소(로컬, MinIO), 업로드 시 서버 처리가 필수(리사이징, 바이러스 스캔), 컴플라이언스상 파일이 반드시 자사 서버를 통과해야 할 때.

> 이 글은 **Pattern A** 기준이다. S3 presigned URL 방식을 쓴다면 `parseFormData()`는 필요 없다.

---

# 2. 기본 개념 복습

파일 업로드의 핵심 요소를 간단히 정리한다.

## 폼 설정

폼에서 파일을 전송하려면 **반드시** `encType="multipart/form-data"`를 설정해야 한다.
(`<Form>` 컴포넌트 관련 상세 내용은 [폼 처리 가이드](../framework-conventions/form.md) 참고)

```tsx
export default function UploadPage() {
  return (
    <form method="post" encType="multipart/form-data">
      <input type="file" name="avatar" accept="image/*" />
      <button type="submit">Upload</button>
    </form>
  );
}
```

## action에서 FormData 처리

Server Action에서는 `request.formData()`로 폼 데이터에 접근한다.

```typescript
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const file = formData.get("avatar");
  // File 객체 처리...
}
```

하지만 큰 파일을 다룰 때는 이 방식이 문제가 된다.

---

# 3. 왜 `parseFormData()`가 필요한가

### 문제: 메모리 오버헤드

기본 `request.formData()`는 내부적으로:
1. 요청 바디 전체를 버퍼에 로드
2. 모든 파일을 메모리에 보유
3. FormData 객체 반환

100 MB 파일을 업로드하면 서버 메모리에 100 MB가 쌓인다.
동시 사용자가 많으면 서버가 OOM(Out of Memory) 에러로 죽을 수 있다.

### 해결책: 스트리밍 파서

`@remix-run/form-data-parser`의 `parseFormData()`는:
1. 파일 데이터를 **스트림으로 받음**
2. 개발자가 **즉시 저장소에 쓸 수 있도록** 콜백 제공
3. 메모리에 전체 파일을 보유하지 않음

결과적으로 **아무리 큰 파일도 안전하게 처리 가능**하다.

---

# 4. 실전: 파일 업로드 구현

## 설치

```bash
npm install @remix-run/form-data-parser @remix-run/file-storage
```

## 단계 1: 저장소 설정

서버에서 파일을 어디에 저장할지 결정한다.
가장 간단한 방법은 로컬 파일시스템에 저장하는 것이다.

```typescript
// app/server/avatar-storage.server.ts
import { LocalFileStorage } from "@remix-run/file-storage/local";

// uploads/avatars 디렉토리에 파일 저장
export const fileStorage = new LocalFileStorage("./uploads/avatars");

// 파일 저장 시 사용할 키 생성
export function getStorageKey(userId: string) {
  return `user-${userId}-avatar`;
}
```

## 단계 2: 라우트에서 업로드 처리

action에서 `parseFormData()`를 사용해 파일을 받는다.

```typescript
// app/routes/user.$id.tsx
import { parseFormData, type FileUpload } from "@remix-run/form-data-parser";
import { fileStorage, getStorageKey } from "~/server/avatar-storage.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method Not Allowed", { status: 405 });
  }

  // 파일마다 호출되는 업로드 핸들러
  const uploadHandler = async (fileUpload: FileUpload) => {
    // 필드 이름과 파일 타입 검증
    if (
      fileUpload.fieldName === "avatar" &&
      fileUpload.type.startsWith("image/")
    ) {
      // 저장소에 파일 저장
      const storageKey = getStorageKey(params.id);
      await fileStorage.set(storageKey, fileUpload);

      // 저장된 파일 객체 반환 (formData에서 접근 가능)
      return fileStorage.get(storageKey);
    }
  };

  // FormData 파싱 (스트리밍 지원)
  const formData = await parseFormData(request, uploadHandler);
  const uploadedFile = formData.get("avatar");

  if (uploadedFile) {
    // 업로드 성공 처리
    return {
      success: true,
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
    };
  }

  return { success: false, error: "파일을 찾을 수 없습니다" };
}
```

### uploadHandler 이해하기

`uploadHandler` 콜백이 하는 일:

| 단계 | 설명 |
|------|------|
| 호출 시점 | 폼에서 보낸 파일 하나마다 호출됨 |
| 파라미터 | `FileUpload` 객체 (스트림 데이터) |
| 검증 | 필드 이름(`fieldName`), 파일 타입(`type`) 확인 |
| 저장 | `fileStorage.set()`으로 즉시 저장 |
| 반환값 | 저장된 파일 객체 반환하면 `formData.get()`으로 접근 가능 |

## 단계 3: 페이지 컴포넌트

```typescript
// app/routes/user.$id.tsx
export default function UserPage({
  actionData,
  params,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>User Profile</h1>

      {/* 파일 업로드 폼 */}
      <form method="post" encType="multipart/form-data">
        <label htmlFor="avatar">Profile Picture</label>
        <input
          id="avatar"
          type="file"
          name="avatar"
          accept="image/*"
          required
        />
        <button type="submit">Upload</button>
      </form>

      {/* 업로드 결과 표시 */}
      {actionData?.success && (
        <div>
          <p>파일 업로드 성공!</p>
          <img
            src={`/user/${params.id}/avatar`}
            alt="user avatar"
            width={200}
          />
        </div>
      )}

      {actionData?.error && (
        <div style={{ color: "red" }}>
          <p>오류: {actionData.error}</p>
        </div>
      )}
    </div>
  );
}
```

## 단계 4: Resource Route로 파일 서빙

업로드된 파일을 HTTP 응답으로 반환하는 resource route를 만든다.

```typescript
// app/routes/api/avatar.tsx
import { fileStorage, getStorageKey } from "~/server/avatar-storage.server";

export async function loader({ params }: Route.LoaderArgs) {
  const storageKey = getStorageKey(params.id);
  const file = await fileStorage.get(storageKey);

  if (!file) {
    throw new Response("Not found", { status: 404 });
  }

  return new Response(file.stream(), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": file.size.toString(),
      "Content-Disposition": `inline; filename="${file.name}"`,
    },
  });
}
```

라우트 설정 예시:

```typescript
// app/routes.ts
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  route("/user/:id", "./routes/user.$id.tsx", [
    // Avatar 리소스 라우트 (nested)
    route("avatar", "./routes/api/avatar.tsx"),
  ]),
  // ... 다른 라우트
] satisfies RouteConfig;
```

---

# 5. 핵심 개념 정리

업로드 파이프라인에서 자주 나오는 용어들:

| 용어 | 설명 |
|------|------|
| **parseFormData** | `request.formData()` 대체 — 스트리밍 지원, 큰 파일 안전 처리 |
| **uploadHandler** | 파일마다 호출되는 콜백 함수, `File` 반환 시 `formData.get()`으로 접근 가능 |
| **FileUpload** | 요청 스트림으로 전달되는 파일 — **즉시 저장해야 함** |
| **LocalFileStorage** | 서버 파일시스템에 파일을 저장하고 관리하는 저장소 클래스 |
| **LazyFile** | `fileStorage.get()`이 반환하는 객체 — 필요할 때만 실제 파일 내용 읽음 |
| **Resource Route** | `export async function loader()`만 있는 라우트 — 파일 스트림을 HTTP 응답으로 반환 |
| **multipart/form-data** | 파일 포함 폼 데이터 전송 시 필수 `encType` 값 |

---

# 6. 주의사항

### FileUpload는 스트림이다

`uploadHandler`에서 받는 `FileUpload`는 **스트림**이다.
콜백을 빠져나가면 스트림이 닫혀서 파일을 더 이상 읽을 수 없다.

따라서 **콜백 안에서 즉시 저장소에 저장**해야 한다.

```typescript
const uploadHandler = async (fileUpload: FileUpload) => {
  // ✅ 맞음: 콜백 안에서 즉시 저장
  await fileStorage.set(storageKey, fileUpload);
  return fileStorage.get(storageKey);
};

// ❌ 틀림: 콜백 밖에서 저장 불가
// const file = fileUpload;
// return file; // 스트림이 닫혀있음
```

### encType 필수

파일을 포함한 폼에는 반드시 `encType="multipart/form-data"`를 설정해야 한다.
없으면 파일 데이터가 전송되지 않는다.

### 파일 타입 검증

악의적인 사용자가 실행 파일을 업로드할 수 있으므로, 반드시 파일 타입을 검증한다.

```typescript
// ✅ 이미지만 허용
if (fileUpload.type.startsWith("image/")) {
  // 저장...
}

// ✅ 특정 타입만 허용
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
if (allowedTypes.includes(fileUpload.type)) {
  // 저장...
}
```

### 파일 크기 제한

매우 큰 파일 업로드를 방지하려면 크기를 체크한다.

```typescript
const uploadHandler = async (fileUpload: FileUpload) => {
  // 10 MB 제한
  if (fileUpload.size > 10 * 1024 * 1024) {
    throw new Error("파일이 너무 큽니다");
  }
  // 저장...
};
```

---

# 7. 트러블슈팅

### "formData.get()이 undefined를 반환한다"

uploadHandler에서 아무것도 반환하지 않았을 가능성이 높다.

```typescript
const uploadHandler = async (fileUpload: FileUpload) => {
  // ❌ 반환값 없음
  await fileStorage.set(storageKey, fileUpload);
};

// ✅ 반환값 있어야 함
const uploadHandler = async (fileUpload: FileUpload) => {
  await fileStorage.set(storageKey, fileUpload);
  return fileStorage.get(storageKey); // 중요!
};
```

### "파일이 저장되지 않음"

`uploadHandler` 콜백이 호출되지 않은 것일 수 있다.

1. 폼의 input `name` 속성이 uploadHandler에서 체크하는 `fieldName`과 일치하는지 확인
2. `encType="multipart/form-data"` 설정 확인
3. `parseFormData()` 호출 시 uploadHandler를 전달했는지 확인

```typescript
// ❌ fieldName 불일치
<input type="file" name="file" /> {/* "file" */}

const uploadHandler = async (fileUpload: FileUpload) => {
  if (fileUpload.fieldName === "avatar") { // 체크하지만 일치하지 않음
    // ...
  }
};

// ✅ 일치해야 함
<input type="file" name="avatar" />

const uploadHandler = async (fileUpload: FileUpload) => {
  if (fileUpload.fieldName === "avatar") {
    // 실행됨
  }
};
```

### "Resource Route가 404를 반환한다"

파일이 저장되지 않았거나 저장소 경로가 잘못되었을 수 있다.

1. 저장소 디렉토리가 존재하고 쓰기 권한이 있는지 확인
2. `getStorageKey()`가 action과 loader에서 동일한 키를 생성하는지 확인
3. 브라우저 개발자 도구에서 실제 요청 URL이 맞는지 확인

---

# 요약

| 항목 | 내용 |
|------|------|
| **패키지** | `@remix-run/form-data-parser`, `@remix-run/file-storage` |
| **필수 설정** | `encType="multipart/form-data"` |
| **핵심 함수** | `parseFormData()` — 스트리밍 FormData 파싱 |
| **파일 저장** | `uploadHandler` 콜백에서 `FileUpload` 즉시 저장 |
| **파일 서빙** | Resource Route의 `loader`에서 파일 스트림 반환 |
| **검증** | 파일 타입, 크기 반드시 검증 |
| **주의** | `FileUpload`는 스트림 — 콜백 안에서만 유효 |
