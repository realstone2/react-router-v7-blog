import type { Config } from '@react-router/dev/config';
import fs from 'node:fs';
import path from 'node:path';

export default {
  ssr: true,
  async prerender() {
    const postsDir = path.join(process.cwd(), 'content', 'posts');
    const files = fs.readdirSync(postsDir);
    const slugs = files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
    return ['/', ...slugs.map(slug => `/posts/${slug}`)];
  },
} satisfies Config;
