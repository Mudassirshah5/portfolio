/**
 * migrate-to-cloudinary.js
 * 
 * One-time automated bulk migration script to upload existing local media 
 * (certifications, achievements, projects, CV, and site assets) directly to Cloudinary
 * and update Firestore documents with permanent Cloudinary URLs.
 * 
 * Usage:
 *   node migrate-to-cloudinary.js           # Run full migration
 *   node migrate-to-cloudinary.js --dry-run # Scan and test without uploading or modifying database
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Load environment variables from .env
dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

console.log('='.repeat(75));
console.log('  Cloudinary Bulk Media Migration Script');
console.log(isDryRun ? '  [MODE: DRY RUN - No uploads or database modifications will occur]' : '  [MODE: LIVE MIGRATION]');
console.log('='.repeat(75));

// 1. Validate Cloudinary Credentials
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (!isCloudinaryConfigured) {
  if (isDryRun) {
    console.warn('\n[!] Cloudinary credentials are missing in .env, but continuing scan in dry-run mode.');
  } else {
    console.error('\n' + '='.repeat(75));
    console.error('[ERROR] Cloudinary credentials missing in .env!');
    console.error('='.repeat(75));
    console.error('Please update your .env file with your valid Cloudinary credentials:');
    console.error('  CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.error('  CLOUDINARY_API_KEY=your_api_key');
    console.error('  CLOUDINARY_API_SECRET=your_api_secret\n');
    console.error('You can also run a test scan first with:');
    console.error('  node migrate-to-cloudinary.js --dry-run\n');
    console.error('After updating .env, execute:');
    console.error('  node migrate-to-cloudinary.js');
    console.error('='.repeat(75) + '\n');
    process.exit(1);
  }
} else {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  console.log(`[*] Cloudinary configured successfully for cloud: "${cloudName}".`);
}

// 2. Initialize Firebase Firestore
const FIREBASE_KEY_PATH = path.join(__dirname, 'firebase-key.json');
const DATA_FILE = path.join(__dirname, 'data', 'portfolio-data.json');

if (!fs.existsSync(FIREBASE_KEY_PATH)) {
  console.error('\n[ERROR] firebase-key.json not found in project root directory.');
  process.exit(1);
}

let db = null;
try {
  const serviceAccount = require(FIREBASE_KEY_PATH);
  const app = initializeApp({
    credential: cert(serviceAccount)
  });
  db = getFirestore(app);
  console.log('[*] Connected to Firebase Firestore successfully.');
} catch (err) {
  console.error('[ERROR] Failed to initialize Firebase Admin SDK:', err.message);
  process.exit(1);
}

// Helper: Check if string is already an active remote URL
function isRemoteUrl(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//');
}

// Helper: Check if URL is a placeholder/test URL needing real migration
function isPlaceholderUrl(val) {
  if (!val || typeof val !== 'string') return false;
  return val.includes('test-cloud') || val.includes('example.com') || val.includes('your-future-render-url');
}

// Helper: Find physical local file on disk
function resolveLocalFile(filePath, fallbackBasename = null) {
  if (!filePath && !fallbackBasename) return null;
  const candidates = [];

  if (filePath && typeof filePath === 'string') {
    const raw = filePath.trim();
    // Strip leading slashes and relative parent notation
    const clean = raw.replace(/^[\\\/]+/, '').replace(/^(\.\.[\/\\]|\.[\/\\])+/, '');
    candidates.push(path.resolve(__dirname, raw));
    candidates.push(path.resolve(__dirname, clean));
    candidates.push(path.resolve(__dirname, 'assets', clean));
    candidates.push(path.resolve(__dirname, 'assets', 'images', path.basename(raw)));
    candidates.push(path.resolve(__dirname, 'assets', 'uploads', path.basename(raw)));
  }

  if (fallbackBasename && typeof fallbackBasename === 'string') {
    const rawFb = fallbackBasename.trim();
    const cleanFb = rawFb.replace(/^[\\\/]+/, '').replace(/^(\.\.[\/\\]|\.[\/\\])+/, '');
    candidates.push(path.resolve(__dirname, rawFb));
    candidates.push(path.resolve(__dirname, cleanFb));
    candidates.push(path.resolve(__dirname, 'assets', cleanFb));
    candidates.push(path.resolve(__dirname, 'assets', 'images', path.basename(rawFb)));
    candidates.push(path.resolve(__dirname, 'assets', 'uploads', path.basename(rawFb)));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch (e) {
        // ignore file access errors and continue searching candidates
      }
    }
  }

  return null;
}

// Helper: Upload file to Cloudinary with retry
async function uploadToCloudinary(localPath, folderName) {
  if (isDryRun) {
    const fileName = path.basename(localPath);
    return {
      secure_url: `https://res.cloudinary.com/${cloudName || 'demo'}/image/upload/${folderName}/${fileName}`,
      public_id: `${folderName}/${fileName}`
    };
  }

  const result = await cloudinary.uploader.upload(localPath, {
    folder: folderName,
    resource_type: 'auto',
    use_filename: true,
    unique_filename: true
  });

  return result;
}

// Helper: Synchronize local fallback data/portfolio-data.json
function updateLocalFallbackData(updaterFn) {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const modified = updaterFn(data);
    if (modified && !isDryRun) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('  [!] Notice: Could not update local portfolio-data.json fallback:', err.message);
  }
}

// Stats tracking
const stats = {
  totalScanned: 0,
  migrated: 0,
  alreadyCloudinary: 0,
  fileNotFound: 0,
  skippedEmpty: 0
};

// Main Migration Logic
async function runMigration() {
  const startTime = Date.now();
  console.log('\n[*] Starting Firestore media inspection and migration...\n');

  // =========================================================================
  // 1. CERTIFICATIONS
  // =========================================================================
  console.log('--- 1. Certifications ---');
  try {
    const certsSnap = await db.collection('certifications').get();
    console.log(`[*] Found ${certsSnap.size} certification document(s).`);

    for (const doc of certsSnap.docs) {
      stats.totalScanned++;
      const data = doc.data();
      const certId = doc.id;
      const title = data.title || certId;
      const currentImage = (data.image || '').trim();

      if (!currentImage) {
        console.log(`  [-] [${certId}] "${title}": No image assigned.`);
        stats.skippedEmpty++;
        continue;
      }

      if (isRemoteUrl(currentImage) && !isPlaceholderUrl(currentImage)) {
        console.log(`  [OK] [${certId}] "${title}": Already hosted remotely (${currentImage.substring(0, 50)}...).`);
        stats.alreadyCloudinary++;
        continue;
      }

      // Needs migration: resolve local file
      const localFile = resolveLocalFile(currentImage);
      if (!localFile) {
        console.warn(`  [!] [${certId}] "${title}": Local file not found on disk for path: "${currentImage}"`);
        stats.fileNotFound++;
        continue;
      }

      console.log(`  [^] [${certId}] Uploading "${path.basename(localFile)}" to Cloudinary (portfolio/certifications)...`);
      try {
        const uploadRes = await uploadToCloudinary(localFile, 'portfolio/certifications');
        const newUrl = uploadRes.secure_url;

        if (!isDryRun) {
          await db.collection('certifications').doc(certId).update({
            image: newUrl,
            updatedAt: FieldValue.serverTimestamp()
          });

          // Sync local data fallback
          updateLocalFallbackData((local) => {
            if (Array.isArray(local.certifications)) {
              const item = local.certifications.find(c => c.id === certId);
              if (item) {
                item.image = newUrl;
                return true;
              }
            }
            return false;
          });
        }

        console.log(`  [SUCCESS] [${certId}] Updated image URL -> ${newUrl}`);
        stats.migrated++;
      } catch (uploadErr) {
        console.error(`  [ERROR] Failed to upload certification "${certId}":`, uploadErr.message);
      }
    }
  } catch (err) {
    console.error('[ERROR] Failed during certifications migration:', err);
  }

  // =========================================================================
  // 2. ACHIEVEMENTS
  // =========================================================================
  console.log('\n--- 2. Achievements ---');
  try {
    const achieveSnap = await db.collection('achievements').get();
    console.log(`[*] Found ${achieveSnap.size} achievement document(s).`);

    for (const doc of achieveSnap.docs) {
      stats.totalScanned++;
      const data = doc.data();
      const achieveId = doc.id;
      const title = data.title || achieveId;
      const currentImage = (data.image || '').trim();

      if (!currentImage) {
        console.log(`  [-] [${achieveId}] "${title}": No image assigned.`);
        stats.skippedEmpty++;
        continue;
      }

      if (isRemoteUrl(currentImage) && !isPlaceholderUrl(currentImage)) {
        console.log(`  [OK] [${achieveId}] "${title}": Already hosted remotely (${currentImage.substring(0, 50)}...).`);
        stats.alreadyCloudinary++;
        continue;
      }

      const localFile = resolveLocalFile(currentImage);
      if (!localFile) {
        console.warn(`  [!] [${achieveId}] "${title}": Local file not found on disk for path: "${currentImage}"`);
        stats.fileNotFound++;
        continue;
      }

      console.log(`  [^] [${achieveId}] Uploading "${path.basename(localFile)}" to Cloudinary (portfolio/achievements)...`);
      try {
        const uploadRes = await uploadToCloudinary(localFile, 'portfolio/achievements');
        const newUrl = uploadRes.secure_url;

        if (!isDryRun) {
          await db.collection('achievements').doc(achieveId).update({
            image: newUrl,
            updatedAt: FieldValue.serverTimestamp()
          });

          updateLocalFallbackData((local) => {
            if (Array.isArray(local.achievements)) {
              const item = local.achievements.find(a => a.id === achieveId);
              if (item) {
                item.image = newUrl;
                return true;
              }
            }
            return false;
          });
        }

        console.log(`  [SUCCESS] [${achieveId}] Updated image URL -> ${newUrl}`);
        stats.migrated++;
      } catch (uploadErr) {
        console.error(`  [ERROR] Failed to upload achievement "${achieveId}":`, uploadErr.message);
      }
    }
  } catch (err) {
    console.error('[ERROR] Failed during achievements migration:', err);
  }

  // =========================================================================
  // 3. PROJECTS
  // =========================================================================
  console.log('\n--- 3. Projects ---');
  try {
    const projectsSnap = await db.collection('projects').get();
    console.log(`[*] Found ${projectsSnap.size} project document(s).`);

    for (const doc of projectsSnap.docs) {
      stats.totalScanned++;
      const data = doc.data();
      const projId = doc.id;
      const title = data.title || projId;
      const currentImage = (data.image || data.fileUrl || '').trim();

      if (!currentImage) {
        console.log(`  [-] [${projId}] "${title}": No image/file assigned.`);
        stats.skippedEmpty++;
        continue;
      }

      if (isRemoteUrl(currentImage) && !isPlaceholderUrl(currentImage)) {
        console.log(`  [OK] [${projId}] "${title}": Already hosted remotely (${currentImage.substring(0, 50)}...).`);
        stats.alreadyCloudinary++;
        continue;
      }

      const localFile = resolveLocalFile(currentImage);
      if (!localFile) {
        console.warn(`  [!] [${projId}] "${title}": Local file not found on disk for path: "${currentImage}"`);
        stats.fileNotFound++;
        continue;
      }

      console.log(`  [^] [${projId}] Uploading "${path.basename(localFile)}" to Cloudinary (portfolio/projects)...`);
      try {
        const uploadRes = await uploadToCloudinary(localFile, 'portfolio/projects');
        const newUrl = uploadRes.secure_url;

        if (!isDryRun) {
          const updatePayload = {
            image: newUrl,
            updatedAt: FieldValue.serverTimestamp()
          };
          if (data.fileUrl) {
            updatePayload.fileUrl = newUrl;
          }

          await db.collection('projects').doc(projId).update(updatePayload);

          updateLocalFallbackData((local) => {
            if (Array.isArray(local.projects)) {
              const item = local.projects.find(p => p.id === projId);
              if (item) {
                item.image = newUrl;
                if (item.fileUrl) item.fileUrl = newUrl;
                return true;
              }
            }
            return false;
          });
        }

        console.log(`  [SUCCESS] [${projId}] Updated project URL -> ${newUrl}`);
        stats.migrated++;
      } catch (uploadErr) {
        console.error(`  [ERROR] Failed to upload project file "${projId}":`, uploadErr.message);
      }
    }
  } catch (err) {
    console.error('[ERROR] Failed during projects migration:', err);
  }

  // =========================================================================
  // 4. CV & SITE CONTENT
  // =========================================================================
  console.log('\n--- 4. CV Document (content/cv) ---');
  try {
    stats.totalScanned++;
    const cvDocRef = db.collection('content').doc('cv');
    const cvSnap = await cvDocRef.get();
    const cvData = cvSnap.exists ? cvSnap.data() : null;

    const currentCvUrl = (cvData && cvData.url ? cvData.url : '').trim();
    const cvFilename = (cvData && cvData.filename ? cvData.filename : 'MudassirShahCV.pdf').trim();

    // Check if CV is already hosted on Cloudinary (and not a dummy/test URL)
    if (currentCvUrl && isRemoteUrl(currentCvUrl) && !isPlaceholderUrl(currentCvUrl)) {
      console.log(`  [OK] CV is already hosted on Cloudinary (${currentCvUrl.substring(0, 60)}...).`);
      stats.alreadyCloudinary++;
    } else {
      // Find physical CV file
      const localCv = resolveLocalFile(currentCvUrl, cvFilename) || resolveLocalFile('MudassirShahCV.pdf');
      if (!localCv) {
        console.warn(`  [!] CV physical file not found on disk (searched "${cvFilename}" and "MudassirShahCV.pdf").`);
        stats.fileNotFound++;
      } else {
        console.log(`  [^] Found local CV file: "${localCv}". Uploading to Cloudinary (portfolio/cvs)...`);
        try {
          const uploadRes = await uploadToCloudinary(localCv, 'portfolio/cvs');
          const newUrl = uploadRes.secure_url;
          const fileName = path.basename(localCv);
          const fileSize = fs.statSync(localCv).size;

          if (!isDryRun) {
            const cvUpdate = {
              url: newUrl,
              filename: fileName,
              size: fileSize,
              mimetype: 'application/pdf',
              updatedAt: FieldValue.serverTimestamp()
            };
            await cvDocRef.set(cvUpdate, { merge: true });

            updateLocalFallbackData((local) => {
              local.cv = {
                url: newUrl,
                filename: fileName,
                size: fileSize,
                mimetype: 'application/pdf',
                updatedAt: new Date().toISOString()
              };
              return true;
            });
          }

          console.log(`  [SUCCESS] Updated CV document URL -> ${newUrl}`);
          stats.migrated++;
        } catch (uploadErr) {
          console.error('  [ERROR] Failed to upload CV:', uploadErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[ERROR] Failed during CV migration:', err);
  }

  // =========================================================================
  // 5. SITE TEXT (content/siteText)
  // =========================================================================
  console.log('\n--- 5. Site Text Assets (content/siteText) ---');
  try {
    stats.totalScanned++;
    const siteTextRef = db.collection('content').doc('siteText');
    const siteSnap = await siteTextRef.get();

    if (!siteSnap.exists) {
      console.log('  [-] siteText document does not exist in Firestore.');
    } else {
      const siteData = siteSnap.data();
      let hasUpdates = false;

      // Recursive scan helper for local media paths in nested siteText fields
      async function scanAndMigrateObject(obj, currentPath = '') {
        for (const [key, value] of Object.entries(obj)) {
          const propPath = currentPath ? `${currentPath}.${key}` : key;
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            await scanAndMigrateObject(value, propPath);
          } else if (typeof value === 'string' && value.trim()) {
            const val = value.trim();
            // Check if string points to local image asset (e.g. assets/images/... or ends with image extension)
            if (!isRemoteUrl(val) && (val.includes('assets/') || /\.(jpe?g|png|webp|gif|svg)$/i.test(val))) {
              const localMedia = resolveLocalFile(val);
              if (localMedia) {
                console.log(`  [^] Found siteText asset at "${propPath}": ${localMedia}. Uploading...`);
                try {
                  const uploadRes = await uploadToCloudinary(localMedia, 'portfolio/site');
                  obj[key] = uploadRes.secure_url;
                  hasUpdates = true;
                  stats.migrated++;
                  console.log(`  [SUCCESS] Updated siteText "${propPath}" -> ${uploadRes.secure_url}`);
                } catch (e) {
                  console.error(`  [ERROR] Failed uploading site asset at "${propPath}":`, e.message);
                }
              }
            }
          }
        }
      }

      await scanAndMigrateObject(siteData);

      if (hasUpdates && !isDryRun) {
        await siteTextRef.set(siteData, { merge: true });
        updateLocalFallbackData((local) => {
          local.siteText = siteData;
          return true;
        });
        console.log('  [SUCCESS] Saved updated siteText back to Firestore and local fallback.');
      } else if (!hasUpdates) {
        console.log('  [OK] No legacy local file paths found in siteText.');
      }
    }
  } catch (err) {
    console.error('[ERROR] Failed during siteText inspection:', err);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(75));
  console.log('  MIGRATION SUMMARY');
  console.log('='.repeat(75));
  console.log(`  Total documents/fields evaluated : ${stats.totalScanned}`);
  console.log(`  Successfully migrated            : ${stats.migrated}`);
  console.log(`  Already hosted on Cloudinary     : ${stats.alreadyCloudinary}`);
  console.log(`  Local files not found on disk    : ${stats.fileNotFound}`);
  console.log(`  Empty fields (no image/file)     : ${stats.skippedEmpty}`);
  console.log(`  Execution time                   : ${durationSec} seconds`);
  console.log('='.repeat(75));

  if (isDryRun) {
    console.log('\n[!] Dry run finished. No changes were made.');
    console.log('To execute the real migration, run:');
    console.log('  node migrate-to-cloudinary.js\n');
  } else {
    console.log('\n[DONE] Cloudinary migration completed successfully!\n');
  }
}

// Execute migration
runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n[FATAL] Migration script terminated with an error:', err);
    process.exit(1);
  });
