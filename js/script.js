// ============================================================================
// Muhammad Mudassir Shah — Portfolio Main Frontend JavaScript
// Fully modularized, error-proofed, with automatic production API routing
// ============================================================================

// ── 1. Dynamic API Base URL Configuration ──────────────────────────────────
// ============================================================================
// 👇 [RENDER URL CONFIGURATION] 👇
// PASTE YOUR LIVE RENDER BACKEND URL HERE ONCE DEPLOYED:
// Replace 'https://your-future-render-url.onrender.com' with your actual Render service URL.
// When running locally, it automatically falls back to http://localhost:3000.
// ============================================================================
const PRODUCTION_API_URL = 'https://portfolio-7qpk.onrender.com';

const isLocalEnvironment = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:'
);

window.API_BASE_URL = isLocalEnvironment ? 'http://localhost:3000' : PRODUCTION_API_URL;
const API_BASE_URL = window.API_BASE_URL;

console.log(`[API Config] Active API_BASE_URL: "${API_BASE_URL}" (Local: ${isLocalEnvironment})`);

// ── 2. Asset URL Resolver (Cloudinary & Local Fallback) ─────────────────────
function resolveAssetUrl(src) {
  if (!src || typeof src !== 'string') return '';
  const trimmed = src.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const clean = trimmed.replace(/^\/+/, '');
  if (clean.startsWith('assets/uploads/')) {
    return `${API_BASE_URL}/${clean}`;
  }
  return clean.startsWith('assets/') ? clean : `assets/${clean}`;
}

// Global typing texts reference
let typingTexts = ['Entrepreneur', 'Economics Student', 'Visionary', 'Strategist', 'Business Builder'];

// ── 3. DOM Ready Initialization ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // A. Core UI initializations run immediately and synchronously
  initLoader();
  initThemeToggle();
  initMobileMenu();
  initSmoothScroll();
  initTypingEffect();
  initScrollAnimations();
  initCertModal();
  initNavbarShadow();

  // B. Load dynamic portfolio content from backend (with local fallback)
  loadDynamicContent();
});

// ── 4. Core UI Helpers (Decoupled & Crash-Resistant) ─────────────────────────

// Loading Screen
function initLoader() {
  try {
    const loader = document.getElementById('loader');
    if (!loader) return;
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        if (loader.parentNode) loader.remove();
      }, 400);
    }, 1000);
  } catch (err) {
    console.warn('[initLoader Warning]', err);
  }
}

// Dark / Light Theme Toggle
function initThemeToggle() {
  try {
    const html = document.documentElement;
    const toggle = document.getElementById('darkToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-theme', savedTheme);

    if (toggle) {
      toggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
    }
  } catch (err) {
    console.warn('[initThemeToggle Warning]', err);
  }
}

// Mobile Hamburger Menu
function initMobileMenu() {
  try {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      }
    });
  } catch (err) {
    console.warn('[initMobileMenu Warning]', err);
  }
}

// Header Navigation & Smooth Scroll for in-page anchors
function initSmoothScroll() {
  try {
    document.querySelectorAll('a[href*="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href) return;
        const hashIdx = href.indexOf('#');
        if (hashIdx === -1) return;
        const targetId = href.substring(hashIdx + 1);
        if (!targetId) return;

        // Check if the link points to a section on the current page
        const pathPart = href.substring(0, hashIdx).replace(/\/$/, '');
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const isCurrentPage = !pathPart || pathPart === currentPath || (pathPart === 'index.html' && (currentPath === '' || currentPath === 'index.html'));

        if (isCurrentPage) {
          const targetElem = document.getElementById(targetId);
          if (targetElem) {
            e.preventDefault();
            targetElem.scrollIntoView({ behavior: 'smooth' });
            history.pushState(null, null, `#${targetId}`);

            const hamburger = document.getElementById('hamburger');
            const mobileMenu = document.getElementById('mobileMenu');
            if (hamburger) hamburger.classList.remove('open');
            if (mobileMenu) mobileMenu.classList.remove('open');
          }
        }
      });
    });
  } catch (err) {
    console.warn('[initSmoothScroll Warning]', err);
  }
}

