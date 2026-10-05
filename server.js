const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const dotenv = require('dotenv');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Firebase Admin SDK
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-env';

// Cloudinary Configuration
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary initialized successfully.');
} else {
  console.warn('Cloudinary credentials missing in .env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).');
}

// File Paths
const FIREBASE_KEY_PATH = path.join(__dirname, 'firebase-key.json');
const DATA_FILE = path.join(__dirname, 'data', 'portfolio-data.json');
const ENV_FILE = path.join(__dirname, '.env');

// Initialize Firebase Firestore
let db = null;
if (fs.existsSync(FIREBASE_KEY_PATH)) {
  try {
    const serviceAccount = require(FIREBASE_KEY_PATH);
    const firebaseApp = initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore(firebaseApp);
    console.log('Firebase Firestore initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
} else {
  console.warn('firebase-key.json not found. Operating with fallback storage.');
}

// Ensure local data directory exists for fallback storage
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Middleware
// CORS Configuration supporting GitHub Pages, localhost, and Render
const allowedOrigins = [
  'https://mudassirshah5.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
    const trimmed = o.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.github.io') ||
      origin.endsWith('.onrender.com')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Helper: Local fallback read
function readLocalData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { siteText: {}, certifications: [], blogs: [], projects: [], skills: [], cv: null };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      siteText: parsed.siteText || {},
      certifications: parsed.certifications || [],
      blogs: parsed.blogs || [],
      projects: parsed.projects || [],
      skills: parsed.skills || [],
      cv: parsed.cv || null
    };
  } catch (err) {
    console.error('Error reading local data file:', err);
    return { siteText: {}, certifications: [], blogs: [], projects: [], skills: [], cv: null };
  }
}

// Helper: Local fallback write
function writeLocalData(data) {
  try {
    const tempFile = DATA_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Error writing local data file:', err);
    return false;
  }
}

// Helper: Main read from Firestore with per-collection error resilience and local fallback
async function getPortfolioData() {
  const localData = readLocalData();

  if (!db) {
    console.warn('[Firestore] No active database connection. Serving local data fallback.');
    return localData;
  }

  try {
    // Query collections concurrently with Promise.allSettled so no single collection failure aborts the rest
    const [siteTextRes, certsRes, blogsRes, projectsRes, skillsRes, cvRes] = await Promise.allSettled([
      db.collection('content').doc('siteText').get(),
      db.collection('certifications').get(),
      db.collection('blogs').get(),
      db.collection('projects').get(),
      db.collection('skills').get(),
      db.collection('content').doc('cv').get()
    ]);

    // 1. Site Text
    let siteText = localData.siteText || {};
    if (siteTextRes.status === 'fulfilled' && siteTextRes.value && siteTextRes.value.exists) {
      siteText = { ...siteText, ...siteTextRes.value.data() };
    }

    // 2. CV Document
    let cv = localData.cv || null;
    if (cvRes.status === 'fulfilled' && cvRes.value && cvRes.value.exists) {
      cv = { ...cv, ...cvRes.value.data() };
    }

    // 3. Certifications
    let certifications = [];
    if (certsRes.status === 'fulfilled' && certsRes.value && !certsRes.value.empty) {
      certsRes.value.forEach(doc => {
        const item = doc.data() || {};
        certifications.push({
          id: doc.id || item.id,
          title: item.title || '',
          issuer: item.issuer || '',
          date: item.date || '',
          description: item.description || '',
          image: item.image || '',
          verificationLink: item.verificationLink || '',
          order: item.order !== undefined ? Number(item.order) : 999
        });
      });
      certifications.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
    } else {
      certifications = localData.certifications || [];
    }

    // 4. Blogs
    let blogs = [];
    if (blogsRes.status === 'fulfilled' && blogsRes.value && !blogsRes.value.empty) {
      blogsRes.value.forEach(doc => {
        const item = doc.data() || {};
        blogs.push({
          id: doc.id || item.id,
          title: item.title || 'Untitled Blog Post',
          category: item.category || 'General',
          date: item.date || '',
          readTime: item.readTime || '3 min read',
          excerpt: item.excerpt || '',
          content: item.content || '',
          image: item.image || '',
          tags: Array.isArray(item.tags)
            ? item.tags
            : (item.tags ? String(item.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
          order: item.order !== undefined ? Number(item.order) : 999,
          updatedAt: item.updatedAt || ''
        });
      });
      blogs.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
    } else {
      blogs = localData.blogs || [];
    }

    // 5. Projects
    let projects = [];
    if (projectsRes.status === 'fulfilled' && projectsRes.value && !projectsRes.value.empty) {
      projectsRes.value.forEach(doc => {
        const item = doc.data() || {};
        projects.push({
          id: doc.id || item.id,
          title: item.title || 'Untitled Project',
          subtitle: item.subtitle || '',
          description: item.description || '',
          category: item.category || 'Business & Entrepreneurship',
          date: item.date || '',
          tags: Array.isArray(item.tags)
            ? item.tags
            : (item.tags ? String(item.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
          link: item.link || '',
          image: item.image || '',
          proof_url: item.proof_url || item.proofUrl || '',
          order: item.order !== undefined ? Number(item.order) : 999,
          updatedAt: item.updatedAt || ''
        });
      });
      projects.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
    } else {
      projects = localData.projects || [];
    }

    // 6. Skills
    let skills = [];
    if (skillsRes.status === 'fulfilled' && skillsRes.value && !skillsRes.value.empty) {
      skillsRes.value.forEach(doc => {
        const item = doc.data() || {};
        skills.push({
          id: doc.id || item.id,
          name: item.name || 'Skill',
          category: item.category || 'Other Capabilities',
          level: item.level !== undefined ? String(item.level) : '80%',
          icon: item.icon || 'fas fa-check',
          description: item.description || '',
          order: item.order !== undefined ? Number(item.order) : 999,
          updatedAt: item.updatedAt || ''
        });
      });
      skills.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
    } else {
      skills = localData.skills || [];
    }

    console.log(`[Firestore getPortfolioData] Loaded ${projects.length} projects, ${skills.length} skills, ${blogs.length} blogs, ${certifications.length} certifications.`);
    return { siteText, certifications, blogs, projects, skills, cv };
  } catch (err) {
    console.error('Error reading portfolio data from Firestore:', err);
    return localData;
  }
}

// Helper: Update .env file safely
function updateEnvFile(newValues) {
  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  for (const [key, value] of Object.entries(newValues)) {
    process.env[key] = value;
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += (envContent.endsWith('\n') || envContent === '' ? '' : '\n') + `${key}=${value}\n`;
    }
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf-8');
}

// Authentication Middleware
function authenticateAdmin(req, res, next) {
  const token = req.cookies?.auth_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }
    return res.redirect('/admin/login.html');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const targetEmail = (process.env.ADMIN_EMAIL || 'mmudassirshah634@gmail.com').toLowerCase();
    if (!decoded || !decoded.email || decoded.email.toLowerCase() !== targetEmail) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials token' });
      }
      return res.redirect('/admin/login.html');
    }
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }
    return res.redirect('/admin/login.html');
  }
}

