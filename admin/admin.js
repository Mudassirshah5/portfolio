// Admin Panel JavaScript — Fully restructured for Certifications, Blog, CV, Projects, Skills & Site Text
const PRODUCTION_API_URL = 'https://your-future-render-url.onrender.com';
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.protocol === 'file:';
const API_BASE_URL = isLocal ? 'http://localhost:3000' : (window.location.origin.includes('github.io') ? PRODUCTION_API_URL : '');

// Helper to resolve asset URLs (supports Cloudinary, absolute URLs, and local fallbacks)
function resolveAssetUrl(src) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  const clean = src.replace(/^\//, '');
  if (clean.startsWith('assets/uploads/')) {
    return `${API_BASE_URL}/${clean}`;
  }
  return '/' + clean;
}

let currentData = {
  siteText: {},
  certifications: [],
  blogs: [],
  projects: [],
  skills: [],
  cv: null
};

let deleteTarget = {
  type: null, // 'cert', 'blog', 'project', 'skill'
  id: null,
  title: ''
};

let activeProjectCategory = 'all';
let activeSkillCategory = 'all';

// ── Initialization ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupUploads();
  setupSubtabs();
  setupForms();
  
  await checkAuthAndLoad();
});

// ── Check Auth & Fetch Data ─────────────────────────────────
async function checkAuthAndLoad() {
  try {
    const authRes = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' });
    if (!authRes.ok) {
      window.location.href = 'login.html';
      return;
    }
    const authData = await authRes.json();
    setAdminUserInfo(authData.email);

    // Fetch site content
    await loadContent();
  } catch (err) {
    console.error('Auth verification error:', err);
    window.location.href = 'login.html';
  }
}

function setAdminUserInfo(email) {
  const sidebarEmail = document.getElementById('sidebarEmail');
  const userInitial = document.getElementById('userInitial');
  const setAdminEmail = document.getElementById('setAdminEmail');

  if (email) {
    if (sidebarEmail) sidebarEmail.textContent = email;
    if (userInitial) userInitial.textContent = email.charAt(0).toUpperCase();
    if (setAdminEmail) setAdminEmail.value = email;
  }
}

