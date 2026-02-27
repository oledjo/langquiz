import fs from 'fs'
import path from 'path'

const base = process.env.SITE_BASE_URL ?? 'https://langquiz.onrender.com'
const routes = [
  '/',
  '/learn',
  '/learn/german-exam-prep-drills',
  '/learn/daily-focused-language-practice',
  '/learn/german-article-drills-a1-a2',
  '/learn/mistake-driven-repetition-explained',
  '/learn/how-to-prepare-for-goethe-a2-speaking',
  '/learn/daily-12-minute-german-routine',
  '/learn/topic-based-language-practice',
  '/learn/improve-german-word-order-fast',
  '/learn/german-case-practice-with-feedback',
  '/learn/from-beginner-to-b1-with-focused-sessions',
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
  .map((route) => {
    const loc = `${base}${route}`
    const priority = route === '/' ? '1.0' : route.startsWith('/learn/') ? '0.8' : '0.9'
    return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  })
  .join('\n')}\n</urlset>\n`

const outPath = path.resolve(process.cwd(), 'public', 'sitemap.xml')
fs.writeFileSync(outPath, xml, 'utf8')
console.log(`Wrote sitemap to ${outPath}`)
