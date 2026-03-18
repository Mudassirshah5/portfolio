# Muhammad Mudassir Shah — Portfolio Website
## Setup & Customization Guide

---

## 📁 Folder Structure
```
mudassirshah-portfolio/
├── index.html          → Home / Hero page
├── about.html          → About, Education, Work, Languages, Interests
├── skills.html         → All skills with progress bars
├── projects.html       → All projects & ventures
├── certifications.html → Certificates (clickable images)
├── blog.html           → Blog (Coming Soon)
├── contact.html        → Contact form + Google Map
│
├── css/
│   └── style.css       → All styles
├── js/
│   └── script.js       → Dark mode, animations, typing effect
└── assets/
    ├── images/
    │   ├── profile.jpg         ← ADD YOUR PHOTO HERE
    │   ├── lovcus-logo.png     ← ADD LOVCUS LOGO HERE
    │   ├── cert-1.jpg          ← AI for Beginners (HP)
    │   ├── cert-2.jpg          ← Resume Writing (HP)
    │   ├── cert-3.jpg          ← Cyber Security (HP)
    │   ├── cert-4.jpg          ← Starting a Small Business (HP)
    │   ├── cert-5.jpg          ← Effective Leadership (HP)
    │   └── cert-6.jpg          ← English Communication (Fondi)
    └── docs/
        └── MyCv.pdf            ← ADD YOUR CV HERE
```

---

## ✅ Things To Do After Download

### 1. Add Your Photo
- Save your photo as `assets/images/profile.jpg`
- In `index.html`, find this line:
  ```html
  <!-- <img src="assets/images/profile.jpg" alt="Muhammad Mudassir Shah" class="hero-photo"/> -->
  ```
- Remove the `<!--` and `-->` to uncomment it
- Delete the placeholder div below it

### 2. Add Your CV
- Save your CV as `assets/docs/MyCv.pdf`

### 3. Add Certificate Images
- Save each certificate as a JPG image
- Name them: `cert-1.jpg`, `cert-2.jpg` ... `cert-6.jpg`
- Place in `assets/images/`
- They will automatically appear and be clickable

### 4. Add LOVCUS Logo
- Save as `assets/images/lovcus-logo.png`
- In `projects.html`, find the lovcus-placeholder div and replace with:
  ```html
  <img src="assets/images/lovcus-logo.png" alt="LOVCUS" class="lovcus-logo"/>
  ```

### 5. Update Contact Details
In `contact.html` and all footers, replace:
- `youremail@example.com` → your real email
- `+92 XXX XXX XXXX` → your real WhatsApp number
- `92XXXXXXXXXX` → your number without + sign (for wa.me links)

---

## 🌐 How To Host For Free (Netlify — Recommended)

1. Go to **https://netlify.com** and create a free account
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag and drop your entire `mudassirshah-portfolio` folder
4. Your site goes live instantly at a link like: `mudassirshah.netlify.app`
5. You can set a custom name in Netlify settings

### Alternative: GitHub Pages
1. Create a free account at **github.com**
2. Create a new repository named `mudassirshah-portfolio`
3. Upload all files
4. Go to Settings → Pages → Select main branch
5. Your site will be live at `yourusername.github.io/mudassirshah-portfolio`

---

## 🌙 Dark Mode
- Click the toggle button in the top-right corner of any page
- Your preference is saved automatically

---

## ➕ How To Add New Projects Later
Open `projects.html` and copy one project card block, paste it, and update the content.

---

## ➕ How To Add Blog Posts Later
Open `blog.html`, remove the "Coming Soon" section, and add blog post cards.

---

Built with ❤️ for Muhammad Mudassir Shah — Batkhela, Pakistan
