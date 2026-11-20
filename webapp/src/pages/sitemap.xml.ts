import type { APIRoute } from 'astro';
import catalog from '../data/catalog.json';
import movies from '../data/movies.json';
import oboi from '../data/oboi.json';

export const prerender = true;

const site = 'https://one1game.org';
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

const postModules = import.meta.glob('../../public/posts/*.json', { eager: true }) as Record<
  string,
  { default: any }
>;
const posts = Object.values(postModules).map((mod) => mod.default ?? mod);

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

interface Entry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

const entries: Entry[] = [
  { loc: `${site}${base}/`, lastmod: catalog.stats.generated, changefreq: 'daily', priority: '1.0' },
  { loc: `${site}${base}/movie/`, lastmod: movies.updated, changefreq: 'weekly', priority: '0.9' },
  { loc: `${site}${base}/oboi/`, lastmod: oboi.updated, changefreq: 'weekly', priority: '0.9' },
  { loc: `${site}${base}/nav/`, lastmod: catalog.stats.generated, changefreq: 'daily', priority: '0.9' },
  { loc: `${site}${base}/music/`, lastmod: catalog.stats.generated, changefreq: 'daily', priority: '0.8' },
];

for (const post of posts) {
  entries.push({
    loc: `${site}${base}/news/${post.slug}/`,
    lastmod: post.dateISO,
    changefreq: 'monthly',
    priority: '0.8',
  });
}

for (const movie of movies.items) {
  entries.push({
    loc: `${site}${base}/movie/${movie.id}/`,
    lastmod: movies.updated,
    changefreq: 'monthly',
    priority: '0.7',
  });
}

for (const category of oboi.categories.filter((item: any) => item.key !== 'all')) {
  entries.push({
    loc: `${site}${base}/oboi/${category.key}/`,
    lastmod: oboi.updated,
    changefreq: 'weekly',
    priority: '0.7',
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) =>
      `  <url><loc>${escape(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ''}${entry.priority ? `<priority>${entry.priority}</priority>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`;

export const GET: APIRoute = () =>
  new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
    },
  });
