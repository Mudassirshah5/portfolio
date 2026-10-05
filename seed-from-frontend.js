/**
 * seed-from-frontend.js
 * 
 * One-time backend script to extract hardcoded Projects, Skills, and other relevant
 * frontend portfolio items from HTML files (projects.html, skills.html, index.html)
 * and seed them into live Firestore database collections with Cloudinary asset integration.
 * 
 * Maps all projects accurately to the 5 industry categories:
 * - 'Business & Entrepreneurship'
 * - 'Tech & AI'
 * - 'Economics'
 * - 'Digital Marketing'
 * - 'Data Analytics'
 * 
 * Supports the optional 'proof_url' secondary proof document field on all projects.
 * 
 * Usage:
 *   node seed-from-frontend.js
 *   node seed-from-frontend.js --dry-run
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
console.log('  Seed From Frontend -> Firestore & Cloudinary Migration');
console.log(isDryRun ? '  [MODE: DRY RUN - Testing extraction without database writes]' : '  [MODE: LIVE SEEDING TO FIRESTORE]');
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
  console.warn('[!] Cloudinary credentials missing in .env. Image uploads will be skipped or kept as URLs.');
}

// 2. Configure Firebase Admin
const FIREBASE_KEY_PATH = path.join(__dirname, 'firebase-key.json');
const DATA_FILE_PATH = path.join(__dirname, 'data', 'portfolio-data.json');

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
  console.warn('[!] firebase-key.json not found. Live Firestore writes will be skipped, but local JSON will be updated.');
}

// Helper: upload local file to Cloudinary if needed
async function ensureCloudinaryUrl(filePathOrUrl, folder = 'portfolio/projects') {
  if (!filePathOrUrl || typeof filePathOrUrl !== 'string') return '';
  const trimmed = filePathOrUrl.trim();
  if (!trimmed) return '';

  // Already a remote URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return trimmed;
  }

  if (!isCloudinaryActive || isDryRun) {
    return trimmed;
  }

  // Look for file on local disk
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

  if (!localFile) {
    return trimmed;
  }

  try {
    console.log(`    [Uploading to Cloudinary] ${path.basename(localFile)} -> ${folder}...`);
    const ext = path.extname(localFile).toLowerCase();
    const isDoc = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt'].includes(ext);
    const result = await cloudinary.uploader.upload(localFile, {
      folder,
      resource_type: isDoc ? 'auto' : 'image',
      use_filename: true,
      unique_filename: true
    });
    console.log(`    [Uploaded] Permanent URL: ${result.secure_url}`);
    return result.secure_url;
  } catch (err) {
    console.warn(`    [!] Cloudinary upload error for ${path.basename(localFile)}: ${err.message}`);
    return trimmed;
  }
}

// ── PROJECT DEFINITIONS & MAPPING FROM FRONTEND ──────────────────
// Extracted from projects.html (all 10 projects) mapped to the 5 industry categories:
// 1. 'Business & Entrepreneurship'
// 2. 'Tech & AI'
// 3. 'Economics'
// 4. 'Digital Marketing'
// 5. 'Data Analytics'

const rawProjectsFromFrontend = [
  {
    id: 'proj-1',
    title: 'BazUp Media — Social Media Management Agency',
    subtitle: 'SMM Agency — Founder',
    category: 'Digital Marketing',
    date: '2025 - Present',
    tags: [
      'Social Media Management',
      'Reels Creation',
      'Content Writing',
      'ElevenLabs',
      'Midjourney',
      'Leonardo AI',
      'Entrepreneurship'
    ],
    description: 'Founded a social media management agency targeting clients in the US, UK, and UAE. Leading client outreach and acquisition strategy, manages execution and delivery of content, video editing, and AI-driven creative workflows.',
    link: '',
    image: '',
    proof_url: '',
    order: 1
  },
  {
    id: 'proj-2',
    title: 'BizMentor',
    subtitle: 'AI-Powered Business Mentoring Tool — Google AI Sekho',
    category: 'Tech & AI',
    date: '2025',
    tags: [
      'Artificial Intelligence',
      'Prompt Engineering',
      'Business Strategy',
      'Startup Ideation',
      'Google AI Sekho'
    ],
    description: 'Conceptualized and developed BizMentor — an AI-powered mentoring tool designed to help early-stage entrepreneurs get instant business guidance. Built and pitched for Google AI Sekho.',
    link: '',
    image: '',
    proof_url: '',
    order: 2
  },
  {
    id: 'proj-3',
    title: 'Concrete Compressive Strength Prediction',
    subtitle: 'Machine Learning Regression Project — KPITB AI & ML Training',
    category: 'Data Analytics',
    date: '2025',
    tags: [
      'Python',
      'Machine Learning',
      'Gradient Boosting',
      'NumPy / Pandas',
      'KPITB'
    ],
    description: 'Built a Gradient Boosting regression model to predict concrete compressive strength, completed as the solo project for the KPITB AI & ML training program.',
    link: '',
    image: '',
    proof_url: '',
    order: 3
  },
  {
    id: 'proj-4',
    title: 'Personal Portfolio Website',
    subtitle: 'Built with HTML, CSS, JavaScript & AI Tools',
    category: 'Tech & AI',
    date: '2026',
    tags: [
      'HTML / CSS / JS',
      'Vibe Coding',
      'AI Code Editors',
      'GitHub Pages',
      'Responsive Design',
      'Prompt Engineering'
    ],
    description: 'Designed and developed this personal portfolio website from scratch using HTML, CSS, and JavaScript. Used vibe coding techniques with AI code editors to build, refine, and deploy a responsive modern developer showcase.',
    link: 'https://mudassirshah5.github.io/portfolio/',
    image: '',
    proof_url: '',
    order: 4
  },
  {
    id: 'proj-5',
    title: 'Fazal Stone Shining',
    subtitle: 'Digital Presence Setup — Saudi Arabia',
    category: 'Business & Entrepreneurship',
    date: '2024 - 2025',
    tags: [
      'Logo Design',
      'WhatsApp Business',
      'Haraj Marketplace',
      'Digital Marketing'
    ],
    description: "Helped digitize my father's marble and tile cleaning business in KSA. Designed a professional logo, set up WhatsApp Business for client communication, and created listings on Haraj marketplace to drive inbound service inquiries.",
    link: '',
    image: '',
    proof_url: '',
    order: 5
  },
  {
    id: 'proj-6',
    title: 'Local Business — Digital Setup',
    subtitle: 'Google Business Profile + Social Media',
    category: 'Digital Marketing',
    date: '2024',
    tags: [
      'Google Business Profile',
      'Local SEO',
      'Social Media Setup',
      'Content Strategy',
      'Client Work'
    ],
    description: 'Set up a complete digital presence for a local business client — including Google Business Profile creation and optimization for local search visibility, social media business accounts, and foundational content strategy.',
    link: '',
    image: '',
    proof_url: '',
    order: 6
  },
  {
    id: 'proj-7',
    title: 'LOVCUS',
    subtitle: 'Artificial Beaded Jewelry Brand',
    category: 'Business & Entrepreneurship',
    date: '2024',
    tags: [
      'Brand Building',
      'Facebook & Instagram',
      'TikTok',
      'WhatsApp Catalogue',
      'Google Business Profile',
      'AI Content Creation',
      'Cash Flow Tracking'
    ],
    description: 'Founded and operated LOVCUS independently — managing product design, pricing, customer orders, and full social media across Facebook, Instagram, TikTok, and WhatsApp. Taught invaluable lessons in cash flow and lean operations.',
    link: '',
    image: '',
    proof_url: '',
    order: 7
  },
  {
    id: 'proj-8',
    title: 'Fiverr — Freelance Design',
    subtitle: 'Business Card Design Gig',
    category: 'Digital Marketing',
    date: '2024',
    tags: [
      'Canva',
      'Business Card Design',
      'Freelancing',
      'Marketplace Strategy'
    ],
    description: 'Created and launched a freelance business card design gig on Fiverr. Provided practical experience in profile positioning, service packaging, client search intent, and competitive platform mechanics.',
    link: '',
    image: '',
    proof_url: '',
    order: 8
  },
  {
    id: 'proj-9',
    title: 'Blogging',
    subtitle: 'Multi-Topic English Blog — Blogger Platform',
    category: 'Digital Marketing',
    date: '2023 - 2024',
    tags: [
      'Content Writing',
      'Blogger',
      'Research',
      'SEO Basics'
    ],
    description: 'Researched, built, and published English blog posts on Blogger covering business, lifestyle, and technology topics. Learned foundational principles of SEO, keyword intent, and content structuring.',
    link: '',
    image: '',
    proof_url: '',
    order: 9
  },
  {
    id: 'proj-10',
    title: 'Dry Fruits Processing',
    subtitle: 'Dehydrated Fruit Venture',
    category: 'Economics',
    date: '2023',
    tags: [
      'Product Development',
      'Market Research',
      'Operations',
      'Own Initiative'
    ],
    description: 'Independently conceived and launched a fruit dehydration business — processing mangoes, bananas, and strawberries for local and online sale. Provided hands-on insights into production capacity, unit economics, and operational planning.',
    link: '',
    image: '',
    proof_url: '',
    order: 10
  }
];

// ── SKILLS DEFINITIONS FROM FRONTEND (skills.html) ───────────────
const rawSkillsFromFrontend = [
  // 1. Entrepreneurship & Startup Building
  {
    id: 'skill-1',
    name: 'Startup Idea Development',
    category: 'Entrepreneurship & Startup Building',
    level: '90%',
    icon: 'fas fa-lightbulb',
    description: 'Ideation, opportunity evaluation, and problem-solution fit.'
  },
  {
    id: 'skill-2',
    name: 'Problem Identification',
    category: 'Entrepreneurship & Startup Building',
    level: '85%',
    icon: 'fas fa-search',
    description: 'Identifying real-world friction and market pain points.'
  },
  {
    id: 'skill-3',
    name: 'Market Research',
    category: 'Entrepreneurship & Startup Building',
    level: '85%',
    icon: 'fas fa-chart-line',
    description: 'Target market analysis, competitor benchmarking, and customer surveys.'
  },
  {
    id: 'skill-4',
    name: 'Business Model Development',
    category: 'Entrepreneurship & Startup Building',
    level: '88%',
    icon: 'fas fa-sitemap',
    description: 'Lean canvas, value proposition design, and revenue stream modeling.'
  },
  {
    id: 'skill-5',
    name: 'Business Planning',
    category: 'Entrepreneurship & Startup Building',
    level: '85%',
    icon: 'fas fa-clipboard-list',
    description: 'Feasibility studies, operational roadmaps, and growth milestones.'
  },
  {
    id: 'skill-6',
    name: 'Opportunity Analysis',
    category: 'Entrepreneurship & Startup Building',
    level: '85%',
    icon: 'fas fa-bullseye',
    description: 'Sizing market opportunities and evaluating early unit economics.'
  },
  {
    id: 'skill-7',
    name: 'Early-Stage Startup Strategy',
    category: 'Entrepreneurship & Startup Building',
    level: '88%',
    icon: 'fas fa-rocket',
    description: 'Bootstrapping, lean startup execution, and agile MVP testing.'
  },
  {
    id: 'skill-8',
    name: 'Founder & Startup Collaboration',
    category: 'Entrepreneurship & Startup Building',
    level: '90%',
    icon: 'fas fa-handshake',
    description: 'Team alignment, networking, co-founder dynamics, and cross-functional leadership.'
  },

  // 2. Data & Analytics
  {
    id: 'skill-9',
    name: 'Data Analytics (Foundations)',
    category: 'Data & Analytics',
    level: '85%',
    icon: 'fas fa-chart-line',
    description: 'Statistical analysis, spreadsheet modeling, and exploratory data analysis.'
  },
  {
    id: 'skill-10',
    name: 'SQL (Foundations)',
    category: 'Data & Analytics',
    level: '80%',
    icon: 'fas fa-database',
    description: 'Relational queries, joins, aggregations, and business metrics extraction.'
  },
  {
    id: 'skill-11',
    name: 'Python (Basic)',
    category: 'Data & Analytics',
    level: '75%',
    icon: 'fab fa-python',
    description: 'Scripting, basic automation, and data wrangling with Pandas/NumPy.'
  },
  {
    id: 'skill-12',
    name: 'Spreadsheet Analysis',
    category: 'Data & Analytics',
    level: '88%',
    icon: 'fas fa-table',
    description: 'Advanced formulas, pivot tables, financial modeling, and dashboards.'
  },
  {
    id: 'skill-13',
    name: 'Business Data Analysis',
    category: 'Data & Analytics',
    level: '82%',
    icon: 'fas fa-business-time',
    description: 'Translating raw business data into actionable managerial insights.'
  },

  // 3. Social Media & Marketing
  {
    id: 'skill-14',
    name: 'FB/IG Business Pages',
    category: 'Social Media & Marketing',
    level: '90%',
    icon: 'fab fa-facebook',
    description: 'Audience targeting, page optimization, Meta Business Suite, and analytics.'
  },
  {
    id: 'skill-15',
    name: 'Caption & Content Writing',
    category: 'Social Media & Marketing',
    level: '80%',
    icon: 'fas fa-pen-nib',
    description: 'High-converting ad copy, hook formulas, and brand storytelling.'
  },
  {
    id: 'skill-16',
    name: 'Google Business Profile & SEO',
    category: 'Social Media & Marketing',
    level: '85%',
    icon: 'fab fa-google',
    description: 'Local business optimization, organic visibility, and Google Maps ranking.'
  },
  {
    id: 'skill-17',
    name: 'Reels Creation & Video Editing',
    category: 'Social Media & Marketing',
    level: '82%',
    icon: 'fas fa-video',
    description: 'Short-form video storytelling, pacing, voiceover synthesis, and hooks.'
  },
  {
    id: 'skill-18',
    name: 'Hashtag Research & Strategy',
    category: 'Social Media & Marketing',
    level: '80%',
    icon: 'fas fa-hashtag',
    description: 'Audience discovery, trend monitoring, and algorithmic reach optimization.'
  },
  {
    id: 'skill-19',
    name: 'Email Marketing (Basic)',
    category: 'Social Media & Marketing',
    level: '65%',
    icon: 'fas fa-envelope',
    description: 'List segmentation, automated drip campaigns, and lead nurturing.'
  },

  // 4. Design & Creative
  {
    id: 'skill-20',
    name: 'Logo Design (Canva)',
    category: 'Design & Creative',
    level: '88%',
    icon: 'fas fa-palette',
    description: 'Brand identity, typography pairing, color psychology, and vector assets.'
  },
  {
    id: 'skill-21',
    name: 'Business Card Design',
    category: 'Design & Creative',
    level: '85%',
    icon: 'fas fa-id-card',
    description: 'Print-ready corporate stationery and tactile promotional collateral.'
  },
  {
    id: 'skill-22',
    name: 'Poster & Banner Design',
    category: 'Design & Creative',
    level: '80%',
    icon: 'fas fa-image',
    description: 'Digital advertising banners, event posters, and web display ads.'
  },
  {
    id: 'skill-23',
    name: 'CV / Resume Design',
    category: 'Design & Creative',
    level: '90%',
    icon: 'fas fa-file-pdf',
    description: 'ATS-friendly resume templates, visual hierarchy, and executive layout.'
  },
  {
    id: 'skill-24',
    name: 'Presentation Design',
    category: 'Design & Creative',
    level: '92%',
    icon: 'fas fa-chart-pie',
    description: 'Investor pitch decks, slide storytelling, and business presentations.'
  },
  {
    id: 'skill-25',
    name: 'AI Image Generation',
    category: 'Design & Creative',
    level: '85%',
    icon: 'fas fa-wand-magic-sparkles',
    description: 'Photorealistic asset creation using Midjourney, Leonardo, and prompt iteration.'
  },

  // 5. AI Tools & Technology
  {
    id: 'skill-26',
    name: 'ChatGPT & Claude',
    category: 'AI Tools & Technology',
    level: '92%',
    icon: 'fas fa-robot',
    description: 'Context window utilization, custom system instructions, and advanced reasoning.'
  },
  {
    id: 'skill-27',
    name: 'Gemini & Copilot',
    category: 'AI Tools & Technology',
    level: '88%',
    icon: 'fab fa-google',
    description: 'Multimodal research, workspace integration, and deep document synthesis.'
  },
  {
    id: 'skill-28',
    name: 'ElevenLabs (Voice AI)',
    category: 'AI Tools & Technology',
    level: '85%',
    icon: 'fas fa-microphone',
    description: 'AI voice generation, audio cleanup, voice cloning, and narration workflows.'
  },
  {
    id: 'skill-29',
    name: 'Midjourney & Leonardo AI',
    category: 'AI Tools & Technology',
    level: '88%',
    icon: 'fas fa-image',
    description: 'Visual concepting, high-resolution upscaling, and marketing asset generation.'
  },
  {
    id: 'skill-30',
    name: 'Prompt Engineering',
    category: 'AI Tools & Technology',
    level: '90%',
    icon: 'fas fa-terminal',
    description: 'Few-shot prompting, chain-of-thought, and deterministic output shaping.'
  },
  {
    id: 'skill-31',
    name: 'Vibe Coding',
    category: 'AI Tools & Technology',
    level: '85%',
    icon: 'fas fa-code',
    description: 'Rapid full-stack prototyping with AI-assisted developer workflows.'
  },

  // 6. Business
  {
    id: 'skill-32',
    name: 'Business Operations',
    category: 'Entrepreneurship & Startup Building',
    level: '85%',
    icon: 'fas fa-tasks',
    description: 'Workflow management, process documentation, and execution rhythm.'
  },
  {
    id: 'skill-33',
    name: 'Cash Flow Management (Basic)',
    category: 'Entrepreneurship & Startup Building',
    level: '80%',
    icon: 'fas fa-coins',
    description: 'Monitoring working capital, revenue timing, and expense discipline.'
  },
  {
    id: 'skill-34',
    name: 'Cold Calling & Sales',
    category: 'Entrepreneurship & Startup Building',
    level: '80%',
    icon: 'fas fa-phone',
    description: 'B2B outreach, discovery calls, objection handling, and deal closing.'
  },
  {
    id: 'skill-35',
    name: 'Customer Handling',
    category: 'Entrepreneurship & Startup Building',
    level: '88%',
    icon: 'fas fa-users',
    description: 'Client onboarding, retention, relationship building, and support.'
  },
  {
    id: 'skill-36',
    name: 'Product Pricing & Costing',
    category: 'Entrepreneurship & Startup Building',
    level: '85%',
    icon: 'fas fa-tags',
    description: 'Value-based pricing, unit margins, and competitive cost structures.'
  },
  {
    id: 'skill-37',
    name: 'Basic Financial Analysis',
    category: 'Data & Analytics',
    level: '80%',
    icon: 'fas fa-calculator',
    description: 'Break-even analysis, profit & loss projections, and basic return on investment.'
  },

  // 7. Writing & Communication
  {
    id: 'skill-38',
    name: 'Professional English Writing',
    category: 'Entrepreneurship & Startup Building',
    level: '90%',
    icon: 'fas fa-envelope',
    description: 'High-clarity executive emails, memoranda, and professional correspondence.'
  },
  {
    id: 'skill-39',
    name: 'Report & Proposal Writing',
    category: 'Entrepreneurship & Startup Building',
    level: '85%',
    icon: 'fas fa-file-alt',
    description: 'Client proposals, project scopes of work, and structured reports.'
  }
];

async function runSeed() {
  console.log('\n--- Step 1: Processing Projects ---');
  let migratedProjectsCount = 0;
  const processedProjects = [];

  for (let i = 0; i < rawProjectsFromFrontend.length; i++) {
    const p = rawProjectsFromFrontend[i];
    console.log(`\n[Project ${i + 1}/${rawProjectsFromFrontend.length}] ${p.title}`);
    console.log(`  Category: "${p.category}"`);
    console.log(`  Tags: ${p.tags.join(', ')}`);

    // Check if image exists locally and upload to Cloudinary if needed
    let finalImageUrl = p.image || '';
    if (finalImageUrl) {
      finalImageUrl = await ensureCloudinaryUrl(finalImageUrl, 'portfolio/projects');
    }

    // Check if proof_url exists locally and upload to Cloudinary if needed
    let finalProofUrl = p.proof_url || '';
    if (finalProofUrl) {
      finalProofUrl = await ensureCloudinaryUrl(finalProofUrl, 'portfolio/projects');
    }

    const projectDoc = {
      id: p.id,
      title: p.title,
      subtitle: p.subtitle || '',
      category: p.category, // Exact industry category
      date: p.date || '',
      tags: p.tags,
      description: p.description || '',
      link: p.link || '',
      image: finalImageUrl,
      proof_url: finalProofUrl,
      order: i + 1,
      updatedAt: new Date().toISOString()
    };

    processedProjects.push(projectDoc);

    if (db && !isDryRun) {
      try {
        await db.collection('projects').doc(p.id).set(projectDoc, { merge: true });
        console.log(`  -> Saved to Firestore collection "projects" as doc "${p.id}".`);
        migratedProjectsCount++;
      } catch (err) {
        console.error(`  [!] Error writing project ${p.id} to Firestore:`, err.message);
      }
    } else {
      migratedProjectsCount++;
      console.log(`  -> [Dry Run / Staged] Project ${p.id} prepared successfully.`);
    }
  }

  console.log('\n--- Step 2: Processing Skills ---');
  let migratedSkillsCount = 0;
  const processedSkills = [];

  for (let i = 0; i < rawSkillsFromFrontend.length; i++) {
    const s = rawSkillsFromFrontend[i];
    console.log(`[Skill ${i + 1}/${rawSkillsFromFrontend.length}] ${s.name} (${s.category}) - ${s.level}`);

    // If icon is a local image file, upload to Cloudinary
    let finalIcon = s.icon || '';
    if (finalIcon && (finalIcon.includes('/') || finalIcon.includes('.')) && !finalIcon.startsWith('fa')) {
      finalIcon = await ensureCloudinaryUrl(finalIcon, 'portfolio/skills');
    }

    const skillDoc = {
      id: s.id,
      name: s.name,
      category: s.category,
      level: s.level,
      icon: finalIcon,
      description: s.description || '',
      order: i + 1,
      updatedAt: new Date().toISOString()
    };

    processedSkills.push(skillDoc);

    if (db && !isDryRun) {
      try {
        await db.collection('skills').doc(s.id).set(skillDoc, { merge: true });
        migratedSkillsCount++;
      } catch (err) {
        console.error(`  [!] Error writing skill ${s.id} to Firestore:`, err.message);
      }
    } else {
      migratedSkillsCount++;
    }
  }

  // ── Step 3: Update local data/portfolio-data.json for synchronization
  console.log('\n--- Step 3: Synchronizing local data/portfolio-data.json ---');
  try {
    let localData = {};
    if (fs.existsSync(DATA_FILE_PATH)) {
      localData = JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8'));
    }

    localData.projects = processedProjects;
    localData.skills = processedSkills;

    if (!isDryRun) {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(localData, null, 2), 'utf8');
      console.log('[+] Synchronized projects and skills into data/portfolio-data.json.');
    } else {
      console.log('[*] [Dry Run] data/portfolio-data.json synchronization previewed.');
    }
  } catch (err) {
    console.warn('[!] Failed to update data/portfolio-data.json:', err.message);
  }

  // ── Summary
  console.log('\n' + '='.repeat(75));
  console.log('  MIGRATION SUMMARY');
  console.log('='.repeat(75));
  console.log(`  Mode:                     ${isDryRun ? 'Dry Run (Preview)' : 'Live Seeding'}`);
  console.log(`  Total Projects Migrated:  ${migratedProjectsCount} / ${rawProjectsFromFrontend.length}`);
  console.log(`  Total Skills Migrated:    ${migratedSkillsCount} / ${rawSkillsFromFrontend.length}`);
  console.log(`  Database Target:          Firestore (collections: "projects", "skills")`);
  console.log(`  Proof File Support:       Enabled (field: "proof_url")`);
  console.log('  Project Categories Used:');
  console.log('    • Business & Entrepreneurship');
  console.log('    • Tech & AI');
  console.log('    • Economics');
  console.log('    • Digital Marketing');
  console.log('    • Data Analytics');
  console.log('='.repeat(75) + '\n');
}

runSeed().then(() => {
  console.log('Migration process completed successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
