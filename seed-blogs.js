/**
 * seed-blogs.js
 * 
 * One-time backend script to scrape hardcoded blog posts from frontend HTML (blog.html),
 * upload any local cover images directly to Cloudinary, and save the permanent records
 * into the Firestore "blogs" collection and local data/portfolio-data.json.
 * 
 * Usage:
 *   node seed-blogs.js
 *   node seed-blogs.js --dry-run
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

console.log('='.repeat(75));
console.log('  Seed Blogs: Scrape Frontend HTML -> Cloudinary & Firestore');
console.log(isDryRun ? '  [MODE: DRY RUN - Testing scraping without database writes]' : '  [MODE: LIVE SEEDING TO FIRESTORE]');
console.log('='.repeat(75));

// 1. Configure Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const isCloudinaryActive = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryActive) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  console.log(`[+] Cloudinary initialized for cloud: "${cloudName}"`);
} else {
  console.warn('[!] Cloudinary credentials missing in .env.');
}

// 2. Configure Firebase Admin
const FIREBASE_KEY_PATH = path.join(__dirname, 'firebase-key.json');
const DATA_FILE_PATH = path.join(__dirname, 'data', 'portfolio-data.json');
const BLOG_HTML_PATH = path.join(__dirname, 'blog.html');

let db = null;
if (fs.existsSync(FIREBASE_KEY_PATH)) {
  try {
    const serviceAccount = require(FIREBASE_KEY_PATH);
    const app = initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore(app);
    console.log('[+] Connected to Firebase Firestore successfully.');
  } catch (err) {
    console.warn(`[!] Firebase Admin initialization warning: ${err.message}`);
  }
} else {
  console.warn('[!] firebase-key.json not found in root.');
}

// Helper: upload local file to Cloudinary if needed
async function uploadToCloudinaryIfNeeded(filePathOrUrl) {
  if (!filePathOrUrl || typeof filePathOrUrl !== 'string') return '';
  const trimmed = filePathOrUrl.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return trimmed;
  }

  if (!isCloudinaryActive || isDryRun) {
    return trimmed;
  }

  const cleanPath = trimmed.replace(/^[\\\/]+/, '');
  const candidatePaths = [
    path.resolve(__dirname, trimmed),
    path.resolve(__dirname, cleanPath),
    path.resolve(__dirname, 'assets', cleanPath),
    path.resolve(__dirname, 'assets', 'images', path.basename(cleanPath))
  ];

  let localFile = null;
  for (const c of candidatePaths) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      localFile = c;
      break;
    }
  }

  if (!localFile) return trimmed;

  try {
    console.log(`    [Uploading Cover] ${path.basename(localFile)} to Cloudinary...`);
    const result = await cloudinary.uploader.upload(localFile, {
      folder: 'portfolio/blogs',
      resource_type: 'image',
      use_filename: true,
      unique_filename: true
    });
    console.log(`    [Uploaded] Permanent URL: ${result.secure_url}`);
    return result.secure_url;
  } catch (err) {
    console.warn(`    [!] Cloudinary upload error: ${err.message}`);
    return trimmed;
  }
}

// Helper: Scrape articles from blog.html
function scrapeBlogsFromHtml() {
  if (!fs.existsSync(BLOG_HTML_PATH)) {
    console.error(`[ERROR] File not found: ${BLOG_HTML_PATH}`);
    return [];
  }

  const html = fs.readFileSync(BLOG_HTML_PATH, 'utf8');
  const blogs = [];

  // Match each <div class="card project-card fade-up"> ... </div> in the blog section
  const cardRegex = /<div class="card project-card fade-up">([\s\S]*?)<\/button>\s*<\/div>/gi;
  let match;
  let index = 1;

  while ((match = cardRegex.exec(html)) !== null) {
    const cardHtml = match[1];

    // Extract Title
    const titleMatch = cardHtml.match(/<div class="project-title card-title-text">([^<]+)<\/div>/i);
    const title = titleMatch ? titleMatch[1].trim() : `Blog Post ${index}`;

    // Extract Category Badge
    const badgeMatch = cardHtml.match(/<span class="badge [^"]*">([^<]+)<\/span>/i);
    const category = badgeMatch ? badgeMatch[1].trim() : 'General';

    // Extract Description / Excerpt
    const descMatch = cardHtml.match(/<p class="project-desc">([\s\S]*?)<\/p>/i);
    const excerpt = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Extract Full Article Content
    const fullMatch = cardHtml.match(/<div class="secret-full-article"[^>]*>([\s\S]*?)<\/div>/i);
    let fullHtml = fullMatch ? fullMatch[1].trim() : '';
    // Format full content as clean paragraphs
    let fullContentText = fullHtml
      .replace(/<h3>(.*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Check for any image in card
    const imgMatch = cardHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    const rawImage = imgMatch ? imgMatch[1] : '';

    // Generate tags based on category & title
    const tags = [];
    if (category) tags.push(category);
    if (/ai|artificial/i.test(title + excerpt)) tags.push('AI', 'Automation');
    if (/startup|mvp|founder/i.test(title + excerpt)) tags.push('Startup', 'Entrepreneurship');
    if (/business|growth/i.test(title + excerpt)) tags.push('Business');

    const wordCount = fullContentText.split(/\s+/).length;
    const readMinutes = Math.max(2, Math.ceil(wordCount / 200));

    blogs.push({
      id: `blog-${index}`,
      title,
      category,
      date: 'March 2026',
      readTime: `${readMinutes} min read`,
      excerpt,
      content: fullContentText || excerpt,
      image: rawImage,
      tags: Array.from(new Set(tags)),
      order: index
    });

    index++;
  }

  return blogs;
}

async function run() {
  const scrapedBlogs = scrapeBlogsFromHtml();
  console.log(`\n[*] Scraped ${scrapedBlogs.length} blog posts from blog.html.`);

  if (scrapedBlogs.length === 0) {
    console.warn('[!] No blog posts found to seed.');
    return;
  }

  const finalBlogs = [];
  let seededCount = 0;

  for (let i = 0; i < scrapedBlogs.length; i++) {
    const blog = scrapedBlogs[i];
    console.log(`\n[Blog ${i + 1}/${scrapedBlogs.length}] "${blog.title}"`);
    console.log(`  Category: ${blog.category}`);
    console.log(`  Read Time: ${blog.readTime}`);
    console.log(`  Tags: ${blog.tags.join(', ')}`);

    let finalImageUrl = blog.image;
    if (finalImageUrl) {
      finalImageUrl = await uploadToCloudinaryIfNeeded(finalImageUrl);
    }

    const docData = {
      id: blog.id,
      title: blog.title,
      category: blog.category,
      date: blog.date,
      readTime: blog.readTime,
      excerpt: blog.excerpt,
      content: blog.content,
      image: finalImageUrl || '',
      tags: blog.tags,
      order: blog.order,
      updatedAt: new Date().toISOString()
    };

    finalBlogs.push(docData);

    if (db && !isDryRun) {
      try {
        await db.collection('blogs').doc(blog.id).set(docData, { merge: true });
        console.log(`  -> Saved to Firestore "blogs" as doc "${blog.id}".`);
        seededCount++;
      } catch (err) {
        console.error(`  [!] Error saving blog ${blog.id} to Firestore:`, err.message);
      }
    } else {
      seededCount++;
      console.log(`  -> [Dry Run / Staged] Blog ${blog.id} processed.`);
    }
  }

  // Synchronize local data/portfolio-data.json
  console.log('\n--- Synchronizing local data/portfolio-data.json ---');
  try {
    let localData = {};
    if (fs.existsSync(DATA_FILE_PATH)) {
      localData = JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8'));
    }
    localData.blogs = finalBlogs;

    if (!isDryRun) {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(localData, null, 2), 'utf8');
      console.log('[+] Synchronized blogs in data/portfolio-data.json.');
    } else {
      console.log('[*] [Dry Run] data/portfolio-data.json update previewed.');
    }
  } catch (err) {
    console.warn('[!] Failed to update local data file:', err.message);
  }

  console.log('\n' + '='.repeat(75));
  console.log('  SEED BLOGS SUMMARY');
  console.log('='.repeat(75));
  console.log(`  Mode:                     ${isDryRun ? 'Dry Run' : 'Live Seeding'}`);
  console.log(`  Total Blogs Migrated:     ${seededCount} / ${scrapedBlogs.length}`);
  console.log(`  Firestore Collection:     blogs`);
  console.log('='.repeat(75) + '\n');
}

run().then(() => {
  console.log('Seed blogs script completed successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Seed blogs script failed:', err);
  process.exit(1);
});
