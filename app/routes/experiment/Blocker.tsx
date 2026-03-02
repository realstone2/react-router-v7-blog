import { useMemo, useState } from "react";
import { Link, useBeforeUnload, useBlocker } from "react-router";

export default function BlockerExperimentPage() {
  const [isDirty, setIsDirty] = useState(false);
  const [blockInAppNav, setBlockInAppNav] = useState(true);
  const [warnBeforeUnload, setWarnBeforeUnload] = useState(true);
  const [note, setNote] = useState("");

  const shouldBlock = useMemo(() => {
    return ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => {
      if (!blockInAppNav || !isDirty) return false;
      return currentLocation.pathname !== nextLocation.pathname;
    };
  }, [blockInAppNav, isDirty]);

  const blocker = useBlocker(shouldBlock);

  useBeforeUnload((event) => {
    if (!warnBeforeUnload || !isDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Navigation Blocking Lab</h1>
      <p className="mt-2 text-sm text-zinc-600">
        `useBlocker`(앱 내부 이동)와 `useBeforeUnload`(새로고침/탭 닫기) 동작을 실험하는 페이지입니다.
      </p>

      <section className="mt-6 rounded-lg border border-zinc-200 p-4">
        <h2 className="font-semibold">Toggles</h2>

        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={isDirty}
            onChange={(e) => setIsDirty(e.target.checked)}
          />
          편집 중 상태(unsaved changes) 활성화
        </label>

        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={blockInAppNav}
            onChange={(e) => setBlockInAppNav(e.target.checked)}
          />
          `useBlocker`로 앱 내부 라우팅 차단
        </label>

        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={warnBeforeUnload}
            onChange={(e) => setWarnBeforeUnload(e.target.checked)}
          />
          `useBeforeUnload`로 브라우저 이탈 경고
        </label>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-200 p-4">
        <h2 className="font-semibold">Mock Form</h2>
        <textarea
          className="mt-3 min-h-28 w-full rounded-md border border-zinc-300 p-3 text-sm"
          placeholder="아무 텍스트나 입력 후 이동해보세요."
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (!isDirty) setIsDirty(true);
          }}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
            onClick={() => setIsDirty(false)}
          >
            저장 완료(Dirty 해제)
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            onClick={() => {
              setNote("");
              setIsDirty(false);
            }}
          >
            초기화
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-200 p-4">
        <h2 className="font-semibold">Try Navigation</h2>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link className="rounded-md border border-zinc-300 px-3 py-2" to="/">
            홈으로 이동 (내부 라우팅)
          </Link>
          <a
            className="rounded-md border border-zinc-300 px-3 py-2"
            href="https://reactrouter.com/"
            rel="noreferrer"
            target="_blank"
          >
            외부 사이트 열기
          </a>
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          내부 라우팅은 `useBlocker`, 새로고침/탭 닫기는 `useBeforeUnload`가 담당합니다.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-200 p-4">
        <h2 className="font-semibold">Blocker State</h2>
        <p className="mt-2 text-sm">state: {blocker.state}</p>

        {blocker.state === "blocked" ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium">이동이 차단되었습니다. 계속 이동할까요?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md bg-amber-700 px-3 py-2 text-white"
                onClick={() => blocker.proceed()}
              >
                이동 진행
              </button>
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-3 py-2"
                onClick={() => blocker.reset()}
              >
                현재 페이지에 머물기
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
