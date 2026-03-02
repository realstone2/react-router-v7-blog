import { Link } from 'react-router';
import type { NavItem } from '~/lib/navigation.server';

interface PrevNextNavProps {
  prev: NavItem | null;
  next: NavItem | null;
}

export function PrevNextNav({ prev, next }: PrevNextNavProps) {
  if (!prev && !next) return null;

  return (
    <nav className="flex items-stretch gap-6 mt-24 pt-10 border-t border-gray-200 dark:border-gray-800">
      {prev ? (
        <Link
          to={`/posts/${prev.slug}`}
          className="flex-1 group p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/60 dark:hover:border-red-400/50 hover:bg-red-50/30 dark:hover:bg-red-400/15 transition-all duration-300 shadow-sm"
          prefetch="intent"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Previous</span>
          <span className="mt-2 block text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            ← {prev.title}
          </span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
      {next ? (
        <Link
          to={`/posts/${next.slug}`}
          prefetch="intent"
          className="flex-1 group p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/60 dark:hover:border-red-400/50 hover:bg-red-50/30 dark:hover:bg-red-400/15 transition-all duration-300 text-right shadow-sm"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Next</span>
          <span className="mt-2 block text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            {next.title} →
          </span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  );
}
