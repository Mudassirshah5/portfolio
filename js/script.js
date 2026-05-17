// ============================================================
//  Muhammad Mudassir Shah — Portfolio  |  script.js
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // ── Dark Mode ──────────────────────────────────────────────
  const html = document.documentElement;
  const toggle = document.getElementById('darkToggle');
  const saved = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', saved);

  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  // ── Hamburger Menu ─────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });
  }

  // ── Scroll Fade-Up Animations ──────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

  // ── Typing Effect (Hero) ────────────────────────────────────
  const typingEl = document.getElementById('typingText');
  if (typingEl) {
    const texts = [
      'Entrepreneur',
      'Economics Student',
      'Visionary',
      'Strategist',
      'Business Builder'
    ];
    let i = 0, charIndex = 0, deleting = false;
    const speed = 90, deleteSpeed = 50, pause = 1800;

    function type() {
      const current = texts[i];
      if (!deleting) {
        typingEl.textContent = current.slice(0, charIndex + 1);
        charIndex++;
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(type, pause);
          return;
        }
      } else {
        typingEl.textContent = current.slice(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) {
          deleting = false;
          i = (i + 1) % texts.length;
        }
      }
      setTimeout(type, deleting ? deleteSpeed : speed);
    }
    type();
  }

  // ── Skill Bar Animation ────────────────────────────────────
  const skillBars = document.querySelectorAll('.skill-bar-fill');
  const skillObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        const width = bar.getAttribute('data-width');
        setTimeout(() => { bar.style.width = width + '%'; }, 200);
        skillObserver.unobserve(bar);
      }
    });
  }, { threshold: 0.3 });
  skillBars.forEach(bar => skillObserver.observe(bar));

  // ── Active Nav Highlight on Scroll ─────────────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  function updateActiveNav() {
    let currentId = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 120) {
        currentId = sec.id;
      }
    });
    navLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + currentId);
    });
  }

  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav(); // run once on load

  // ── Cert Modal (lightbox) ──────────────────────────────────
  const modal = document.getElementById('certModal');
  const modalImg = document.getElementById('certModalImg');
  const modalClose = document.getElementById('certModalClose');

  document.querySelectorAll('.cert-card[data-src]').forEach(card => {
    card.addEventListener('click', () => {
      if (modal && modalImg) {
        modalImg.src = card.getAttribute('data-src');
        modal.classList.add('open');
      }
    });
  });
  if (modalClose) modalClose.addEventListener('click', () => modal.classList.remove('open'));
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  // ── Navbar shadow on scroll ────────────────────────────────
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (nav) nav.style.boxShadow = window.scrollY > 20 ? '0 2px 20px rgba(0,0,0,0.1)' : 'none';
  });

});

function sendEmail() {
  const name = document.getElementById('fname').value.trim();
  const email = document.getElementById('femail').value.trim();
  const message = document.getElementById('fmessage').value.trim();
  if (!name || !email || !message) { alert('Please fill in all required fields.'); return; }
  const mailto = `mailto:mmudassirshah634@gmail.com?subject=${encodeURIComponent('Portfolio Contact - ' + (document.getElementById('fsubject').value || 'General'))}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`;
  window.location.href = mailto;
  document.getElementById('fname').value = '';
  document.getElementById('femail').value = '';
  document.getElementById('fsubject').value = '';
  document.getElementById('fmessage').value = '';
  setTimeout(() => { document.getElementById('formSuccess').style.display = 'block'; }, 100);
  setTimeout(() => { document.getElementById('formSuccess').style.display = 'none'; }, 4000);
}

function sendWhatsapp() {
  const name = document.getElementById('fname').value.trim();
  const email = document.getElementById('femail').value.trim();
  const message = document.getElementById('fmessage').value.trim();
  if (!name || !email || !message) { alert('Please fill in all required fields.'); return; }
  const text = `Name: ${name}\nEmail: ${email}\n\n${message}`;
  window.open(`https://wa.me/923143027272?text=${encodeURIComponent(text)}`);
  document.getElementById('fname').value = '';
  document.getElementById('femail').value = '';
  document.getElementById('fsubject').value = '';
  document.getElementById('fmessage').value = '';
  setTimeout(() => { document.getElementById('formSuccess').style.display = 'block'; }, 100);
  setTimeout(() => { document.getElementById('formSuccess').style.display = 'none'; }, 4000);
}