// Scroll Fade-Up Animations
let globalScrollObserver = null;
function initScrollAnimations() {
  try {
    globalScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 60);
          globalScrollObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    observeFadeUps();
  } catch (err) {
    console.warn('[initScrollAnimations Warning]', err);
  }
}

function observeFadeUps() {
  if (!globalScrollObserver) return;
  document.querySelectorAll('.fade-up:not(.visible)').forEach(el => {
    globalScrollObserver.observe(el);
  });
}

// Hero Typing Effect
function initTypingEffect() {
  try {
    const typingEl = document.getElementById('typingText');
    if (!typingEl) return;

    let wordIdx = 0, charIdx = 0, deleting = false;
    const speed = 80, deleteSpeed = 45, pause = 1800;

    function type() {
      if (!typingTexts || typingTexts.length === 0) return;
      const current = typingTexts[wordIdx % typingTexts.length];
      if (!deleting) {
        typingEl.textContent = current.slice(0, charIdx + 1);
        charIdx++;
        if (charIdx === current.length) {
          deleting = true;
          setTimeout(type, pause);
          return;
        }
      } else {
        typingEl.textContent = current.slice(0, charIdx - 1);
        charIdx--;
        if (charIdx === 0) {
          deleting = false;
          wordIdx = (wordIdx + 1) % typingTexts.length;
        }
      }
      setTimeout(type, deleting ? deleteSpeed : speed);
    }
    type();
  } catch (err) {
    console.warn('[initTypingEffect Warning]', err);
  }
}

// Navbar Shadow on Scroll
function initNavbarShadow() {
  try {
    const nav = document.querySelector('nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.style.boxShadow = window.scrollY > 20 ? '0 2px 20px rgba(0,0,0,0.12)' : 'none';
    }, { passive: true });
  } catch (err) {
    console.warn('[initNavbarShadow Warning]', err);
  }
}

// Certificate Image Modal Setup
function initCertModal() {
  try {
    const modal = document.getElementById('certModal');
    const modalImg = document.getElementById('certModalImg');
    const modalClose = document.getElementById('certModalClose');

    if (modalClose && modal) {
      modalClose.addEventListener('click', () => modal.classList.remove('open'));
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }

    bindCertCards();
  } catch (err) {
    console.warn('[initCertModal Warning]', err);
  }
}

function bindCertCards() {
  const modal = document.getElementById('certModal');
  const modalImg = document.getElementById('certModalImg');

  document.querySelectorAll('.cert-card[data-src]').forEach(card => {
    card.onclick = () => {
      const rawSrc = card.getAttribute('data-src');
      if (!rawSrc) return;
      const src = resolveAssetUrl(rawSrc);
      if (src.toLowerCase().endsWith('.pdf')) {
        window.open(src, '_blank');
      } else if (modal && modalImg) {
        modalImg.src = src;
        modal.classList.add('open');
      }
    };
  });
}

// ── 5. Dynamic Content Hydration (Firestore + JSON Fallback) ─────────────────
async function loadDynamicContent() {
  let data = null;

  // Step 1: Try remote or local API endpoint
  try {
    console.log(`[API Content] Fetching content from: ${API_BASE_URL}/api/content`);
    const res = await fetch(`${API_BASE_URL}/api/content`, {
      credentials: 'include'
    });
    if (res.ok) {
      data = await res.json();
      console.log('[API Content Loaded via Backend API]', data);
    } else {
      console.warn(`[API Content] Backend returned HTTP ${res.status}.`);
    }
  } catch (err) {
    console.warn('[API Content] Remote API fetch failed (standard for GitHub Pages before Render deployment):', err.message);
  }

  // Step 2: Graceful fallback to static data/portfolio-data.json if backend was offline
  if (!data || (!data.projects && !data.skills)) {
    try {
      console.log('[API Content] Attempting fallback to data/portfolio-data.json...');
      const fallbackRes = await fetch('data/portfolio-data.json');
      if (fallbackRes.ok) {
        data = await fallbackRes.json();
        console.log('[API Content Loaded via Fallback JSON]', data);
      }
    } catch (fallbackErr) {
      console.warn('[API Content] Local fallback JSON fetch failed:', fallbackErr.message);
    }
  }

  if (!data) {
    console.warn('[API Content] No content loaded. Static template remains intact.');
    return;
  }

  // Step 3: Hydrate sections with strict defensive checks
  try { hydrateSiteText(data.siteText); } catch (e) { console.error('[Hydrate Error: SiteText]', e); }
  try { hydrateCertifications(data.certifications); } catch (e) { console.error('[Hydrate Error: Certifications]', e); }
  try { hydrateAchievements(data.achievements); } catch (e) { console.error('[Hydrate Error: Achievements]', e); }
  try { hydrateProjects(data.projects); } catch (e) { console.error('[Hydrate Error: Projects]', e); }
  try { hydrateSkills(data.skills); } catch (e) { console.error('[Hydrate Error: Skills]', e); }
  try { hydrateBlogs(data.blogs); } catch (e) { console.error('[Hydrate Error: Blogs]', e); }

  // Step 4: Refresh fade-up observer for newly rendered elements
  observeFadeUps();
}