async function loadContent() {
  try {
    let data = null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/content`, { credentials: 'include' });
      if (res.ok) {
        data = await res.json();
        console.log('[Admin Content Loaded from API]', data);
      } else {
        console.warn(`[Admin Content] API returned status ${res.status}`);
      }
    } catch (fetchErr) {
      console.warn('[Admin Content] Remote API fetch failed:', fetchErr.message);
    }

    // Graceful fallback to local JSON file if backend was offline/sleeping
    if (!data || (!data.projects && !data.skills)) {
      try {
        console.log('[Admin Content] Attempting fallback to ../data/portfolio-data.json...');
        const localRes = await fetch('../data/portfolio-data.json');
        if (localRes.ok) {
          data = await localRes.json();
          console.log('[Admin Content Loaded from Fallback JSON]', data);
        }
      } catch (localErr) {
        console.warn('[Admin Content] Fallback JSON fetch failed:', localErr.message);
      }
    }

    if (!data) throw new Error('Failed to load portfolio content');

    currentData = {
      siteText: data.siteText || {},
      certifications: Array.isArray(data.certifications) ? data.certifications : [],
      blogs: Array.isArray(data.blogs) ? data.blogs : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
      skills: Array.isArray(data.skills) ? data.skills : [],
      cv: data.cv || null
    };

    console.log(`[Admin Hydrated] Certs: ${currentData.certifications.length}, Blogs: ${currentData.blogs.length}, Projects: ${currentData.projects.length}, Skills: ${currentData.skills.length}`);

    renderDashboard();
    renderCertifications();
    renderBlog();
    renderCv();
    renderProjects();
    renderSkills();
    populateSiteTextForm();
  } catch (err) {
    console.error('[Admin loadContent Error]', err);
    showToast(err.message, 'error');
  }
}

// ── Navigation & Views ──────────────────────────────────────
function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchView(view);
    });
  });

  // Mobile menu toggle
  const toggleBtn = document.getElementById('btnToggleSidebar');
  const sidebar = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 900 && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Logout button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        window.location.href = 'login.html';
      } catch (err) {
        window.location.href = 'login.html';
      }
    });
  }
}

function switchView(viewName) {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`view-${viewName}`);
  if (targetSec) targetSec.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    certifications: 'Certifications Manager',
    blog: 'Blog Manager',
    cv: 'CV & Resume Manager',
    projects: 'Projects Manager',
    skills: 'Skills Manager',
    sitetext: 'Site Text Editor',
    settings: 'Settings & Security'
  };
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = titles[viewName] || 'Dashboard';

  if (window.innerWidth <= 900) {
    document.getElementById('sidebar')?.classList.remove('open');
  }
}

// ── Subtabs for Site Text ───────────────────────────────────
function setupSubtabs() {
  const subtabBtns = document.querySelectorAll('.subtab-btn');
  subtabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = btn.getAttribute('data-subtab');
      
      subtabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(`subtab-${target}`);
      if (activePane) activePane.classList.add('active');
    });
  });
}

// ── Render Dashboard ────────────────────────────────────────
function renderDashboard() {
  const certCount = currentData.certifications?.length || 0;
  const blogCount = currentData.blogs?.length || 0;
  const projCount = currentData.projects?.length || 0;
  const skillCount = currentData.skills?.length || 0;

  const elCert = document.getElementById('dashCertCount');
  const elBlog = document.getElementById('dashBlogCount');
  const elProj = document.getElementById('dashProjCount');
  const elSkill = document.getElementById('dashSkillCount');
  const elCv = document.getElementById('dashCvStatus');

  if (elCert) elCert.textContent = certCount;
  if (elBlog) elBlog.textContent = blogCount;
  if (elProj) elProj.textContent = projCount;
  if (elSkill) elSkill.textContent = skillCount;
  if (elCv) elCv.textContent = currentData.cv?.url ? 'Active & Hosted' : 'Not Set';

  // Snapshot: Recent Certifications
  const snapCerts = document.getElementById('dashboardRecentCerts');
  if (snapCerts) {
    if (certCount === 0) {
      snapCerts.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">No certifications added yet.</div>';
    } else {
      const recent = currentData.certifications.slice(0, 3);
      snapCerts.innerHTML = recent.map(cert => `
        <div style="background: rgba(15,23,42,0.6); padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border);">
          <div style="font-weight:600;font-size:0.9rem;color:var(--text-main);">${escapeHtml(cert.title)}</div>
          <div style="font-size:0.78rem;color:var(--teal);margin-top:0.2rem;">${escapeHtml(cert.issuer)} · ${escapeHtml(cert.date || '')}</div>
        </div>
      `).join('');
    }
  }

  // Snapshot: Recent Blog Posts
  const snapBlogs = document.getElementById('dashboardRecentBlogs');
  if (snapBlogs) {
    if (blogCount === 0) {
      snapBlogs.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">No blog posts published yet.</div>';
    } else {
      const recent = currentData.blogs.slice(0, 3);
      snapBlogs.innerHTML = recent.map(b => `
        <div style="background: rgba(15,23,42,0.6); padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border);">
          <div style="font-weight:600;font-size:0.9rem;color:var(--text-main);">${escapeHtml(b.title)}</div>
          <div style="font-size:0.78rem;color:var(--warning);margin-top:0.2rem;">${escapeHtml(b.category || 'General')} · ${escapeHtml(b.date || '')}</div>
        </div>
      `).join('');
    }
  }
}

// ── Render Certifications ───────────────────────────────────
function renderCertifications() {
  const grid = document.getElementById('certificationsGrid');
  if (!grid) return;

  const certs = currentData.certifications || [];
  if (certs.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
        <i class="fas fa-certificate" style="font-size: 3rem; color: var(--text-dim); margin-bottom: 1rem;"></i>
        <h3>No Certifications Yet</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Click "Add Certification" to publish your first credential.</p>
        <button class="btn btn-primary" onclick="openCertModal('add')"><i class="fas fa-plus"></i> Add Certification</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = certs.map(cert => {
    const isPdf = cert.image && cert.image.toLowerCase().endsWith('.pdf');
    return `
      <div class="card item-card">
        <div class="item-img-wrap">
          ${cert.image ? (
            isPdf ? `
              <div style="text-align:center;padding:1rem;color:#fca5a5;">
                <i class="fas fa-file-pdf" style="font-size:2.5rem;margin-bottom:0.5rem;display:block;"></i>
                <span style="font-size:0.8rem;font-weight:600;">PDF Document</span>
              </div>
            ` : `<img src="${resolveAssetUrl(cert.image)}" alt="${escapeHtml(cert.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>
                 <i class="fas fa-certificate item-fallback-icon" style="display:none;"></i>`
          ) : `<i class="fas fa-certificate item-fallback-icon"></i>`}
          ${cert.date ? `<span class="item-badge-pill"><i class="far fa-calendar"></i> ${escapeHtml(cert.date)}</span>` : ''}
        </div>
        <div class="item-title">${escapeHtml(cert.title)}</div>
        <div class="item-meta">
          <i class="fas fa-award"></i>
          <span>${escapeHtml(cert.issuer)}</span>
        </div>
        <div class="item-desc">${escapeHtml(cert.description || 'No description provided.')}</div>
        
        <div class="item-actions">
          <div class="item-actions-left">
            <button class="btn btn-sm btn-outline" onclick="openCertModal('edit', '${cert.id}')">
              <i class="fas fa-pen"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline text-danger" onclick="promptDelete('cert', '${cert.id}', '${escapeHtml(cert.title)}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          ${cert.image ? `
            <a href="${resolveAssetUrl(cert.image)}" target="_blank" class="btn btn-sm btn-outline" title="View Document / Image">
              <i class="fas fa-arrow-up-right-from-square"></i>
            </a>
          ` : ''}
          ${cert.verificationLink ? `
            <a href="${escapeHtml(cert.verificationLink)}" target="_blank" class="btn btn-sm btn-outline" title="Verify Online">
              <i class="fas fa-shield-halved"></i>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Render Blog ─────────────────────────────────────────────
function renderBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  const blogs = currentData.blogs || [];
  if (blogs.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
        <i class="fas fa-newspaper" style="font-size: 3rem; color: var(--text-dim); margin-bottom: 1rem;"></i>
        <h3>No Blog Posts Yet</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Click "Write Blog Post" to publish articles on startup building and strategy.</p>
        <button class="btn btn-primary" onclick="openBlogModal('add')"><i class="fas fa-pen-nib"></i> Write Blog Post</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = blogs.map(item => `
    <div class="card item-card">
      ${item.image ? `
        <div class="item-img-wrap">
          <img src="${resolveAssetUrl(item.image)}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none';"/>
          <span class="item-badge-pill">${escapeHtml(item.category || 'Article')}</span>
        </div>
      ` : `
        <div class="item-img-wrap" style="aspect-ratio: 16/7;">
          <i class="fas fa-newspaper item-fallback-icon"></i>
          <span class="item-badge-pill">${escapeHtml(item.category || 'Article')}</span>
        </div>
      `}
      <div class="item-title">${escapeHtml(item.title)}</div>
      <div class="item-meta">
        <i class="far fa-calendar"></i>
        <span>${escapeHtml(item.date || '')}</span>
        ${item.readTime ? `<span>· <i class="far fa-clock"></i> ${escapeHtml(item.readTime)}</span>` : ''}
      </div>
      <div class="item-desc">${escapeHtml(item.excerpt || (item.content ? item.content.slice(0, 110) + '...' : ''))}</div>
      
      ${item.tags && item.tags.length > 0 ? `
        <div class="admin-tags-wrap">
          ${item.tags.map(t => `<span class="admin-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="item-actions">
        <div class="item-actions-left">
          <button class="btn btn-sm btn-outline" onclick="openBlogModal('edit', '${item.id}')">
            <i class="fas fa-pen"></i> Edit
          </button>
          <button class="btn btn-sm btn-outline text-danger" onclick="promptDelete('blog', '${item.id}', '${escapeHtml(item.title)}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <a href="../blog.html" target="_blank" class="btn btn-sm btn-outline" title="View on Public Blog Page">
          <i class="fas fa-book-open"></i> Read
        </a>
      </div>
    </div>
  `).join('');
}

// ── Render CV ───────────────────────────────────────────────
function renderCv() {
  const cv = currentData.cv || {};
  const metaFilename = document.getElementById('cvMetaFilename');
  const metaSize = document.getElementById('cvMetaSize');
  const metaUpdated = document.getElementById('cvMetaUpdated');
  const metaMime = document.getElementById('cvMetaMimetype');
  const previewLink = document.getElementById('cvPreviewLink');
  const downloadLink = document.getElementById('cvDownloadLink');
  const directUrlInput = document.getElementById('cvDirectUrl');
  const filenameInput = document.getElementById('cvFilenameInput');

  const fileUrl = cv.url || '';
  const cleanUrl = resolveAssetUrl(fileUrl);

  if (metaFilename) metaFilename.textContent = cv.filename || 'MudassirShahCV.pdf';
  if (metaSize) metaSize.textContent = cv.size ? `${(cv.size / 1024).toFixed(1)} KB` : 'Standard';
  if (metaUpdated) {
    if (cv.updatedAt) {
      const d = new Date(cv.updatedAt);
      metaUpdated.textContent = isNaN(d.getTime()) ? cv.updatedAt : d.toLocaleDateString();
    } else {
      metaUpdated.textContent = 'Active';
    }
  }
  if (metaMime) metaMime.textContent = cv.mimetype || 'application/pdf';

  if (previewLink) {
    previewLink.href = cleanUrl || '#';
    previewLink.style.pointerEvents = cleanUrl ? 'auto' : 'none';
    previewLink.style.opacity = cleanUrl ? '1' : '0.5';
  }
  if (downloadLink) {
    downloadLink.href = cleanUrl || '#';
    downloadLink.setAttribute('download', cv.filename || 'MudassirShahCV.pdf');
    downloadLink.style.pointerEvents = cleanUrl ? 'auto' : 'none';
    downloadLink.style.opacity = cleanUrl ? '1' : '0.5';
  }
  if (directUrlInput) directUrlInput.value = fileUrl;
  if (filenameInput) filenameInput.value = cv.filename || 'MudassirShahCV.pdf';
}

// ── Render Projects ─────────────────────────────────────────
function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  const allProjects = currentData.projects || [];
  const filtered = activeProjectCategory === 'all'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toLowerCase() === activeProjectCategory.toLowerCase());

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
        <i class="fas fa-laptop-code" style="font-size: 3rem; color: var(--text-dim); margin-bottom: 1rem;"></i>
        <h3>No Projects Found</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${activeProjectCategory === 'all' ? 'Click "Add Project" to add your first venture or project.' : 'No projects matching this filter category.'}</p>
        <button class="btn btn-primary" onclick="openProjectModal('add')"><i class="fas fa-plus"></i> Add Project</button>
      </div>
    `;
    return;
  }

  const categoryBadgeClassMap = {
    'business & entrepreneurship': 'badge-business',
    'tech & ai': 'badge-tech',
    'economics': 'badge-economics',
    'digital marketing': 'badge-marketing',
    'data analytics': 'badge-analytics'
  };

  grid.innerHTML = filtered.map(item => {
    const cat = item.category || 'Business & Entrepreneurship';
    const badgeClass = categoryBadgeClassMap[cat.toLowerCase()] || 'badge-active';
    const proofUrl = item.proof_url || item.proofUrl;

    return `
      <div class="card item-card">
        ${item.image ? `
          <div class="item-img-wrap">
            <img src="${resolveAssetUrl(item.image)}" alt="${escapeHtml(item.title)}" onerror="this.style.display='none';"/>
            <span class="admin-badge ${badgeClass}" style="position:absolute;top:10px;right:10px;">${escapeHtml(cat)}</span>
          </div>
        ` : `
          <div class="item-img-wrap" style="aspect-ratio: 16/7;">
            <i class="fas fa-laptop-code item-fallback-icon"></i>
            <span class="admin-badge ${badgeClass}" style="position:absolute;top:10px;right:10px;">${escapeHtml(cat)}</span>
          </div>
        `}
        
        <div class="item-title">${escapeHtml(item.title)}</div>
        ${item.subtitle ? `<div style="font-size: 0.8rem; color: var(--teal); margin-bottom: 0.4rem; font-weight: 500;">${escapeHtml(item.subtitle)}</div>` : ''}
        ${item.date ? `<div class="item-meta"><i class="far fa-calendar"></i> <span>${escapeHtml(item.date)}</span></div>` : ''}
        <div class="item-desc">${escapeHtml(item.description || 'No description provided.')}</div>

        ${proofUrl ? `
          <div style="margin: 0.6rem 0;">
            <a href="${resolveAssetUrl(proofUrl)}" target="_blank" class="admin-badge badge-analytics" style="text-decoration:none;font-size:0.75rem;padding:3px 10px;display:inline-flex;" title="View Attached Proof Document">
              <i class="fas fa-file-shield"></i> Proof File Attached
            </a>
          </div>
        ` : ''}

        ${item.tags && (Array.isArray(item.tags) ? item.tags.length > 0 : String(item.tags).trim().length > 0) ? `
          <div class="admin-tags-wrap">
            ${(Array.isArray(item.tags) ? item.tags : String(item.tags).split(',')).map(t => `<span class="admin-tag">${escapeHtml(typeof t === 'string' ? t.trim() : t)}</span>`).join('')}
          </div>
        ` : ''}

        <div class="item-actions">
          <div class="item-actions-left">
            <button class="btn btn-sm btn-outline" onclick="openProjectModal('edit', '${item.id}')">
              <i class="fas fa-pen"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline text-danger" onclick="promptDelete('project', '${item.id}', '${escapeHtml(item.title)}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          ${item.link ? `
            <a href="${escapeHtml(item.link)}" target="_blank" class="btn btn-sm btn-outline" title="Live Project Link">
              <i class="fas fa-external-link-alt"></i>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterAdminProjects(category, btn) {
  activeProjectCategory = category;
  document.querySelectorAll('#view-projects .admin-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderProjects();
}

// ── Render Skills ───────────────────────────────────────────
function renderSkills() {
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;

  const allSkills = currentData.skills || [];
  const filtered = activeSkillCategory === 'all'
    ? allSkills
    : allSkills.filter(s => (s.category || '').toLowerCase().includes(activeSkillCategory.toLowerCase()));

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
        <i class="fas fa-brain" style="font-size: 3rem; color: var(--text-dim); margin-bottom: 1rem;"></i>
        <h3>No Skills Found</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">${activeSkillCategory === 'all' ? 'Click "Add Skill" to define capabilities and tools.' : 'No skills found in this category filter.'}</p>
        <button class="btn btn-primary" onclick="openSkillModal('add')"><i class="fas fa-plus"></i> Add Skill</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(s => {
    const numericLevel = parseInt(s.level || '80', 10) || 80;
    const isIconUrl = s.icon && (s.icon.startsWith('http') || s.icon.startsWith('/'));

    return `
      <div class="card" style="padding: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--teal-light); color: var(--teal); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
              ${isIconUrl ? `<img src="${resolveAssetUrl(s.icon)}" style="width: 24px; height: 24px; object-fit: contain;"/>` : `<i class="${escapeHtml(s.icon || 'fas fa-check')}"></i>`}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(s.name)}</div>
              <div style="font-size: 0.75rem; color: var(--teal);">${escapeHtml(s.category)}</div>
            </div>
          </div>
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${escapeHtml(s.level || '')}</span>
        </div>

        <div class="skill-bar-wrap">
          <div class="skill-level-track">
            <div class="skill-level-fill" style="width: ${numericLevel}%;"></div>
          </div>
        </div>

        ${s.description ? `<p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.6rem 0;">${escapeHtml(s.description)}</p>` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.85rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
          <button class="btn btn-sm btn-outline" onclick="openSkillModal('edit', '${s.id}')">
            <i class="fas fa-pen"></i> Edit
          </button>
          <button class="btn btn-sm btn-outline text-danger" onclick="promptDelete('skill', '${s.id}', '${escapeHtml(s.name)}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterAdminSkills(category, btn) {
  activeSkillCategory = category;
  document.querySelectorAll('#view-skills .admin-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderSkills();
}

// ── Populate Site Text Form ─────────────────────────────────
function populateSiteTextForm() {
  const st = currentData.siteText || {};
  const hero = st.hero || {};
  const about = st.about || {};
  const stats = st.stats || {};
  const contact = st.contact || {};
  const socials = st.socials || {};

  setVal('heroName', hero.name);
  setVal('heroLocation', hero.location);
  setVal('heroBanner', hero.bannerText);
  setVal('heroTyping', Array.isArray(hero.typingWords) ? hero.typingWords.join(', ') : hero.typingWords);
  setVal('heroDesc', hero.description);
  setVal('heroLooking', hero.lookingFor);

  setVal('aboutBio1', about.bio1);
  setVal('aboutBio2', about.bio2);
  setVal('statVentures', stats.ventures);
  setVal('statCerts', stats.certifications);
  setVal('statCgpa', stats.cgpa || about.cgpa);
  setVal('statLanguages', stats.languages);

  setVal('contactEmail', contact.email);
  setVal('contactPhone', contact.phone);
  setVal('contactWhatsapp', contact.whatsapp);
  setVal('contactLocation', contact.location);
  setVal('socialLinkedIn', socials.linkedin);
  setVal('socialFacebook', socials.facebook);
  setVal('socialTwitter', socials.twitter);
  setVal('socialGithub', socials.github);
  setVal('socialInstagram', socials.instagram);
  setVal('socialYoutube', socials.youtube);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}

// ── Certifications Modal ────────────────────────────────────
function openCertModal(mode, certId = null) {
  const modal = document.getElementById('certModalBackdrop');
  const titleEl = document.getElementById('certModalTitle');
  const form = document.getElementById('certForm');
  const preview = document.getElementById('certUploadPreview');

  form.reset();
  preview.innerHTML = '';
  document.getElementById('certImagePath').value = '';

  if (mode === 'edit' && certId) {
    const cert = (currentData.certifications || []).find(c => c.id === certId);
    if (!cert) return;

    titleEl.textContent = 'Edit Certification';
    document.getElementById('certId').value = cert.id;
    document.getElementById('certTitle').value = cert.title || '';
    document.getElementById('certIssuer').value = cert.issuer || '';
    document.getElementById('certDate').value = cert.date || '';
    document.getElementById('certDesc').value = cert.description || '';
    document.getElementById('certVerifyLink').value = cert.verificationLink || '';
    document.getElementById('certImagePath').value = cert.image || '';

    if (cert.image) {
      renderUploadPreview('certUploadPreview', cert.image);
    }
  } else {
    titleEl.textContent = 'Add Certification';
    document.getElementById('certId').value = '';
  }

  modal.classList.add('open');
}

function closeCertModal() {
  document.getElementById('certModalBackdrop').classList.remove('open');
}

// ── Blog Modal ──────────────────────────────────────────────
function openBlogModal(mode, blogId = null) {
  const modal = document.getElementById('blogModalBackdrop');
  const titleEl = document.getElementById('blogModalTitle');
  const form = document.getElementById('blogForm');
  const preview = document.getElementById('blogUploadPreview');

  form.reset();
  preview.innerHTML = '';
  document.getElementById('blogId').value = '';
  document.getElementById('blogImagePath').value = '';

  if (mode === 'edit' && blogId) {
    const blog = (currentData.blogs || []).find(b => b.id === blogId);
    if (!blog) return;

    titleEl.textContent = 'Edit Blog Post';
    document.getElementById('blogId').value = blog.id;
    document.getElementById('blogTitle').value = blog.title || '';
    document.getElementById('blogCategory').value = blog.category || '';
    document.getElementById('blogDate').value = blog.date || '';
    document.getElementById('blogReadTime').value = blog.readTime || '';
    document.getElementById('blogTags').value = Array.isArray(blog.tags) ? blog.tags.join(', ') : (blog.tags || '');
    document.getElementById('blogExcerpt').value = blog.excerpt || '';
    document.getElementById('blogContent').value = blog.content || '';
    document.getElementById('blogImagePath').value = blog.image || '';

    if (blog.image) {
      renderUploadPreview('blogUploadPreview', blog.image);
    }
  } else {
    titleEl.textContent = 'Write Blog Post';
  }

  modal.classList.add('open');
}

function closeBlogModal() {
  document.getElementById('blogModalBackdrop').classList.remove('open');
}

// ── Project Modal ───────────────────────────────────────────
function openProjectModal(mode, projId = null) {
  const modal = document.getElementById('projectModalBackdrop');
  const titleEl = document.getElementById('projectModalTitle');
  const form = document.getElementById('projectForm');
  const preview = document.getElementById('projUploadPreview');
  const proofPreview = document.getElementById('projProofUploadPreview');

  form.reset();
  if (preview) preview.innerHTML = '';
  if (proofPreview) proofPreview.innerHTML = '';
  document.getElementById('projId').value = '';
  document.getElementById('projImagePath').value = '';
  const proofInput = document.getElementById('projProofUrl');
  if (proofInput) proofInput.value = '';

  if (mode === 'edit' && projId) {
    const project = (currentData.projects || []).find(p => p.id === projId);
    if (!project) return;

    titleEl.textContent = 'Edit Project';
    document.getElementById('projId').value = project.id;
    document.getElementById('projTitle').value = project.title || '';
    document.getElementById('projSubtitle').value = project.subtitle || '';
    
    // Set category (defaulting to Business & Entrepreneurship if not matched)
    const catSelect = document.getElementById('projCategory');
    const customGroup = document.getElementById('projCustomCategoryGroup');
    const customInput = document.getElementById('projCustomCategory');
    if (customGroup) customGroup.style.display = 'none';
    if (customInput) customInput.value = '';

    if (catSelect) {
      const projCat = project.category || 'Business & Entrepreneurship';
      let optionExists = false;
      for (let i = 0; i < catSelect.options.length; i++) {
        if (catSelect.options[i].value === projCat) {
          optionExists = true;
          break;
        }
      }
      if (!optionExists && projCat) {
        const opt = document.createElement('option');
        opt.value = projCat;
        opt.textContent = projCat;
        const customOpt = catSelect.querySelector('option[value="__custom__"]');
        if (customOpt) {
          catSelect.insertBefore(opt, customOpt);
        } else {
          catSelect.appendChild(opt);
        }
      }
      catSelect.value = projCat;
    }

    document.getElementById('projDate').value = project.date || '';
    document.getElementById('projLink').value = project.link || '';
    document.getElementById('projTags').value = Array.isArray(project.tags) ? project.tags.join(', ') : (project.tags || '');
    document.getElementById('projDesc').value = project.description || '';
    document.getElementById('projImagePath').value = project.image || '';

    if (project.image) {
      renderUploadPreview('projUploadPreview', project.image);
    }

    const proof = project.proof_url || project.proofUrl || '';
    if (proofInput) proofInput.value = proof;
    if (proof) {
      renderUploadPreview('projProofUploadPreview', proof);
    }
  } else {
    titleEl.textContent = 'Add Project';
    const catSelect = document.getElementById('projCategory');
    const customGroup = document.getElementById('projCustomCategoryGroup');
    const customInput = document.getElementById('projCustomCategory');
    if (customGroup) customGroup.style.display = 'none';
    if (customInput) customInput.value = '';
    if (catSelect) catSelect.value = 'Business & Entrepreneurship';
  }

  modal.classList.add('open');
}

function closeProjectModal() {
  document.getElementById('projectModalBackdrop').classList.remove('open');
}

// ── Skill Modal ─────────────────────────────────────────────
function openSkillModal(mode, skillId = null) {
  const modal = document.getElementById('skillModalBackdrop');
  const titleEl = document.getElementById('skillModalTitle');
  const form = document.getElementById('skillForm');
  const preview = document.getElementById('skillUploadPreview');

  form.reset();
  preview.innerHTML = '';
  document.getElementById('skillId').value = '';
  document.getElementById('skillIconPath').value = '';

  if (mode === 'edit' && skillId) {
    const skill = (currentData.skills || []).find(s => s.id === skillId);
    if (!skill) return;

    titleEl.textContent = 'Edit Skill';
    document.getElementById('skillId').value = skill.id;
    document.getElementById('skillName').value = skill.name || '';
    document.getElementById('skillCategory').value = skill.category || 'Entrepreneurship & Startup Building';
    document.getElementById('skillLevel').value = skill.level || '';
    document.getElementById('skillIcon').value = skill.icon || '';
    document.getElementById('skillDesc').value = skill.description || '';
    document.getElementById('skillIconPath').value = skill.icon || '';

    if (skill.icon && (skill.icon.startsWith('http') || skill.icon.startsWith('/'))) {
      renderUploadPreview('skillUploadPreview', skill.icon);
    }
  } else {
    titleEl.textContent = 'Add Skill';
  }

  modal.classList.add('open');
}

function closeSkillModal() {
  document.getElementById('skillModalBackdrop').classList.remove('open');
}

// ── Delete Confirmation ─────────────────────────────────────
function promptDelete(type, id, title) {
  deleteTarget = { type, id, title };
  const modal = document.getElementById('deleteConfirmBackdrop');
  const msg = document.getElementById('deleteConfirmMessage');
  
  const typeMap = {
    cert: 'certification',
    blog: 'blog post',
    project: 'project',
    skill: 'skill'
  };

  const label = typeMap[type] || 'item';
  msg.innerHTML = `Are you sure you want to permanently delete the ${label} <strong>"${escapeHtml(title)}"</strong>?`;
  modal.classList.add('open');
}

function closeDeleteConfirm() {
  deleteTarget = { type: null, id: null, title: '' };
  document.getElementById('deleteConfirmBackdrop').classList.remove('open');
}

// ── File Uploads Setup ──────────────────────────────────────
function setupUploads() {
  bindDropzone('certFileInput', 'certDropzone', 'certImagePath', 'certUploadPreview', 'certification');
  bindDropzone('blogFileInput', 'blogDropzone', 'blogImagePath', 'blogUploadPreview', 'blog');
  bindDropzone('projFileInput', 'projDropzone', 'projImagePath', 'projUploadPreview', 'project');
  bindDropzone('projProofFileInput', 'projProofDropzone', 'projProofUrl', 'projProofUploadPreview', 'project');
  bindDropzone('skillFileInput', 'skillDropzone', 'skillIconPath', 'skillUploadPreview', 'skill');
  bindDropzone('cvFileInput', 'cvDropzone', 'cvDirectUrl', 'cvUploadPreview', 'cv');
}

function bindDropzone(inputId, dropzoneId, targetInputId, previewId, endpointType) {
  const fileInput = document.getElementById(inputId);
  const dropzone = document.getElementById(dropzoneId);

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFileUpload(fileInput.files[0], targetInputId, previewId, endpointType);
      }
    });
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0], targetInputId, previewId, endpointType);
      }
    });
  }
}

