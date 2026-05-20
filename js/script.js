document.addEventListener('DOMContentLoaded', () => {

  // ── Loading Screen ──────────────────────────────────────────
  const loader = document.getElementById('loader');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 400); // removes from DOM after fade
    }, 1200); // Stays for 1.2 seconds
  }

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
    const texts = ['Entrepreneur', 'Economics Student', 'Visionary', 'Strategist', 'Business Builder'];
    let i = 0, charIndex = 0, deleting = false;
    const speed = 90, deleteSpeed = 50, pause = 1800;

    function type() {
      const current = texts[i];
      if (!deleting) {
        typingEl.textContent = current.slice(0, charIndex + 1);
        charIndex++;
        if (charIndex === current.length) { deleting = true; setTimeout(type, pause); return; }
      } else {
        typingEl.textContent = current.slice(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) { deleting = false; i = (i + 1) % texts.length; }
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
        setTimeout(() => { bar.style.width = bar.getAttribute('data-width') + '%'; }, 200);
        skillObserver.unobserve(bar);
      }
    });
  }, { threshold: 0.3 });
  skillBars.forEach(bar => skillObserver.observe(bar));

  // ── Filter Logic (For Skills & Blogs) ──────────────────────
  const filterBtns = document.querySelectorAll('.filter-btn');
  const filterItems = document.querySelectorAll('.filter-item');
  
  if(filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filterValue = btn.getAttribute('data-filter');
        
        filterItems.forEach(item => {
          if (filterValue === 'all' || item.getAttribute('data-category').includes(filterValue)) {
            item.style.display = 'block';
            setTimeout(() => { item.style.opacity = '1'; item.style.transform = 'scale(1)'; }, 50);
          } else {
            item.style.opacity = '0';
            item.style.transform = 'scale(0.95)';
            setTimeout(() => { item.style.display = 'none'; }, 300);
          }
        });
      });
    });
  }

  // ── Cert Modal ─────────────────────────────────────────────
  const modal = document.getElementById('certModal');
  const modalImg = document.getElementById('certModalImg');
  const modalClose = document.getElementById('certModalClose');
  document.querySelectorAll('.cert-card[data-src]').forEach(card => {
    card.addEventListener('click', () => {
      if (modal && modalImg) { modalImg.src = card.getAttribute('data-src'); modal.classList.add('open'); }
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

// ── Contact Form Functions ───────────────────────────────────
function getFormData() {
  return {
    name: document.getElementById('fname').value,
    email: document.getElementById('femail').value,
    subject: document.getElementById('fsubject').value,
    message: document.getElementById('fmessage').value
  };
}
function sendEmail() {
  const data = getFormData();
  if (!data.name || !data.message) return alert("Please fill in your Name and Message.");
  window.location.href = `mailto:mmudassirshah634@gmail.com?subject=${encodeURIComponent(data.subject || 'Portfolio Inquiry')}&body=${encodeURIComponent("Name: " + data.name + "\nEmail: " + data.email + "\n\nMessage:\n" + data.message)}`;
}
function sendWhatsapp() {
  const data = getFormData();
  if (!data.name || !data.message) return alert("Please fill in your Name and Message.");
  window.open(`https://wa.me/923143027272?text=${encodeURIComponent("Hello Mudassir, my name is " + data.name + ". \n\nSubject: " + data.subject + "\n\nMessage: " + data.message)}`, '_blank');
}
