import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";
import { getHighlighter } from "~/lib/shiki.server";
import { extractToc, type TocItem } from "~/lib/toc.server";

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  category: string;
  order: number;
}

export interface Post extends PostMeta {
  content: string;
  toc: TocItem[];
}

const postsDir = path.join(process.cwd(), "content", "posts");

function findPostFile(slug: string): string | null {
  const entries = fs.readdirSync(postsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(postsDir, entry.name, `${slug}.md`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parsePostMeta(slug: string, data: Record<string, unknown>): PostMeta {
  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    date: typeof data.date === "string" ? data.date : "",
    description: typeof data.description === "string" ? data.description : "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    category: typeof data.category === "string" ? data.category : "uncategorized",
    order: typeof data.order === "number" ? data.order : 999,
  };
}

export function getPosts(): PostMeta[] {
  const entries = fs.readdirSync(postsDir, { withFileTypes: true });
  const posts: PostMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const categoryDir = path.join(postsDir, entry.name);
    const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      const slug = f.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(categoryDir, f), "utf-8");
      const { data } = matter(raw);
      posts.push(parsePostMeta(slug, data));
    }
  }

  return posts.sort((a, b) => a.order - b.order);
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const filePath = findPostFile(slug);
  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content: body } = matter(raw);

  const highlighter = await getHighlighter();

  const marked = new Marked();

  // Track heading slugs for dedup
  const slugCounts = new Map<string, number>();

  // Custom renderer for heading IDs and shiki code blocks
  marked.use({
    renderer: {
      heading({ text, depth }) {
        const base = slugify(text);
        const count = slugCounts.get(base) ?? 0;
        slugCounts.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = lang || "text";
        try {
          return highlighter.codeToHtml(text, {
            lang: language,
            themes: {
              light: "github-light",
              dark: "github-dark",
            },
            defaultColor: false,
          });
        } catch {
          // Fallback for unsupported languages
          return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
        }
      },
    },
  });

  const content = await marked.parse(body);

  return {
    ...parsePostMeta(slug, data),
    content,
    toc: extractToc(content),
  };
}