// ── 6. Section-Specific Hydration Functions ──────────────────────────────────

// A. Hydrate Site Text
function hydrateSiteText(siteText) {
  if (!siteText || typeof siteText !== 'object') return;
  const { hero, about, stats, contact, socials } = siteText;

  // Top Banner
  if (hero?.bannerText) {
    const bannerEl = document.getElementById('topBannerText');
    if (bannerEl) bannerEl.textContent = hero.bannerText;
  }

  // Hero Name & Location
  if (hero?.name) {
    const nameEl = document.getElementById('heroNameHeading');
    if (nameEl) {
      const parts = hero.name.split(' ');
      if (parts.length > 1) {
        const first = parts[0];
        const rest = parts.slice(1).join(' ');
        nameEl.innerHTML = `${escapeHtml(first)}<br><span>${escapeHtml(rest)}</span>`;
      } else {
        nameEl.textContent = hero.name;
      }
    }
  }
  if (hero?.location) {
    const locEl = document.getElementById('heroLocationText');
    if (locEl) locEl.textContent = hero.location;
  }
  if (hero?.description) {
    const descEl = document.getElementById('heroDescText');
    if (descEl) descEl.textContent = hero.description;
  }
  if (hero?.lookingFor) {
    const lookingEl = document.getElementById('heroLookingContent');
    if (lookingEl) lookingEl.textContent = hero.lookingFor;
  }
  if (Array.isArray(hero?.typingWords) && hero.typingWords.length > 0) {
    typingTexts = hero.typingWords;
  }

  // About & Stats
  if (about?.bio1) {
    const p1 = document.getElementById('aboutBioP1');
    if (p1) p1.textContent = about.bio1;
  }
  if (about?.bio2) {
    const p2 = document.getElementById('aboutBioP2');
    if (p2) p2.textContent = about.bio2;
  }
  if (stats?.cgpa || about?.cgpa) {
    const cgpaBadge = document.getElementById('aboutCgpaBadge');
    const cgpaNum = document.getElementById('statCgpaNum');
    if (cgpaBadge) cgpaBadge.textContent = stats?.cgpa || about?.cgpa;
    if (cgpaNum) cgpaNum.textContent = stats?.cgpa || about?.cgpa;
  }
  if (stats?.ventures) {
    const vNum = document.getElementById('statVenturesNum');
    if (vNum) vNum.textContent = stats.ventures;
  }
  if (stats?.certifications) {
    const cNum = document.getElementById('statCertsNum');
    if (cNum) cNum.textContent = stats.certifications;
  }
  if (stats?.languages) {
    const lNum = document.getElementById('statLangNum');
    if (lNum) lNum.textContent = stats.languages;
  }

  // Contact Info
  if (contact?.email) {
    window.portfolioContactEmail = contact.email;
    const emailLink = document.getElementById('contactEmailLink');
    if (emailLink) {
      emailLink.href = `mailto:${contact.email}`;
      emailLink.textContent = contact.email;
    }
  }
  if (contact?.whatsapp) {
    window.portfolioWhatsapp = contact.whatsapp;
    const waLink = document.getElementById('contactWhatsappLink');
    if (waLink) {
      waLink.href = `https://wa.me/${contact.whatsapp}`;
      waLink.textContent = contact.phone || `+${contact.whatsapp}`;
    }
  }

  // Social Links
  if (socials?.linkedin) {
    ['contactSocialLinkedIn', 'footerSocialLinkedIn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = socials.linkedin;
    });
  }
  if (socials?.facebook) {
    ['contactSocialFacebook', 'footerSocialFacebook'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = socials.facebook;
    });
  }
  if (socials?.twitter) {
    ['contactSocialTwitter', 'footerSocialTwitter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = socials.twitter;
    });
  }
  if (contact?.whatsapp) {
    const el = document.getElementById('footerSocialWhatsapp');
    if (el) el.href = `https://wa.me/${contact.whatsapp}`;
  }
}

