import type { Config } from '@react-router/dev/config';
import fs from 'node:fs';
import path from 'node:path';

export default {
  ssr: true,
  async prerender() {
    const postsDir = path.join(process.cwd(), 'content', 'posts');
    const slugs: string[] = [];
    for (const entry of fs.readdirSync(postsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const categoryDir = path.join(postsDir, entry.name);
      for (const file of fs.readdirSync(categoryDir)) {
        if (file.endsWith('.md')) {
          slugs.push(file.replace(/\.md$/, ''));
        }
      }
    }
    return ['/', ...slugs.map(slug => `/posts/${slug}`)];
  },
} satisfies Config;
