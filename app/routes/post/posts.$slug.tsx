import type { Route } from './+types/posts.$slug';
import { getPost, type Post } from '~/lib/posts.server';
import { getPrevNext } from '~/lib/navigation.server';
import { DocsLayout } from '~/components/docs-layout';
import { PrevNextNav } from '~/components/prev-next-nav';
import { isRouteErrorResponse, Link, useBlocker } from 'react-router';

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: 'Post Not Found' }];
  }
  return [
    { title: `${loaderData.title} | React Router v7 학습` },
    { name: 'description', content: loaderData.description },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const post = await getPost(params.slug);

  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }
  const { prev, next } = getPrevNext(params.slug);
  return { ...post, prev, next };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = 500;
  let title = '오류가 발생했습니다';
  let message = '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

  if (isRouteErrorResponse(error)) {
    status = error.status;
    if (error.status === 404) {
      title = '페이지를 찾을 수 없어요';
      message = '요청하신 페이지가 사라졌거나 잘못된 경로입니다. URL을 다시 확인해 주세요.';
    } else if (error.status === 500) {
      title = '서버 오류';
      message = '서버에서 문제가 발생했습니다. 빠른 시일 내에 복구하도록 하겠습니다.';
    } else {
      title = `오류 ${error.status}`;
      message = error.data?.message || '요청을 처리하는 도중 문제가 발생했습니다.';
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 relative overflow-hidden px-6 py-24">
      {/* Decorative blurred orb */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="w-[30rem] h-[30rem] sm:w-[45rem] sm:h-[45rem] bg-red-500/10 dark:bg-red-500/20 blur-[100px] sm:blur-[120px] rounded-full" />
      </div>

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-2xl mx-auto p-8 sm:p-12 border border-gray-200 dark:border-gray-800 rounded-3xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-2xl">
        {/* Status badge */}
        <div className="inline-flex items-center justify-center px-3 py-1.5 mb-6 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30">
          <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
          <span className="text-xs font-semibold tracking-widest text-red-600 dark:text-red-400 uppercase">
            Error {status}
          </span>
        </div>

        {/* Large status number */}
        <h1 className="font-heading text-8xl sm:text-[9rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-gray-900 dark:from-gray-100 to-gray-400 dark:to-gray-500 tracking-tighter leading-none mb-6 select-none">
          {status}
        </h1>

        <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100 tracking-tight">
          {title}
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-10 text-base sm:text-lg leading-relaxed max-w-md">
          {message}
        </p>

        <Link
          to="/"
          className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium rounded-full text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-red-500 dark:focus:ring-red-400 active:scale-95 shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] hover:shadow-[0_6px_20px_rgba(220,38,38,0.23)]"
        >
          <svg
            className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

export default function PostDetail({ loaderData }: Route.ComponentProps) {
  const { title, content, toc, prev, next } = loaderData;

  return (
    <DocsLayout toc={toc}>
      <article>
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h1>
        </header>

        <div className="prose" dangerouslySetInnerHTML={{ __html: content }} />

        <PrevNextNav prev={prev} next={next} />
      </article>
    </DocsLayout>
  );
}