// B. Hydrate Certifications
function hydrateCertifications(certifications) {
  if (!Array.isArray(certifications) || certifications.length === 0) return;

  const btnHomeCert = document.getElementById('btnHomeCertCount');
  if (btnHomeCert) {
    btnHomeCert.innerHTML = `<i class="fas fa-certificate" style="margin-right: 8px;"></i> View All ${certifications.length} Certifications`;
  }

  const statCerts = document.getElementById('statCertsNum');
  if (statCerts) statCerts.textContent = certifications.length;

  const homeCertsPreview = document.getElementById('homeCertsPreview');
  if (homeCertsPreview) {
    homeCertsPreview.innerHTML = certifications.slice(0, 3).map(renderCertCardHtml).join('');
  }

  const allCertsGrid = document.getElementById('allCertsGrid');
  if (allCertsGrid) {
    allCertsGrid.innerHTML = certifications.map(renderCertCardHtml).join('');
  }

  bindCertCards();
}

// C. Hydrate Achievements
function hydrateAchievements(achievements) {
  if (!Array.isArray(achievements) || achievements.length === 0) return;
  const achieveGrid = document.getElementById('achievementsGridPublic');
  if (!achieveGrid) return;

  achieveGrid.innerHTML = achievements.map(achieve => `
    <div class="card project-card fade-up">
      ${achieve.image ? `
        <div style="margin-bottom: 1rem; border-radius: 8px; overflow: hidden; max-height: 200px; border: 1px solid var(--border);">
          <img src="${resolveAssetUrl(achieve.image)}" alt="${escapeHtml(achieve.title)}" style="width: 100%; height: 100%; object-fit: cover; display: block;"/>
        </div>
      ` : ''}
      <div class="project-top">
        <div class="project-icon"><i class="fas fa-trophy"></i></div>
        ${achieve.date ? `<div class="project-badges"><span class="badge badge-active">${escapeHtml(achieve.date)}</span></div>` : ''}
      </div>
      <div class="project-title" style="font-size:1.1rem;">${escapeHtml(achieve.title)}</div>
      <p class="project-desc">${escapeHtml(achieve.description || '')}</p>
    </div>
  `).join('');
}

// D. Hydrate Projects (Featured on Home & Complete on projects.html)
function hydrateProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return;

  console.log(`[Hydrate Projects] Found ${projects.length} project(s) to render.`);

  const homeProjectsGrid = document.getElementById('homeProjectsGrid');
  if (homeProjectsGrid) {
    homeProjectsGrid.innerHTML = projects.slice(0, 4).map(renderProjectCardHtml).join('');
  }

  const allProjectsGrid = document.getElementById('allProjectsGrid');
  if (allProjectsGrid) {
    allProjectsGrid.innerHTML = projects.map(renderProjectCardHtml).join('');

    // Dynamically register any custom categories into projectsFilterBar
    const filterBar = document.getElementById('projectsFilterBar');
    if (filterBar) {
      const existingBtnCats = Array.from(filterBar.querySelectorAll('.filter-btn'))
        .map(b => (b.getAttribute('data-category') || '').toLowerCase());

      const projectCats = Array.from(new Set(projects.map(p => p.category).filter(Boolean)));
      projectCats.forEach(cat => {
        if (!existingBtnCats.includes(cat.toLowerCase()) && cat.toLowerCase() !== 'all') {
          const btn = document.createElement('button');
          btn.className = 'filter-btn';
          btn.setAttribute('data-category', cat);
          btn.textContent = cat;
          btn.onclick = function () {
            if (typeof filterPublicProjects === 'function') {
              filterPublicProjects(cat, this);
            }
          };
          filterBar.appendChild(btn);
        }
      });
    }
  }
}

