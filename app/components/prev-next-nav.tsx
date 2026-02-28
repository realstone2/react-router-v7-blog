import { Link } from 'react-router';
import type { NavItem } from '~/lib/navigation.server';

interface PrevNextNavProps {
  prev: NavItem | null;
  next: NavItem | null;
}

export function PrevNextNav({ prev, next }: PrevNextNavProps) {
  if (!prev && !next) return null;

  return (
    <nav className="flex items-stretch gap-6 mt-24 pt-10 border-t border-gray-100 dark:border-gray-900">
      {prev ? (
        <Link
          to={`/posts/${prev.slug}`}
          className="flex-1 group p-5 rounded-xl border border-gray-100 dark:border-gray-900 hover:border-red-500/30 hover:bg-red-50/20 dark:hover:bg-red-500/5 transition-all duration-300 shadow-sm"
          prefetch="intent"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Previous</span>
          <span className="mt-2 block text-sm font-bold text-gray-900 dark:text-gray-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
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
          className="flex-1 group p-5 rounded-xl border border-gray-100 dark:border-gray-900 hover:border-red-500/30 hover:bg-red-50/20 dark:hover:bg-red-500/5 transition-all duration-300 text-right shadow-sm"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Next</span>
          <span className="mt-2 block text-sm font-bold text-gray-900 dark:text-gray-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            {next.title} →
          </span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  );
}
