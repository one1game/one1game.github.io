const fs = require('fs');
const path = require('path');

// Read articles-data.js
const dataPath = 'articles-data.js';
const vm = require('vm');
const code = fs.readFileSync(dataPath, 'utf-8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const articles = sandbox.window.allArticles || [];
let updated = 0;

for (const article of articles) {
  // Only process games
  if (article.category !== 'Во что поиграть?') continue;
  if (!article.url) continue;

  // Convert URL to file path: "/archive/counter-strike-2-730.html" -> "archive/counter-strike-2-730.html"
  const filePath = article.url.replace(/^\//, '');
  if (!fs.existsSync(filePath)) {
    console.log('  [miss] ' + filePath);
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf-8');

  // Find <article class="article-body"> and extract first meaningful <p>
  const articleMatch = html.match(/<article class="article-body">([\s\S]*?)<\/article>/);
  if (!articleMatch) continue;

  const bodyHtml = articleMatch[1];

  // Find first <p> with actual content (not empty, not just whitespace)
  const pMatch = bodyHtml.match(/<p>([\s\S]*?)<\/p>/);
  if (!pMatch) continue;

  let desc = pMatch[1].trim();

  // Strip HTML tags
  desc = desc.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  desc = desc.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Collapse whitespace
  desc = desc.replace(/\s+/g, ' ').trim();

  // Truncate to ~200 chars, ending at sentence boundary
  if (desc.length > 200) {
    // Try to cut at last sentence end (. ! ?) within 200 chars
    const truncated = desc.substring(0, 200);
    const lastSentence = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? ')
    );
    if (lastSentence > 80) {
      desc = truncated.substring(0, lastSentence + 1);
    } else {
      // Cut at last space
      const lastSpace = truncated.lastIndexOf(' ');
      desc = truncated.substring(0, lastSpace > 0 ? lastSpace : 200) + '…';
    }
  }

  const oldExcerpt = article.excerpt;
  if (oldExcerpt === desc) continue;

  article.excerpt = desc;
  updated++;
  console.log('  [ok] ' + path.basename(filePath));
  console.log('    old: ' + oldExcerpt.substring(0, 80) + '...');
  console.log('    new: ' + desc.substring(0, 80) + (desc.length > 80 ? '...' : ''));
}

// Write back
const output =
  `// articles-data.js\n` +
  `window.allArticles = ${JSON.stringify(articles, null, 2)};\n\n` +
  `window.articlesData = window.allArticles;\n`;

fs.writeFileSync(dataPath, output, 'utf-8');
console.log('\nUpdated excerpts: ' + updated);