// E. Hydrate Skills (Home Preview vs. Dedicated skills.html Page)
function hydrateSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return;

  // 1. Group all skills by category
  const grouped = {};
  skills.forEach(skill => {
    const cat = (skill.category || 'Other Capabilities').trim();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(skill);
  });

  const categoryIcons = {
    'entrepreneurship & startup building': 'fas fa-rocket',
    'data & analytics': 'fas fa-chart-line',
    'social media & marketing': 'fas fa-bullhorn',
    'design & creative': 'fas fa-palette',
    'ai tools & technology': 'fas fa-robot',
    'business': 'fas fa-chart-bar',
    'writing & communication': 'fas fa-pen'
  };

  const categoryFilterKeywords = {
    'entrepreneurship & startup building': 'all entrepreneurship business',
    'data & analytics': 'all data analytics tech business',
    'social media & marketing': 'all marketing business',
    'design & creative': 'all design creative',
    'ai tools & technology': 'all ai tech technology',
    'business': 'all business entrepreneurship',
    'writing & communication': 'all writing communication business'
  };

  function renderCategoryCards(catGrouped, isFullPage = true) {
    return Object.entries(catGrouped).map(([category, items]) => {
      const catKey = category.toLowerCase().trim();
      const iconClass = categoryIcons[catKey] || 'fas fa-layer-group';
      const filterKeyword = categoryFilterKeywords[catKey] || `all ${catKey.replace(/[^a-z0-9]/g, ' ')}`;
      const filterAttr = isFullPage ? `data-category="${escapeHtml(filterKeyword)}"` : '';
      const filterClass = isFullPage ? 'filter-item' : '';

      return `
        <div class="card skill-cat-card fade-up ${filterClass}" ${filterAttr} style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div class="skill-cat-header">
              <div class="skill-cat-icon"><i class="${iconClass}"></i></div>
              <div class="skill-cat-title">${escapeHtml(category)}</div>
            </div>
            
            <div style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.95rem;">
              ${items.map(s => {
                const numLevel = parseInt(s.level || '80', 10) || 80;
                const isIconUrl = s.icon && (s.icon.startsWith('http') || s.icon.startsWith('/') || s.icon.startsWith('assets/'));

                return `
                  <div class="skill-item">
                    <div class="skill-top">
                      <span class="skill-name" style="display:flex;align-items:center;gap:0.45rem;">
                        ${isIconUrl 
                          ? `<img src="${resolveAssetUrl(s.icon)}" alt="${escapeHtml(s.name)}" style="width:16px;height:16px;object-fit:contain;"/>` 
                          : `<i class="${escapeHtml(s.icon || 'fas fa-check-circle')}" style="color:var(--teal);font-size:0.9rem;"></i>`}
                        ${escapeHtml(s.name)}
                      </span>
                      <span class="skill-pct">${escapeHtml(s.level || '')}</span>
                    </div>
                    <div class="skill-bar">
                      <div class="skill-bar-fill" data-width="${numLevel}"></div>
                    </div>
                    ${s.description ? `<p style="font-size:0.75rem;color:var(--text2);margin:0.25rem 0 0 0;line-height:1.4;">${escapeHtml(s.description)}</p>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Hydrate Home Page Preview (#homeSkillsPreview)
  const isHomePage = Boolean(
    document.getElementById('homeProjectsGrid') ||
    document.getElementById('homeSkillsPreview') ||
    document.getElementById('typingText')
  );

  const homeSkillsPreview = document.getElementById('homeSkillsPreview') || (isHomePage ? document.getElementById('allSkillsContainer') : null);
  if (homeSkillsPreview && isHomePage) {
    // Select top 6 to 8 representative skills across primary categories
    const categoryKeys = Object.keys(grouped);
    let previewGrouped = {};

    if (categoryKeys.length >= 2) {
      // Pick top 2 categories with 3-4 skills each (total 6 to 8 skills)
      const cat1 = categoryKeys[0];
      const cat2 = categoryKeys[1];
      previewGrouped[cat1] = grouped[cat1].slice(0, 4);
      previewGrouped[cat2] = grouped[cat2].slice(0, 4);
    } else if (categoryKeys.length === 1) {
      previewGrouped[categoryKeys[0]] = grouped[categoryKeys[0]].slice(0, 8);
    } else {
      const topSkills = skills.slice(0, 8);
      topSkills.forEach(s => {
        const c = s.category || 'Core Capabilities';
        if (!previewGrouped[c]) previewGrouped[c] = [];
        previewGrouped[c].push(s);
      });
    }

    const previewTotalCount = Object.values(previewGrouped).reduce((acc, curr) => acc + curr.length, 0);
    console.log(`[Hydrate Skills] Rendering Home Preview of ${previewTotalCount} top skills into #homeSkillsPreview...`);
    homeSkillsPreview.innerHTML = renderCategoryCards(previewGrouped, false);

    // Update Home Skills Count button
    const btnHomeSkillsCount = document.getElementById('btnHomeSkillsCount');
    if (btnHomeSkillsCount) {
      btnHomeSkillsCount.innerHTML = `<i class="fas fa-brain" style="margin-right: 8px;"></i> View All ${skills.length} Skills &amp; Capabilities`;
    }
  }

  // 3. Hydrate Dedicated Skills Page (#allSkillsContainer on skills.html)
  const allSkillsContainer = isHomePage ? null : document.getElementById('allSkillsContainer');
  if (allSkillsContainer) {
    console.log(`[Hydrate Skills] Rendering full catalog of ${skills.length} skills into #allSkillsContainer on skills.html...`);
    allSkillsContainer.innerHTML = renderCategoryCards(grouped, true);

    bindSkillsFilters();
  }

  observeSkillBars();
}

// F. Hydrate Blogs (Featured on Home & Complete on blog.html)
function hydrateBlogs(blogs) {
  if (!Array.isArray(blogs) || blogs.length === 0) return;

  console.log(`[Hydrate Blogs] Found ${blogs.length} blog post(s) to render.`);

  const homeBlogsGrid = document.getElementById('homeBlogsGrid');
  if (homeBlogsGrid) {
    homeBlogsGrid.innerHTML = blogs.slice(0, 3).map(renderBlogCardHtml).join('');
  }

  const blogGridPublic = document.getElementById('blogGridPublic');
  if (blogGridPublic) {
    blogGridPublic.innerHTML = blogs.map(renderBlogCardHtml).join('');
  }
}

// ── 7. Render Card Template Helpers ──────────────────────────────────────────

function renderProjectCardHtml(project) {
  const categoryIcons = {
    'business & entrepreneurship': 'fas fa-briefcase',
    'tech & ai': 'fas fa-robot',
    'economics': 'fas fa-coins',
    'digital marketing': 'fas fa-bullhorn',
    'data analytics': 'fas fa-chart-line'
  };
  const cat = project.category || 'Business & Entrepreneurship';
  const iconClass = categoryIcons[cat.toLowerCase()] || 'fas fa-rocket';
  const proofUrl = project.proof_url || project.proofUrl;

  const tags = Array.isArray(project.tags) 
    ? project.tags 
    : (typeof project.tags === 'string' && project.tags.trim() ? project.tags.split(',').map(t => t.trim()) : []);

  return `
    <div class="card project-card fade-up" data-category="${escapeHtml(cat)}">
      ${project.image ? `
        <div style="margin-bottom: 1rem; border-radius: 8px; overflow: hidden; max-height: 220px; border: 1px solid var(--border);">
          <img src="${resolveAssetUrl(project.image)}" alt="${escapeHtml(project.title)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none';"/>
        </div>
      ` : ''}
      <div class="project-top">
        <div class="project-icon"><i class="${iconClass}"></i></div>
        <div class="project-badges">
          <span class="badge badge-active">${escapeHtml(cat)}</span>
          ${project.date ? `<span class="badge badge-completed">${escapeHtml(project.date)}</span>` : ''}
        </div>
      </div>
      <div class="project-title" style="font-size:1.15rem;margin-top:0.35rem;">${escapeHtml(project.title)}</div>
      ${project.subtitle ? `<div class="project-subtitle" style="color:var(--teal);font-weight:500;margin-bottom:0.5rem;font-size:0.85rem;">${escapeHtml(project.subtitle)}</div>` : ''}
      <p class="project-desc">${escapeHtml(project.description || '')}</p>

      ${tags.length > 0 ? `
        <div class="project-tags" style="margin-top:0.75rem;">
          ${tags.map(t => `<span class="project-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      ` : ''}

      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;margin-top:1.1rem;padding-top:0.75rem;border-top:1px solid var(--border);">
        ${project.link ? `
          <a href="${escapeHtml(project.link)}" target="_blank" style="color:var(--teal);font-weight:700;font-size:0.82rem;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">
            <i class="fas fa-external-link-alt"></i> Live Site
          </a>
        ` : ''}
        ${proofUrl ? `
          <a href="${resolveAssetUrl(proofUrl)}" target="_blank" class="btn-proof-doc">
            <i class="fas fa-file-shield"></i> View Proof Document
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

function renderBlogCardHtml(blog) {
  const categoryIcons = {
    'my story': 'fas fa-road',
    'business strategy': 'fas fa-bolt',
    'technology': 'fas fa-robot'
  };
  const cat = blog.category || 'Insights';
  const iconClass = categoryIcons[cat.toLowerCase()] || 'fas fa-newspaper';

  let formattedContent = escapeHtml(blog.content || blog.excerpt || '');
  formattedContent = formattedContent
    .replace(/###\s*(.*?)(?:\n|$)/g, '<h3>$1</h3>')
    .replace(/\n\n+/g, '</p><p>');
  formattedContent = `<p>${formattedContent}</p>`;

  return `
    <div class="card project-card fade-up">
      ${blog.image ? `
        <div style="margin-bottom: 1rem; border-radius: 8px; overflow: hidden; max-height: 200px; border: 1px solid var(--border);">
          <img src="${resolveAssetUrl(blog.image)}" alt="${escapeHtml(blog.title)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none';"/>
        </div>
      ` : ''}
      <div class="project-top">
        <div class="project-icon"><i class="${iconClass}"></i></div>
        <div class="project-badges">
          <span class="badge badge-active">${escapeHtml(cat)}</span>
          ${blog.date ? `<span class="badge badge-completed">${escapeHtml(blog.date)}</span>` : ''}
          ${blog.readTime ? `<span class="badge" style="background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text2);">${escapeHtml(blog.readTime)}</span>` : ''}
        </div>
      </div>
      
      <div class="project-title card-title-text" style="font-size:1.15rem;margin-top:0.4rem;">${escapeHtml(blog.title)}</div>
      <p class="project-desc">${escapeHtml(blog.excerpt || '')}</p>

      <div class="secret-full-article" style="display: none;">
        ${formattedContent}
      </div>

      <button class="btn btn-outline" style="margin-top:1rem;display:inline-flex;align-items:center;gap:6px;" onclick="openBlogPopup(this)">
        <i class="fas fa-book-open"></i> Read Full Article
      </button>
    </div>
  `;
}

function renderCertCardHtml(cert) {
  const isPdf = cert.image && cert.image.toLowerCase().endsWith('.pdf');
  const cleanImg = resolveAssetUrl(cert.image);
  return `
    <div class="card cert-card fade-up" data-src="${cleanImg}">
      <div class="cert-img-wrap">
        ${cert.image ? (
          isPdf ? `
            <div style="text-align:center;padding:1rem;color:var(--teal);">
              <i class="fas fa-file-pdf" style="font-size:2.5rem;margin-bottom:0.5rem;display:block;"></i>
              <span style="font-size:0.75rem;font-weight:600;">PDF Certificate</span>
            </div>
          ` : `<img src="${cleanImg}" alt="${escapeHtml(cert.title)}"/>`
        ) : `<i class="fas fa-award"></i>`}
      </div>
      <div class="cert-issuer">${escapeHtml(cert.issuer)}</div>
      <div class="cert-name">${escapeHtml(cert.title)}</div>
      ${cert.date ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:0.3rem;"><i class="far fa-calendar"></i> ${escapeHtml(cert.date)}</div>` : ''}
      ${cert.verificationLink ? `
        <div style="margin-top:0.5rem;">
          <a href="${escapeHtml(cert.verificationLink)}" target="_blank" style="font-size:0.78rem;color:var(--teal);text-decoration:none;" onclick="event.stopPropagation();">
            <i class="fas fa-external-link-alt"></i> Verify Online
          </a>
        </div>
      ` : ''}
    </div>
  `;
}

// ── 8. Interactive Filter & Bar Observers ─────────────────────────────────────

function observeSkillBars() {
  const skillBars = document.querySelectorAll('.skill-bar-fill');
  if (skillBars.length === 0) return;

  const skillObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        setTimeout(() => {
          bar.style.width = (bar.getAttribute('data-width') || '80') + '%';
        }, 150);
        skillObserver.unobserve(bar);
      }
    });
  }, { threshold: 0.2 });

  skillBars.forEach(bar => skillObserver.observe(bar));
}

function bindSkillsFilters() {
  const filterBtns = document.querySelectorAll('#skillsFilterBar .filter-btn, .filter-container .filter-btn');
  const filterItems = document.querySelectorAll('#allSkillsContainer .filter-item');
  if (filterBtns.length === 0 || filterItems.length === 0) return;

  filterBtns.forEach(btn => {
    btn.onclick = () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filterVal = (btn.getAttribute('data-filter') || 'all').toLowerCase();

      filterItems.forEach(item => {
        const itemCat = (item.getAttribute('data-category') || '').toLowerCase();
        if (filterVal === 'all' || itemCat.includes(filterVal)) {
          item.style.display = 'flex';
          setTimeout(() => { item.style.opacity = '1'; item.style.transform = 'scale(1)'; }, 30);
        } else {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.97)';
          setTimeout(() => { item.style.display = 'none'; }, 200);
        }
      });
    };
  });
}

// Global project filter function for projects.html
window.filterPublicProjects = function (category, btn) {
  if (btn) {
    document.querySelectorAll('#projectsFilterBar .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const cards = document.querySelectorAll('#allProjectsGrid .project-card');
  cards.forEach(card => {
    const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
    const match = category === 'all' || cardCat === category.toLowerCase();
    if (match) {
      card.style.display = 'flex';
      setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 30);
    } else {
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      setTimeout(() => { card.style.display = 'none'; }, 200);
    }
  });
};

// ── 9. Global Blog Popup Modal Controls ──────────────────────────────────────

window.openBlogPopup = function (btn) {
  const card = btn ? btn.closest('.project-card') : null;
  if (!card) return;

  const titleText = card.querySelector('.card-title-text')?.innerText || 'Article';
  const fullContentHTML = card.querySelector('.secret-full-article')?.innerHTML || '';

  const modal = document.getElementById('blogModal');
  const titleEl = document.getElementById('blogModalTitle');
  const bodyEl = document.getElementById('blogModalBody');

  if (titleEl) titleEl.innerText = titleText;
  if (bodyEl) {
    bodyEl.innerHTML = fullContentHTML;
    bodyEl.scrollTop = 0;
  }
  if (modal) modal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeBlogPopup = function () {
  const modal = document.getElementById('blogModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = 'auto';
};

document.addEventListener('click', (e) => {
  const modal = document.getElementById('blogModal');
  if (modal && e.target === modal) {
    closeBlogPopup();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeBlogPopup();
  }
});

// ── 10. Contact Form Handlers ────────────────────────────────────────────────

function getFormData() {
  return {
    name: document.getElementById('fname')?.value || '',
    email: document.getElementById('femail')?.value || '',
    subject: document.getElementById('fsubject')?.value || '',
    message: document.getElementById('fmessage')?.value || ''
  };
}

function sendEmail() {
  const data = getFormData();
  if (!data.name || !data.message) {
    alert("Please fill in your Name and Message.");
    return;
  }
  const targetEmail = window.portfolioContactEmail || 'mmudassirshah634@gmail.com';
  window.location.href = `mailto:${targetEmail}?subject=${encodeURIComponent(data.subject || 'Portfolio Inquiry')}&body=${encodeURIComponent("Name: " + data.name + "\nEmail: " + data.email + "\n\nMessage:\n" + data.message)}`;
}

function sendWhatsapp() {
  const data = getFormData();
  if (!data.name || !data.message) {
    alert("Please fill in your Name and Message.");
    return;
  }
  const targetWa = window.portfolioWhatsapp || '923143027272';
  window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent("Hello Mudassir, my name is " + data.name + ". \n\nSubject: " + data.subject + "\n\nMessage: " + data.message)}`, '_blank');
}

// ── 11. String Escaping Utility ──────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
