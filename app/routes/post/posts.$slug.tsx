import type { Route } from './+types/posts.$slug';
import { getPost } from '~/lib/posts.server';
import { getPrevNext } from '~/lib/navigation.server';
import { DocsLayout } from '~/components/docs-layout';
import { PrevNextNav } from '~/components/prev-next-nav';

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

export default function PostDetail({ loaderData }: Route.ComponentProps) {
  const { title, content, toc, prev, next } = loaderData;

  return (
    <DocsLayout toc={toc}>
      <article>
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
        </header>

        <div className="prose" dangerouslySetInnerHTML={{ __html: content }} />

        <PrevNextNav prev={prev} next={next} />
      </article>
    </DocsLayout>
  );
}
