import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface NavItem {
  title: string;
  slug: string;
}

export interface NavCategory {
  label: string;
  items: NavItem[];
}

const postsDir = path.join(process.cwd(), 'content', 'posts');

function toLabel(folderName: string): string {
  return folderName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

let cachedNavigation: NavCategory[] | null = null;

export function getNavigation(): NavCategory[] {
  if (cachedNavigation) return cachedNavigation;

  const entries = fs.readdirSync(postsDir, { withFileTypes: true });
  const categories: { label: string; items: NavItem[]; minOrder: number }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const categoryDir = path.join(postsDir, entry.name);
    const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.md'));

    const items: (NavItem & { order: number })[] = [];
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(categoryDir, file), 'utf-8');
      const { data } = matter(raw);
      items.push({
        title: typeof data.title === 'string' ? data.title : slug,
        slug,
        order: typeof data.order === 'number' ? data.order : 999,
      });
    }

    items.sort((a, b) => a.order - b.order);
    const minOrder = items.length > 0 ? items[0].order : 999;

    categories.push({
      label: toLabel(entry.name),
      items: items.map(({ title, slug }) => ({ title, slug })),
      minOrder,
    });
  }

  categories.sort((a, b) => a.minOrder - b.minOrder);

  cachedNavigation = categories.map(({ label, items }) => ({ label, items }));
  return cachedNavigation;
}

/** Flat ordered list of all slugs for prev/next navigation */
export function getAllSlugs(): string[] {
  return getNavigation().flatMap(cat => cat.items.map(item => item.slug));
}

/** Get prev/next items relative to a given slug */
export function getPrevNext(slug: string) {
  const navigation = getNavigation();
  const allSlugs = getAllSlugs();
  const idx = allSlugs.indexOf(slug);
  if (idx === -1) return { prev: null, next: null };

  const allItems = navigation.flatMap(cat => cat.items);
  return {
    prev: idx > 0 ? allItems[idx - 1] : null,
    next: idx < allItems.length - 1 ? allItems[idx + 1] : null,
  };
}