// Cloudinary Storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'portfolio';
    const target = (req.originalUrl || req.path || '').toLowerCase();
    if (target.includes('certification')) {
      folder = 'portfolio/certifications';
    } else if (target.includes('blog')) {
      folder = 'portfolio/blogs';
    } else if (target.includes('cv')) {
      folder = 'portfolio/cvs';
    } else if (target.includes('project')) {
      folder = 'portfolio/projects';
    } else if (target.includes('skill')) {
      folder = 'portfolio/skills';
    } else if (req.query?.folder) {
      folder = `portfolio/${req.query.folder.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);

    return {
      folder: folder,
      resource_type: 'auto',
      public_id: `${cleanBase}-${uniqueSuffix}`
    };
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max limit
  fileFilter: function (req, file, cb) {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, GIF, SVG images and PDF, Word, PowerPoint documents are allowed.'));
    }
  }
});

// Helper middleware: Optional file upload for routes that support both text-only and file uploads
function optionalUpload(fieldName = 'file') {
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      upload.single(fieldName)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
          }
          return res.status(400).json({ error: err.message });
        } else if (err) {
          return res.status(400).json({ error: err.message });
        }
        next();
      });
    } else {
      next();
    }
  };
}

// ─────────────────────────────────────────────────────────────
// AUTH API ROUTES
// ─────────────────────────────────────────────────────────────

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'mmudassirshah634@gmail.com';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!passwordHash) {
    return res.status(500).json({ error: 'Admin password hash not configured in environment' });
  }

  const matches = bcrypt.compareSync(password, passwordHash);
  if (!matches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Issue token
  const token = jwt.sign({ email: adminEmail }, JWT_SECRET, { expiresIn: '7d' });

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({ success: true, message: 'Logged in successfully', email: adminEmail });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

// Check Session
app.get('/api/auth/me', authenticateAdmin, (req, res) => {
  res.json({ authenticated: true, email: req.admin.email });
});

// Change Password & Settings
app.post('/api/auth/settings', authenticateAdmin, (req, res) => {
  const { currentPassword, newPassword, newEmail } = req.body;
  const currentHash = process.env.ADMIN_PASSWORD_HASH;

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required to make security changes' });
  }

  if (!bcrypt.compareSync(currentPassword, currentHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const updates = {};

  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    const newHash = bcrypt.hashSync(newPassword, 10);
    updates.ADMIN_PASSWORD_HASH = newHash;
  }

  if (newEmail && newEmail.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    updates.ADMIN_EMAIL = newEmail.trim().toLowerCase();
  }

  if (Object.keys(updates).length > 0) {
    updateEnvFile(updates);
  }

  // Re-issue cookie with updated email if changed
  const currentEmail = updates.ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const token = jwt.sign({ email: currentEmail }, JWT_SECRET, { expiresIn: '7d' });
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ success: true, message: 'Security settings updated successfully', email: currentEmail });
});

// ─────────────────────────────────────────────────────────────
// CONTENT API ROUTES (FIRESTORE)
// ─────────────────────────────────────────────────────────────

// Public endpoint to get all site content
app.get('/api/content', async (req, res) => {
  try {
    const data = await getPortfolioData();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(data);
  } catch (err) {
    console.error('Error fetching content:', err);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const local = readLocalData();
    res.json(local);
  }
});

// Protected: Update site text
app.post('/api/content/site-text', authenticateAdmin, async (req, res) => {
  const { siteText } = req.body;
  if (!siteText) {
    return res.status(400).json({ error: 'siteText data is required' });
  }

  try {
    if (db) {
      const docRef = db.collection('content').doc('siteText');
      const snap = await docRef.get();
      const existing = snap.exists ? snap.data() : {};

      const merged = {
        hero: { ...(existing.hero || {}), ...(siteText.hero || {}) },
        about: { ...(existing.about || {}), ...(siteText.about || {}) },
        stats: { ...(existing.stats || {}), ...(siteText.stats || {}) },
        contact: { ...(existing.contact || {}), ...(siteText.contact || {}) },
        socials: { ...(existing.socials || {}), ...(siteText.socials || {}) }
      };

      await docRef.set(merged, { merge: true });
      return res.json({ success: true, message: 'Site text updated successfully in Firestore', siteText: merged });
    }

    // Local fallback
    const local = readLocalData();
    local.siteText = {
      hero: { ...(local.siteText?.hero || {}), ...(siteText.hero || {}) },
      about: { ...(local.siteText?.about || {}), ...(siteText.about || {}) },
      stats: { ...(local.siteText?.stats || {}), ...(siteText.stats || {}) },
      contact: { ...(local.siteText?.contact || {}), ...(siteText.contact || {}) },
      socials: { ...(local.siteText?.socials || {}), ...(siteText.socials || {}) }
    };
    writeLocalData(local);
    res.json({ success: true, message: 'Site text updated successfully', siteText: local.siteText });
  } catch (err) {
    console.error('Error updating site text:', err);
    res.status(500).json({ error: 'Failed to save site text' });
  }
});

// Protected: Certifications CRUD
app.post('/api/content/certifications', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const { title, issuer, date, description, image, verificationLink } = req.body;
  if (!title || !issuer) {
    return res.status(400).json({ error: 'Title and Issuer are required' });
  }

  const certId = 'cert-' + Date.now();
  const fileUrl = req.file ? (req.file.path || req.file.secure_url) : (image || '').trim();

  const newCert = {
    id: certId,
    title: title.trim(),
    issuer: issuer.trim(),
    date: (date || '').trim(),
    description: (description || '').trim(),
    image: fileUrl,
    verificationLink: (verificationLink || '').trim(),
    order: -Date.now()
  };

  try {
    if (db) {
      await db.collection('certifications').doc(certId).set({
        ...newCert,
        createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      });
      return res.status(201).json({ success: true, message: 'Certification added successfully in Firestore', certification: newCert });
    }

    // Local fallback
    const local = readLocalData();
    local.certifications = local.certifications || [];
    local.certifications.unshift(newCert);
    writeLocalData(local);
    res.status(201).json({ success: true, message: 'Certification added successfully', certification: newCert });
  } catch (err) {
    console.error('Error saving certification:', err);
    res.status(500).json({ error: 'Failed to save certification' });
  }
});

app.put('/api/content/certifications/:id', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const certId = req.params.id;
  const { title, issuer, date, description, image, verificationLink } = req.body;

  if (!title || !issuer) {
    return res.status(400).json({ error: 'Title and Issuer are required' });
  }

  try {
    if (db) {
      const docRef = db.collection('certifications').doc(certId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Certification not found' });
      }

      const existing = snap.data();
      const fileUrl = req.file
        ? (req.file.path || req.file.secure_url)
        : (image !== undefined ? image.trim() : existing.image);

      const updated = {
        ...existing,
        title: title.trim(),
        issuer: issuer.trim(),
        date: (date || '').trim(),
        description: (description || '').trim(),
        image: fileUrl,
        verificationLink: verificationLink !== undefined ? verificationLink.trim() : existing.verificationLink,
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      };

      await docRef.set(updated, { merge: true });
      return res.json({ success: true, message: 'Certification updated successfully in Firestore', certification: updated });
    }

    // Local fallback
    const local = readLocalData();
    local.certifications = local.certifications || [];
    const index = local.certifications.findIndex(c => c.id === certId);
    if (index === -1) {
      return res.status(404).json({ error: 'Certification not found' });
    }

    const fileUrl = req.file
      ? (req.file.path || req.file.secure_url)
      : (image !== undefined ? image.trim() : local.certifications[index].image);

    local.certifications[index] = {
      ...local.certifications[index],
      title: title.trim(),
      issuer: issuer.trim(),
      date: (date || '').trim(),
      description: (description || '').trim(),
      image: fileUrl,
      verificationLink: verificationLink !== undefined ? verificationLink.trim() : local.certifications[index].verificationLink
    };
    writeLocalData(local);
    res.json({ success: true, message: 'Certification updated successfully', certification: local.certifications[index] });
  } catch (err) {
    console.error('Error updating certification:', err);
    res.status(500).json({ error: 'Failed to update certification' });
  }
});

app.delete('/api/content/certifications/:id', authenticateAdmin, async (req, res) => {
  const certId = req.params.id;

  try {
    if (db) {
      const docRef = db.collection('certifications').doc(certId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Certification not found' });
      }

      await docRef.delete();
      return res.json({ success: true, message: 'Certification deleted successfully from Firestore' });
    }

    // Local fallback
    const local = readLocalData();
    local.certifications = local.certifications || [];
    const initialCount = local.certifications.length;
    local.certifications = local.certifications.filter(c => c.id !== certId);
    if (local.certifications.length === initialCount) {
      return res.status(404).json({ error: 'Certification not found' });
    }
    writeLocalData(local);
    res.json({ success: true, message: 'Certification deleted successfully' });
  } catch (err) {
    console.error('Error deleting certification:', err);
    res.status(500).json({ error: 'Failed to delete certification' });
  }
});

// ─────────────────────────────────────────────────────────────
// BLOG POSTS CRUD (WITH OPTIONAL CLOUDINARY FILE UPLOAD & TEXT-ONLY)
// ─────────────────────────────────────────────────────────────

app.get('/api/content/blogs', async (req, res) => {
  try {
    if (db) {
      const snap = await db.collection('blogs').get();
      const blogs = [];
      snap.forEach(doc => {
        blogs.push({ ...doc.data(), id: doc.id });
      });
      blogs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      return res.json({ success: true, blogs });
    }

    const local = readLocalData();
    res.json({ success: true, blogs: local.blogs || [] });
  } catch (err) {
    console.error('Error fetching blogs:', err);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

app.post('/api/content/blogs', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const { title, category, date, readTime, excerpt, content, image, tags } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Blog title is required' });
  }

  const blogId = 'blog-' + Date.now();
  const fileUrl = req.file ? (req.file.path || req.file.secure_url || req.file.url) : (image || '').trim();
  const parsedTags = Array.isArray(tags)
    ? tags
    : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);

  const newBlog = {
    id: blogId,
    title: title.trim(),
    category: (category || 'General').trim(),
    date: (date || '').trim(),
    readTime: (readTime || '3 min read').trim(),
    excerpt: (excerpt || '').trim(),
    content: (content || '').trim(),
    image: fileUrl,
    tags: parsedTags,
    order: -Date.now()
  };

  try {
    if (db) {
      await db.collection('blogs').doc(blogId).set({
        ...newBlog,
        createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      });
      return res.status(201).json({ success: true, message: 'Blog post created successfully in Firestore', blog: newBlog });
    }

    // Local fallback
    const local = readLocalData();
    local.blogs = local.blogs || [];
    local.blogs.unshift(newBlog);
    writeLocalData(local);
    res.status(201).json({ success: true, message: 'Blog post created successfully', blog: newBlog });
  } catch (err) {
    console.error('Error saving blog post:', err);
    res.status(500).json({ error: 'Failed to save blog post' });
  }
});

app.put('/api/content/blogs/:id', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const blogId = req.params.id;
  const { title, category, date, readTime, excerpt, content, image, tags, order } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Blog title is required' });
  }

  try {
    if (db) {
      const docRef = db.collection('blogs').doc(blogId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      const existing = snap.data();
      const fileUrl = req.file
        ? (req.file.path || req.file.secure_url || req.file.url)
        : (image !== undefined ? image.trim() : existing.image);

      const parsedTags = tags !== undefined
        ? (Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean))
        : existing.tags;

      const updated = {
        ...existing,
        title: title.trim(),
        category: category !== undefined ? category.trim() : (existing.category || 'General'),
        date: date !== undefined ? date.trim() : (existing.date || ''),
        readTime: readTime !== undefined ? readTime.trim() : (existing.readTime || '3 min read'),
        excerpt: excerpt !== undefined ? excerpt.trim() : (existing.excerpt || ''),
        content: content !== undefined ? content.trim() : (existing.content || ''),
        image: fileUrl,
        tags: parsedTags,
        order: order !== undefined ? Number(order) : (existing.order ?? 999),
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      };

      await docRef.set(updated, { merge: true });
      return res.json({ success: true, message: 'Blog post updated successfully in Firestore', blog: updated });
    }

    // Local fallback
    const local = readLocalData();
    local.blogs = local.blogs || [];
    const index = local.blogs.findIndex(b => b.id === blogId);
    if (index === -1) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const fileUrl = req.file
      ? (req.file.path || req.file.secure_url || req.file.url)
      : (image !== undefined ? image.trim() : local.blogs[index].image);

    const parsedTags = tags !== undefined
      ? (Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean))
      : local.blogs[index].tags;

    local.blogs[index] = {
      ...local.blogs[index],
      title: title.trim(),
      category: category !== undefined ? category.trim() : (local.blogs[index].category || 'General'),
      date: date !== undefined ? date.trim() : (local.blogs[index].date || ''),
      readTime: readTime !== undefined ? readTime.trim() : (local.blogs[index].readTime || '3 min read'),
      excerpt: excerpt !== undefined ? excerpt.trim() : (local.blogs[index].excerpt || ''),
      content: content !== undefined ? content.trim() : (local.blogs[index].content || ''),
      image: fileUrl,
      tags: parsedTags,
      order: order !== undefined ? Number(order) : (local.blogs[index].order ?? 999)
    };
    writeLocalData(local);
    res.json({ success: true, message: 'Blog post updated successfully', blog: local.blogs[index] });
  } catch (err) {
    console.error('Error updating blog post:', err);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

app.delete('/api/content/blogs/:id', authenticateAdmin, async (req, res) => {
  const blogId = req.params.id;

  try {
    if (db) {
      const docRef = db.collection('blogs').doc(blogId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      await docRef.delete();
      return res.json({ success: true, message: 'Blog post deleted successfully from Firestore' });
    }

    // Local fallback
    const local = readLocalData();
    local.blogs = local.blogs || [];
    const initialCount = local.blogs.length;
    local.blogs = local.blogs.filter(b => b.id !== blogId);
    if (local.blogs.length === initialCount) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    writeLocalData(local);
    res.json({ success: true, message: 'Blog post deleted successfully' });
  } catch (err) {
    console.error('Error deleting blog post:', err);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

// Protected: File Upload (Direct to Cloudinary)
app.post('/api/upload', authenticateAdmin, (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(500).json({
      error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    });
  }

  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cloudinaryUrl = req.file.path || req.file.secure_url || req.file.url;
    return res.json({
      success: true,
      message: 'File uploaded successfully to Cloudinary',
      url: cloudinaryUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

// Protected: Dedicated File Upload Endpoints (certifications, achievements, CVs, projects)
app.post('/api/upload/certification', authenticateAdmin, (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(500).json({
      error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    });
  }

  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cloudinaryUrl = req.file.path || req.file.secure_url || req.file.url;
    return res.json({
      success: true,
      message: 'Certification file uploaded successfully to Cloudinary',
      url: cloudinaryUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

app.post('/api/upload/blog', authenticateAdmin, (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(500).json({
      error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    });
  }

  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cloudinaryUrl = req.file.path || req.file.secure_url || req.file.url;
    return res.json({
      success: true,
      message: 'Blog cover image uploaded successfully to Cloudinary',
      url: cloudinaryUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

app.post('/api/upload/skill', authenticateAdmin, (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(500).json({
      error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    });
  }

  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cloudinaryUrl = req.file.path || req.file.secure_url || req.file.url;
    return res.json({
      success: true,
      message: 'Skill icon/image uploaded successfully to Cloudinary',
      url: cloudinaryUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

app.post('/api/upload/cv', authenticateAdmin, (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(500).json({
      error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    });
  }

  upload.single('file')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cloudinaryUrl = req.file.path || req.file.secure_url || req.file.url;

    try {
      const cvData = {
        url: cloudinaryUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      };

      if (db) {
        await db.collection('content').doc('cv').set(cvData, { merge: true });
      }

      const local = readLocalData();
      local.cv = { ...cvData, updatedAt: new Date().toISOString() };
      writeLocalData(local);

      return res.json({
        success: true,
        message: 'CV uploaded successfully to Cloudinary and saved to database',
        url: cloudinaryUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (saveErr) {
      console.error('Error saving CV document to Firestore:', saveErr);
      return res.json({
        success: true,
        message: 'CV uploaded to Cloudinary, but failed to update Firestore document',
        url: cloudinaryUrl
      });
    }
  });
});

app.post('/api/upload/project', authenticateAdmin, (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(500).json({
      error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    });
  }

  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cloudinaryUrl = req.file.path || req.file.secure_url || req.file.url;
    return res.json({
      success: true,
      message: 'Project file uploaded successfully to Cloudinary',
      url: cloudinaryUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

// CV Content Routes
app.get('/api/content/cv', async (req, res) => {
  try {
    if (db) {
      const snap = await db.collection('content').doc('cv').get();
      if (snap.exists) {
        return res.json({ success: true, cv: snap.data() });
      }
    }
    const local = readLocalData();
    res.json({ success: true, cv: local.cv || null });
  } catch (err) {
    console.error('Error fetching CV:', err);
    res.status(500).json({ error: 'Failed to fetch CV' });
  }
});

app.post('/api/content/cv', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const url = req.file ? (req.file.path || req.file.secure_url) : (req.body.url || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'CV file upload or URL is required' });
  }

  try {
    const cvData = {
      url: url,
      filename: req.file ? req.file.originalname : (req.body.filename || 'CV.pdf'),
      updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
    };

    if (db) {
      await db.collection('content').doc('cv').set(cvData, { merge: true });
    }

    const local = readLocalData();
    local.cv = { ...cvData, updatedAt: new Date().toISOString() };
    writeLocalData(local);

    res.json({ success: true, message: 'CV updated successfully', cv: cvData });
  } catch (err) {
    console.error('Error saving CV:', err);
    res.status(500).json({ error: 'Failed to save CV' });
  }
});

// ─────────────────────────────────────────────────────────────
// PROJECTS CRUD (WITH OPTIONAL CLOUDINARY FILE UPLOAD & TEXT-ONLY)
// ─────────────────────────────────────────────────────────────

app.get('/api/content/projects', async (req, res) => {
  try {
    if (db) {
      const snap = await db.collection('projects').get();
      const projects = [];
      snap.forEach(doc => {
        projects.push({ ...doc.data(), id: doc.id });
      });
      projects.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      return res.json({ success: true, projects });
    }

    const local = readLocalData();
    res.json({ success: true, projects: local.projects || [] });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/content/projects', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const { title, subtitle, description, category, date, tags, link, projectUrl, proof_url, proofUrl } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Project title is required' });
  }

  const imageUrl = req.file
    ? (req.file.path || req.file.secure_url || req.file.url)
    : (req.body.image || req.body.fileUrl || '').trim();

  const finalProofUrl = (proof_url || proofUrl || '').trim();

  const projectId = 'project-' + Date.now();
  const parsedTags = Array.isArray(tags)
    ? tags
    : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);

  const newProject = {
    id: projectId,
    title: title.trim(),
    subtitle: (subtitle || '').trim(),
    description: (description || '').trim(),
    category: (category || 'Business & Entrepreneurship').trim(),
    date: (date || '').trim(),
    tags: parsedTags,
    link: (link || projectUrl || '').trim(),
    image: imageUrl,
    proof_url: finalProofUrl,
    order: -Date.now()
  };

  try {
    if (db) {
      await db.collection('projects').doc(projectId).set({
        ...newProject,
        createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      });
      return res.status(201).json({
        success: true,
        message: 'Project created successfully in Firestore',
        project: newProject
      });
    }

    // Local fallback
    const local = readLocalData();
    local.projects = local.projects || [];
    local.projects.unshift(newProject);
    writeLocalData(local);
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: newProject
    });
  } catch (err) {
    console.error('Error saving project:', err);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

app.put('/api/content/projects/:id', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const projectId = req.params.id;
  const { title, subtitle, description, category, date, tags, link, projectUrl, proof_url, proofUrl, order } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Project title is required' });
  }

  try {
    if (db) {
      const docRef = db.collection('projects').doc(projectId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const existing = snap.data();
      const imageUrl = req.file
        ? (req.file.path || req.file.secure_url || req.file.url)
        : (req.body.image !== undefined ? req.body.image.trim() : existing.image);

      const parsedTags = tags !== undefined
        ? (Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean))
        : existing.tags;

      const incomingProof = proof_url !== undefined ? proof_url : proofUrl;
      const finalProofUrl = incomingProof !== undefined ? incomingProof.trim() : (existing.proof_url || '');

      const updated = {
        ...existing,
        title: title.trim(),
        subtitle: subtitle !== undefined ? subtitle.trim() : (existing.subtitle || ''),
        description: description !== undefined ? description.trim() : (existing.description || ''),
        category: category !== undefined ? category.trim() : (existing.category || 'Business & Entrepreneurship'),
        date: date !== undefined ? date.trim() : (existing.date || ''),
        tags: parsedTags,
        link: link !== undefined || projectUrl !== undefined ? (link || projectUrl || '').trim() : (existing.link || ''),
        image: imageUrl,
        proof_url: finalProofUrl,
        order: order !== undefined ? Number(order) : (existing.order ?? 999),
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      };

      await docRef.set(updated, { merge: true });
      return res.json({
        success: true,
        message: 'Project updated successfully in Firestore',
        project: updated
      });
    }

    // Local fallback
    const local = readLocalData();
    local.projects = local.projects || [];
    const index = local.projects.findIndex(p => p.id === projectId);
    if (index === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existing = local.projects[index];
    const imageUrl = req.file
      ? (req.file.path || req.file.secure_url || req.file.url)
      : (req.body.image !== undefined ? req.body.image.trim() : existing.image);

    const parsedTags = tags !== undefined
      ? (Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean))
      : existing.tags;

    const incomingProof = proof_url !== undefined ? proof_url : proofUrl;
    const finalProofUrl = incomingProof !== undefined ? incomingProof.trim() : (existing.proof_url || '');

    local.projects[index] = {
      ...existing,
      title: title.trim(),
      subtitle: subtitle !== undefined ? subtitle.trim() : (existing.subtitle || ''),
      description: description !== undefined ? description.trim() : (existing.description || ''),
      category: category !== undefined ? category.trim() : (existing.category || 'Business & Entrepreneurship'),
      date: date !== undefined ? date.trim() : (existing.date || ''),
      tags: parsedTags,
      link: link !== undefined || projectUrl !== undefined ? (link || projectUrl || '').trim() : (existing.link || ''),
      image: imageUrl,
      proof_url: finalProofUrl,
      order: order !== undefined ? Number(order) : (existing.order ?? 999)
    };

    writeLocalData(local);
    res.json({
      success: true,
      message: 'Project updated successfully',
      project: local.projects[index]
    });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/content/projects/:id', authenticateAdmin, async (req, res) => {
  const projectId = req.params.id;

  try {
    if (db) {
      const docRef = db.collection('projects').doc(projectId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await docRef.delete();
      return res.json({ success: true, message: 'Project deleted successfully from Firestore' });
    }

    // Local fallback
    const local = readLocalData();
    local.projects = local.projects || [];
    const initialCount = local.projects.length;
    local.projects = local.projects.filter(p => p.id !== projectId);
    if (local.projects.length === initialCount) {
      return res.status(404).json({ error: 'Project not found' });
    }
    writeLocalData(local);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.get('/api/content/project-categories', async (req, res) => {
  try {
    const data = await getPortfolioData();
    const standardCategories = [
      'Business & Entrepreneurship',
      'Tech & AI',
      'Economics',
      'Digital Marketing',
      'Data Analytics'
    ];
    const existingProjectCats = (data.projects || []).map(p => p.category).filter(Boolean);
    const combined = Array.from(new Set([...standardCategories, ...existingProjectCats]));
    res.json({ success: true, categories: combined });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project categories' });
  }
});

// ─────────────────────────────────────────────────────────────
// SKILLS CRUD (WITH OPTIONAL CLOUDINARY FILE UPLOAD & TEXT-ONLY)
// ─────────────────────────────────────────────────────────────

app.get('/api/content/skills', async (req, res) => {
  try {
    if (db) {
      const snap = await db.collection('skills').get();
      const skills = [];
      snap.forEach(doc => {
        skills.push({ ...doc.data(), id: doc.id });
      });
      skills.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      return res.json({ success: true, skills });
    }

    const local = readLocalData();
    res.json({ success: true, skills: local.skills || [] });
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

app.post('/api/content/skills', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const { name, category, level, icon, description, order } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: 'Skill name and category are required' });
  }

  const iconUrl = req.file
    ? (req.file.path || req.file.secure_url || req.file.url)
    : (icon || '').trim();

  const skillId = 'skill-' + Date.now();

  const newSkill = {
    id: skillId,
    name: name.trim(),
    category: category.trim(),
    level: level !== undefined ? String(level).trim() : '',
    icon: iconUrl,
    description: (description || '').trim(),
    order: order !== undefined ? Number(order) : -Date.now()
  };

  try {
    if (db) {
      await db.collection('skills').doc(skillId).set({
        ...newSkill,
        createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      });
      return res.status(201).json({
        success: true,
        message: 'Skill created successfully in Firestore',
        skill: newSkill
      });
    }

    // Local fallback
    const local = readLocalData();
    local.skills = local.skills || [];
    local.skills.unshift(newSkill);
    writeLocalData(local);
    res.status(201).json({
      success: true,
      message: 'Skill created successfully',
      skill: newSkill
    });
  } catch (err) {
    console.error('Error saving skill:', err);
    res.status(500).json({ error: 'Failed to save skill' });
  }
});

app.put('/api/content/skills/:id', authenticateAdmin, optionalUpload('file'), async (req, res) => {
  const skillId = req.params.id;
  const { name, category, level, icon, description, order } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: 'Skill name and category are required' });
  }

  try {
    if (db) {
      const docRef = db.collection('skills').doc(skillId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      const existing = snap.data();
      const iconUrl = req.file
        ? (req.file.path || req.file.secure_url || req.file.url)
        : (icon !== undefined ? icon.trim() : existing.icon);

      const updated = {
        ...existing,
        name: name.trim(),
        category: category.trim(),
        level: level !== undefined ? String(level).trim() : (existing.level || ''),
        icon: iconUrl,
        description: description !== undefined ? description.trim() : (existing.description || ''),
        order: order !== undefined ? Number(order) : (existing.order ?? 999),
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
      };

      await docRef.set(updated, { merge: true });
      return res.json({
        success: true,
        message: 'Skill updated successfully in Firestore',
        skill: updated
      });
    }

    // Local fallback
    const local = readLocalData();
    local.skills = local.skills || [];
    const index = local.skills.findIndex(s => s.id === skillId);
    if (index === -1) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    const existing = local.skills[index];
    const iconUrl = req.file
      ? (req.file.path || req.file.secure_url || req.file.url)
      : (icon !== undefined ? icon.trim() : existing.icon);

    local.skills[index] = {
      ...existing,
      name: name.trim(),
      category: category.trim(),
      level: level !== undefined ? String(level).trim() : (existing.level || ''),
      icon: iconUrl,
      description: description !== undefined ? description.trim() : (existing.description || ''),
      order: order !== undefined ? Number(order) : (existing.order ?? 999)
    };

    writeLocalData(local);
    res.json({
      success: true,
      message: 'Skill updated successfully',
      skill: local.skills[index]
    });
  } catch (err) {
    console.error('Error updating skill:', err);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

app.delete('/api/content/skills/:id', authenticateAdmin, async (req, res) => {
  const skillId = req.params.id;

  try {
    if (db) {
      const docRef = db.collection('skills').doc(skillId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      await docRef.delete();
      return res.json({ success: true, message: 'Skill deleted successfully from Firestore' });
    }

    // Local fallback
    const local = readLocalData();
    local.skills = local.skills || [];
    const initialCount = local.skills.length;
    local.skills = local.skills.filter(s => s.id !== skillId);
    if (local.skills.length === initialCount) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    writeLocalData(local);
    res.json({ success: true, message: 'Skill deleted successfully' });
  } catch (err) {
    console.error('Error deleting skill:', err);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTE PROTECTION
// ─────────────────────────────────────────────────────────────

// Login page is accessible without auth
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Protect all other /admin routes
app.use('/admin', authenticateAdmin, express.static(path.join(__dirname, 'admin')));

// ─────────────────────────────────────────────────────────────
// PUBLIC SITE STATIC SERVING
// ─────────────────────────────────────────────────────────────
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => {
  console.log(`Portfolio server is running at http://localhost:${PORT}`);
  console.log(`Admin panel is available at http://localhost:${PORT}/admin`);
});