async function handleFileUpload(file, targetInputId, previewContainerId, endpointType = '') {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain'
  ];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'];

  if (!allowedMimes.includes(file.type) && !allowedExts.includes(ext)) {
    showToast('Invalid file format. Please upload JPG, PNG, WEBP, SVG, PDF, Word, or PowerPoint document.', 'error');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('File size exceeds 10MB limit.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const preview = document.getElementById(previewContainerId);
  if (preview) {
    preview.innerHTML = `<span style="color:var(--teal);font-size:0.85rem;"><i class="fas fa-spinner fa-spin"></i> Uploading ${escapeHtml(file.name)} directly to Cloudinary...</span>`;
  }

  try {
    const uploadUrl = endpointType ? `${API_BASE_URL}/api/upload/${endpointType}` : `${API_BASE_URL}/api/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    const targetInput = document.getElementById(targetInputId);
    if (targetInput) targetInput.value = data.url;

    // If CV filename was uploaded, update filename input
    if (endpointType === 'cv') {
      const fnInput = document.getElementById('cvFilenameInput');
      if (fnInput) fnInput.value = file.name;
    }

    renderUploadPreview(previewContainerId, data.url);
    showToast('File uploaded successfully to Cloudinary!', 'success');
  } catch (err) {
    if (preview) preview.innerHTML = '';
    showToast(err.message, 'error');
  }
}

function renderUploadPreview(containerId, url) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  const isDoc = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'].includes(ext) || url.toLowerCase().includes('.pdf') || url.includes('/raw/');
  const cleanUrl = resolveAssetUrl(url);

  if (isDoc) {
    let iconClass = 'fa-file-pdf';
    let docType = 'PDF';
    let badgeBg = 'rgba(239, 68, 68, 0.15)';
    let badgeBorder = 'rgba(239, 68, 68, 0.3)';
    let textColor = '#fca5a5';
    let iconColor = '#ef4444';

    if (['doc', 'docx'].includes(ext)) {
      iconClass = 'fa-file-word';
      docType = 'Word';
      badgeBg = 'rgba(59, 130, 246, 0.15)';
      badgeBorder = 'rgba(59, 130, 246, 0.3)';
      textColor = '#93c5fd';
      iconColor = '#3b82f6';
    } else if (['ppt', 'pptx'].includes(ext)) {
      iconClass = 'fa-file-powerpoint';
      docType = 'Presentation';
      badgeBg = 'rgba(249, 115, 22, 0.15)';
      badgeBorder = 'rgba(249, 115, 22, 0.3)';
      textColor = '#fdba74';
      iconColor = '#f97316';
    } else if (ext === 'txt') {
      iconClass = 'fa-file-lines';
      docType = 'Text';
    }

    container.innerHTML = `
      <div class="pdf-badge" style="background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 8px 12px; border-radius: 8px; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.6rem;">
        <i class="fas ${iconClass}" style="color: ${iconColor}; font-size: 1.2rem;"></i>
        <span style="font-size: 0.8rem; color: ${textColor};">${docType} Document attached: <a href="${cleanUrl}" target="_blank" style="color:#fff;text-decoration:underline;margin-left:4px;">View File</a></span>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="position:relative;display:inline-block;margin-top:0.5rem;">
        <img src="${cleanUrl}" alt="Preview" style="max-height: 120px; border-radius: 8px; border: 1px solid var(--border); display: block;"/>
      </div>
    `;
  }
}

// ── Forms Submission Setup ──────────────────────────────────
function setupForms() {
  // Save Certification Form
  const certForm = document.getElementById('certForm');
  certForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('certId').value;
    const isEdit = Boolean(id);

    const payload = {
      title: document.getElementById('certTitle').value.trim(),
      issuer: document.getElementById('certIssuer').value.trim(),
      date: document.getElementById('certDate').value.trim(),
      description: document.getElementById('certDesc').value.trim(),
      verificationLink: document.getElementById('certVerifyLink').value.trim(),
      image: document.getElementById('certImagePath').value.trim()
    };

    const submitBtn = document.getElementById('btnSaveCert');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const url = isEdit ? `${API_BASE_URL}/api/content/certifications/${encodeURIComponent(id)}` : `${API_BASE_URL}/api/content/certifications`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save certification');

      showToast(isEdit ? 'Certification updated successfully!' : 'Certification added successfully!', 'success');
      closeCertModal();
      await loadContent();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Certification';
    }
  });

  // Save Blog Form
  const blogForm = document.getElementById('blogForm');
  blogForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('blogId').value;
    const isEdit = Boolean(id);

    const payload = {
      title: document.getElementById('blogTitle').value.trim(),
      category: document.getElementById('blogCategory').value.trim() || 'General',
      date: document.getElementById('blogDate').value.trim(),
      readTime: document.getElementById('blogReadTime').value.trim(),
      excerpt: document.getElementById('blogExcerpt').value.trim(),
      content: document.getElementById('blogContent').value.trim(),
      tags: document.getElementById('blogTags').value.trim(),
      image: document.getElementById('blogImagePath').value.trim()
    };

    const submitBtn = document.getElementById('btnSaveBlog');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const url = isEdit ? `${API_BASE_URL}/api/content/blogs/${encodeURIComponent(id)}` : `${API_BASE_URL}/api/content/blogs`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save blog post');

      showToast(isEdit ? 'Blog post updated successfully!' : 'Blog post published successfully!', 'success');
      closeBlogModal();
      await loadContent();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Article';
    }
  });

  // Save CV Form
  const cvForm = document.getElementById('cvUploadForm');
  cvForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileUrl = document.getElementById('cvDirectUrl').value.trim();
    const filename = document.getElementById('cvFilenameInput').value.trim() || 'MudassirShahCV.pdf';

    if (!fileUrl) {
      showToast('Please upload a CV document or provide a direct file URL.', 'error');
      return;
    }

    const btn = document.getElementById('btnSaveCv');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving CV...';

    try {
      const res = await fetch(`${API_BASE_URL}/api/content/cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: fileUrl, filename })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save CV');

      showToast('CV updated successfully and synchronized!', 'success');
      await loadContent();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save &amp; Update Live CV';
    }
  });

  // Project Category Change Listener for New Custom Category
  const projCatSelect = document.getElementById('projCategory');
  const projCustomGroup = document.getElementById('projCustomCategoryGroup');
  const projCustomInput = document.getElementById('projCustomCategory');

  if (projCatSelect) {
    projCatSelect.addEventListener('change', () => {
      if (projCatSelect.value === '__custom__') {
        if (projCustomGroup) projCustomGroup.style.display = 'block';
        if (projCustomInput) {
          projCustomInput.focus();
          projCustomInput.required = true;
        }
      } else {
        if (projCustomGroup) projCustomGroup.style.display = 'none';
        if (projCustomInput) projCustomInput.required = false;
      }
    });
  }

  // Save Project Form
  const projectForm = document.getElementById('projectForm');
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('projId').value;
    const isEdit = Boolean(id);

    let chosenCategory = document.getElementById('projCategory').value.trim();
    if (chosenCategory === '__custom__') {
      const customVal = (document.getElementById('projCustomCategory')?.value || '').trim();
      if (!customVal) {
        showToast('Please type a name for your custom category.', 'error');
        document.getElementById('projCustomCategory')?.focus();
        return;
      }
      chosenCategory = customVal;
    }

    const payload = {
      title: document.getElementById('projTitle').value.trim(),
      subtitle: document.getElementById('projSubtitle').value.trim(),
      category: chosenCategory || 'Business & Entrepreneurship',
      date: document.getElementById('projDate').value.trim(),
      link: document.getElementById('projLink').value.trim(),
      tags: document.getElementById('projTags').value.trim(),
      description: document.getElementById('projDesc').value.trim(),
      image: document.getElementById('projImagePath').value.trim(),
      proof_url: document.getElementById('projProofUrl') ? document.getElementById('projProofUrl').value.trim() : ''
    };

    const submitBtn = document.getElementById('btnSaveProj');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const url = isEdit ? `${API_BASE_URL}/api/content/projects/${encodeURIComponent(id)}` : `${API_BASE_URL}/api/content/projects`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save project');

      showToast(isEdit ? 'Project updated successfully!' : 'Project added successfully!', 'success');
      closeProjectModal();
      await loadContent();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Project';
    }
  });

  // Save Skill Form
  const skillForm = document.getElementById('skillForm');
  skillForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('skillId').value;
    const isEdit = Boolean(id);

    const iconVal = document.getElementById('skillIconPath').value.trim() || document.getElementById('skillIcon').value.trim();

    const payload = {
      name: document.getElementById('skillName').value.trim(),
      category: document.getElementById('skillCategory').value.trim(),
      level: document.getElementById('skillLevel').value.trim(),
      icon: iconVal,
      description: document.getElementById('skillDesc').value.trim()
    };

    const submitBtn = document.getElementById('btnSaveSkill');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const url = isEdit ? `${API_BASE_URL}/api/content/skills/${encodeURIComponent(id)}` : `${API_BASE_URL}/api/content/skills`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save skill');

      showToast(isEdit ? 'Skill updated successfully!' : 'Skill added successfully!', 'success');
      closeSkillModal();
      await loadContent();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Skill';
    }
  });

  // Confirm Delete Action
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');
  btnConfirmDelete.addEventListener('click', async () => {
    if (!deleteTarget.type || !deleteTarget.id) return;

    btnConfirmDelete.disabled = true;
    btnConfirmDelete.textContent = 'Deleting...';

    try {
      const endpointMap = {
        cert: 'certifications',
        blog: 'blogs',
        project: 'projects',
        skill: 'skills'
      };

      const routeName = endpointMap[deleteTarget.type];
      if (!routeName) throw new Error('Unknown deletion target');

      const endpoint = `${API_BASE_URL}/api/content/${routeName}/${encodeURIComponent(deleteTarget.id)}`;
      const res = await fetch(endpoint, { 
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      showToast('Item deleted successfully from Firestore.', 'success');
      closeDeleteConfirm();
      await loadContent();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnConfirmDelete.disabled = false;
      btnConfirmDelete.textContent = 'Delete Permanently';
    }
  });

  // Save All Site Text Button
  const btnSaveSiteText = document.getElementById('btnSaveAllSiteText');
  btnSaveSiteText.addEventListener('click', async (e) => {
    e.preventDefault();

    const typingRaw = document.getElementById('heroTyping').value;
    const typingWords = typingRaw
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    const siteTextPayload = {
      hero: {
        name: document.getElementById('heroName').value.trim(),
        location: document.getElementById('heroLocation').value.trim(),
        bannerText: document.getElementById('heroBanner').value.trim(),
        typingWords: typingWords.length > 0 ? typingWords : ['Entrepreneur', 'Economics Student'],
        description: document.getElementById('heroDesc').value.trim(),
        lookingFor: document.getElementById('heroLooking').value.trim()
      },
      about: {
        bio1: document.getElementById('aboutBio1').value.trim(),
        bio2: document.getElementById('aboutBio2').value.trim(),
        cgpa: document.getElementById('statCgpa').value.trim()
      },
      stats: {
        ventures: document.getElementById('statVentures').value.trim(),
        certifications: document.getElementById('statCerts').value.trim(),
        cgpa: document.getElementById('statCgpa').value.trim(),
        languages: document.getElementById('statLanguages').value.trim()
      },
      contact: {
        email: document.getElementById('contactEmail').value.trim(),
        phone: document.getElementById('contactPhone').value.trim(),
        whatsapp: document.getElementById('contactWhatsapp').value.trim(),
        location: document.getElementById('contactLocation').value.trim()
      },
      socials: {
        linkedin: document.getElementById('socialLinkedIn').value.trim(),
        facebook: document.getElementById('socialFacebook').value.trim(),
        twitter: document.getElementById('socialTwitter').value.trim(),
        github: document.getElementById('socialGithub').value.trim(),
        instagram: document.getElementById('socialInstagram').value.trim(),
        youtube: document.getElementById('socialYoutube').value.trim()
      }
    };

    btnSaveSiteText.disabled = true;
    btnSaveSiteText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const res = await fetch(`${API_BASE_URL}/api/content/site-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteText: siteTextPayload })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save site text');

      showToast('All site text saved and updated on live site!', 'success');
      await loadContent();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSaveSiteText.disabled = false;
      btnSaveSiteText.innerHTML = '<i class="fas fa-floppy-disk"></i> Save All Site Text';
    }
  });

  // Settings / Change Password Form
  const settingsForm = document.getElementById('settingsForm');
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('setCurrentPassword').value;
    const newPassword = document.getElementById('setNewPassword').value;
    const confirmPassword = document.getElementById('setConfirmPassword').value;
    const newEmail = document.getElementById('setAdminEmail').value.trim();

    if (!currentPassword) {
      showToast('Current password is required to update credentials.', 'error');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      showToast('New password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    const btn = document.getElementById('btnSaveSettings');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword || undefined,
          newEmail: newEmail || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update credentials');

      showToast('Admin credentials updated successfully!', 'success');
      document.getElementById('setCurrentPassword').value = '';
      document.getElementById('setNewPassword').value = '';
      document.getElementById('setConfirmPassword').value = '';
      setAdminUserInfo(data.email);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-shield-halved"></i> Update Credentials';
    }
  });
}

// ── Toast Utility ───────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
  toast.innerHTML = `
    <i class="fas ${iconClass}"></i>
    <div style="flex:1;">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── HTML Escape Helper ──────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
