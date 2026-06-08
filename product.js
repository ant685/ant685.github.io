// MOTOBY — product.js
"use strict";

let currentLotId    = null;
let currentMoto     = null;
let activeLanguage  = "EN";
let galleryImages   = [];
let activeImageIdx  = 0;

// Touch tracking (lightbox swipe)
let touchStartX = 0, touchStartY = 0;
let touchEndX   = 0, touchEndY   = 0;
let swipingVert = false;

// ─── Gallery pinch-to-zoom state ──────────────────────
const GZ = {
    scale:      1,
    minScale:   1,
    maxScale:   4,
    tx:         0,         // translateX offset px
    ty:         0,         // translateY offset px
    // pinch
    isPinching: false,
    startDist:  0,
    startScale: 1,
    startMidX:  0,
    startMidY:  0,
    startTx:    0,
    startTy:    0,
    // pan (single finger when zoomed)
    isPanning:  false,
    panStartX:  0,
    panStartY:  0,
    panTx:      0,
    panTy:      0,
    // double-tap
    lastTap:    0,
};

// ─── Init ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initLanguage();
    parseLotParam();
    loadConfiguration();
    setupScrollHandler();
    setupHeaderContacts();
    if (currentLotId) {
        loadProductData().catch(err => console.error("Product load failed:", err));
    } else {
        showNotFound();
    }
});

// ─── Language ─────────────────────────────────────────
function initLanguage() {
    const saved = localStorage.getItem("motoby_lang");
    if (saved && window.TRANSLATIONS?.[saved]) {
        activeLanguage = saved;
    } else {
        const sys = ((navigator.language || "en").slice(0, 2)).toUpperCase();
        activeLanguage = window.TRANSLATIONS?.[sys] ? sys : "EN";
        localStorage.setItem("motoby_lang", activeLanguage);
    }
    applyTranslations();
    updateLangUI();
}

function setLanguage(lang) {
    if (!window.TRANSLATIONS?.[lang]) return;
    activeLanguage = lang;
    localStorage.setItem("motoby_lang", lang);
    applyTranslations();
    updateLangUI();
    if (currentMoto) populateUI(currentMoto);
}

function tr(key) {
    return window.TRANSLATIONS?.[activeLanguage]?.[key] ?? key;
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const val = tr(el.getAttribute("data-i18n"));
        if (val) el.textContent = val;
    });
}

function updateLangUI() {
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.lang === activeLanguage);
    });
}

// ─── Configuration ────────────────────────────────────
function loadConfiguration() {
    const cfg = window.CONFIG || {};

    const tg = document.getElementById("contactTelegram");
    if (tg) tg.href = cfg.telegram || "#";

    const wa = document.getElementById("contactWhatsapp");
    if (wa) wa.href = cfg.whatsapp || "#";

    const em = document.getElementById("contactEmail");
    if (em && cfg.email) {
        em.href = `mailto:${cfg.email}`;
        const txt = document.getElementById("contactEmailText");
        if (txt) txt.textContent = cfg.email;
    }
}

function setupScrollHandler() {
    const header = document.querySelector("header");
    if (!header) return;
    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 30);
    }, { passive: true });
}

// ─── Header responsive contacts ───────────────────────
function setupHeaderContacts() {
    const contacts  = document.querySelector(".contacts");
    const container = document.querySelector(".header-container");
    if (!contacts || !container) return;

    const check = () => {
        contacts.classList.remove("icon-only");
        const available = container.offsetWidth;
        const contactsW = contacts.scrollWidth;
        const padding   = 40;
        const sideAvail = (available - padding) / 2;
        if (contactsW > sideAvail) {
            contacts.classList.add("icon-only");
        }
    };

    check();
    window.addEventListener("resize", check, { passive: true });
}

// ─── URL parameter ────────────────────────────────────
function parseLotParam() {
    try {
        const lot = new URLSearchParams(window.location.search).get("lot");
        if (lot) currentLotId = lot.trim();
    } catch (e) {
        console.error("URL parse error:", e);
    }
}

// ─── Data ─────────────────────────────────────────────
async function loadProductData() {
    try {
        const res = await fetch("motorcycles.csv");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const motos = parseCSV(await res.text());

        currentMoto = motos.find(m => {
            const id = (m.lot || "").trim();
            return id === currentLotId || parseInt(id) === parseInt(currentLotId);
        });

        if (!currentMoto) { showNotFound(); return; }

        const layout   = document.getElementById("productLayout");
        const notFound = document.getElementById("lotNotFoundBlock");
        if (layout)   layout.style.display   = "grid";
        if (notFound) notFound.style.display  = "none";

        const cfg = window.CONFIG || {};
        const brand = currentMoto.brand !== "NA" ? (currentMoto.brand || "") : "";
        const model = currentMoto.model !== "NA" ? (currentMoto.model || "") : "";
        document.title = `${brand} ${model} — Lot ${currentMoto.lot} | ${cfg.siteName || "MOTOBY"}`;

        populateUI(currentMoto);
        setupEventListeners();
        await loadGallery(currentMoto.lot);

    } catch (err) {
        showNotFound();
        throw err;
    }
}

function parseCSV(text) {
    const rows = [];
    let row = [""], inQ = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i], n = text[i + 1];
        if (c === '"') {
            if (inQ && n === '"') { row[row.length - 1] += '"'; i++; }
            else inQ = !inQ;
        } else if (c === ',' && !inQ) {
            row.push("");
        } else if ((c === '\r' || c === '\n') && !inQ) {
            if (c === '\r' && n === '\n') i++;
            rows.push(row); row = [""];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0]) rows.push(row);
    if (!rows.length) return [];

    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).reduce((acc, r) => {
        if (r.length < headers.length) return acc;
        const obj = {};
        let valid = false;
        headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); if (obj[h]) valid = true; });
        if (valid && obj.lot) acc.push(obj);
        return acc;
    }, []);
}

// ─── UI Population ────────────────────────────────────
function populateUI(moto) {
    const locale = activeLanguage === "RU" ? "ru-RU" : "en-US";
    const brand  = moto.brand && moto.brand !== "NA" ? moto.brand : "";
    const model  = moto.model && moto.model !== "NA" ? moto.model : "";

    // Header
    const lotEl = document.getElementById("productLotText");
    if (lotEl) lotEl.textContent = `LOT ${moto.lot}`;

    const titleEl = document.getElementById("productTitle");
    if (titleEl) titleEl.textContent = `${brand} ${model}`.trim() || "Motorcycle";

    // Status badge
    const statusKey = (moto.status || "").toLowerCase().trim();
    const statusMap = {
        available:  { label: tr("status_available"),  cls: "badge-available"  },
        reserved:   { label: tr("status_reserved"),   cls: "badge-reserved"   },
        in_transit: { label: tr("status_in_transit"), cls: "badge-in_transit" },
        sold:       { label: tr("status_sold"),        cls: "badge-sold"       },
    };
    const { label, cls } = statusMap[statusKey] || { label: moto.status || "", cls: "badge-available" };
    const badgeContainer = document.getElementById("productStatusBadgeContainer");
    if (badgeContainer) badgeContainer.innerHTML = `<span class="badge ${cls}">${label}</span>`;

    // Price — uses € currency
    const priceCont = document.getElementById("productPriceContainer");
    const priceEl   = document.getElementById("productPrice");
    if (moto.price && moto.price !== "NA" && moto.price !== "") {
        if (priceCont) priceCont.style.display = "block";
        if (priceEl)   priceEl.textContent = `€${Number(moto.price).toLocaleString(locale)}`;
    } else {
        if (priceCont) priceCont.style.display = "none";
    }

    // Helper: show or hide a spec row
    const setRow = (rowId, valId, rawVal, unit = "", isCondition = false) => {
        const rowEl = document.getElementById(rowId);
        const valEl = document.getElementById(valId);
        if (!rowEl || !valEl) return;
        if (rawVal && rawVal !== "NA" && rawVal !== "") {
            rowEl.style.display = "flex";
            if (unit) {
                const num = Number(rawVal);
                valEl.textContent = `${isNaN(num) ? rawVal : num.toLocaleString(locale)} ${unit}`;
            } else if (isCondition) {
                valEl.textContent = tr(`condition_${rawVal}`) || rawVal;
            } else {
                valEl.textContent = rawVal;
            }
        } else {
            rowEl.style.display = "none";
        }
    };

    setRow("rowLot",      "specLot",      moto.lot);
    setRow("rowModel",    "specModel",    `${brand} ${model}`.trim());
    setRow("rowYear",     "specYear",     moto.year);
    setRow("rowEngine",   "specEngine",   moto.engine_cc, tr("engine_unit"));
    setRow("rowMileage",  "specMileage",  moto.mileage,   tr("mileage_unit"));
    setRow("rowLocation", "specLocation", moto.location);
    setRow("rowCondition","specCondition",moto.condition,  "", true);

    // Description
    const descPanel = document.getElementById("descPanel");
    const descText  = document.getElementById("descText");
    if (moto.description && moto.description !== "NA" && moto.description !== "") {
        if (descPanel) descPanel.style.display = "block";
        if (descText)  descText.textContent = moto.description;
    } else {
        if (descPanel) descPanel.style.display = "none";
    }

    // Contact buttons with pre-filled message
    const cfg = window.CONFIG || {};
    const msgEncoded = encodeURIComponent(
        `Hello, I'm interested in Lot ${moto.lot}: ${brand} ${model} (€${moto.price || "NA"})`
    );

    const tgBtn = document.getElementById("btnActionTelegram");
    if (tgBtn && cfg.telegram) {
        if (cfg.telegram.includes("t.me/")) {
            const handle = cfg.telegram.split("t.me/")[1].split("?")[0];
            tgBtn.href = `https://t.me/${handle}?text=${msgEncoded}`;
        } else {
            tgBtn.href = cfg.telegram;
        }
    }

    const waBtn = document.getElementById("btnActionWhatsapp");
    if (waBtn && cfg.whatsapp) {
        let phone = cfg.whatsapp.includes("wa.me/")
            ? cfg.whatsapp.split("wa.me/")[1]
            : cfg.whatsapp;
        phone = phone.replace(/\D/g, "");
        waBtn.href = `https://api.whatsapp.com/send?phone=${phone}&text=${msgEncoded}`;
    }
}

function showNotFound() {
    const layout   = document.getElementById("productLayout");
    const notFound = document.getElementById("lotNotFoundBlock");
    if (layout)   layout.style.display   = "none";
    if (notFound) notFound.style.display  = "flex";
}

// ─── Gallery ──────────────────────────────────────────

async function loadGallery(lotId) {
    galleryImages  = [];
    activeImageIdx = 0;

    const thumbs = document.getElementById("galleryThumbs");
    if (thumbs) thumbs.innerHTML = "";

    // Check images sequentially — stops after 2 consecutive missing files
    const MAX          = 40;
    let consecutiveMiss = 0;

    for (let i = 1; i <= MAX; i++) {
        const url = `images/lot${lotId}/${i}.jpg`;
        const found = await probeImage(url);
        if (found) {
            galleryImages.push(url);
            consecutiveMiss = 0;
        } else {
            consecutiveMiss++;
            if (consecutiveMiss >= 2) break;
        }
    }

    if (galleryImages.length === 0) {
        galleryImages.push(makePlaceholder(lotId));
    }

    renderGallery();
}

function probeImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload  = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

function makePlaceholder(lotId) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%2311141a"/><text x="300" y="210" fill="%238e8e93" font-size="18" font-weight="bold" text-anchor="middle" font-family="sans-serif">LOT ${lotId}</text></svg>`;
}

function renderGallery() {
    const mainImg = document.getElementById("mainGalleryImg");
    const thumbs  = document.getElementById("galleryThumbs");
    const prevBtn = document.getElementById("galleryPrevBtn");
    const nextBtn = document.getElementById("galleryNextBtn");

    if (mainImg) {
        mainImg.src            = galleryImages[activeImageIdx];
        mainImg.style.opacity  = "1";
    }

    const multi = galleryImages.length > 1;
    if (prevBtn) prevBtn.style.display = multi ? "flex" : "none";
    if (nextBtn) nextBtn.style.display = multi ? "flex" : "none";

    if (!thumbs) return;
    thumbs.innerHTML = "";
    galleryImages.forEach((src, idx) => {
        const item = document.createElement("div");
        item.className = `thumb-item${idx === activeImageIdx ? " active" : ""}`;
        item.innerHTML = `<img src="${src}" alt="Photo ${idx + 1}" class="thumb-img" loading="lazy">`;
        item.addEventListener("click", () => selectImage(idx));
        thumbs.appendChild(item);
    });
}

// ─── Events ───────────────────────────────────────────
function setupEventListeners() {
    // Language
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
    });

    // Gallery arrows
    document.getElementById("galleryPrevBtn")?.addEventListener("click", e => {
        e.stopPropagation(); prevImage();
    });
    document.getElementById("galleryNextBtn")?.addEventListener("click", e => {
        e.stopPropagation(); nextImage();
    });

    // Open lightbox on main image click
    document.getElementById("mainGalleryImg")?.addEventListener("click", openLightbox);

    // Lightbox close
    document.getElementById("lightboxCloseBtn")?.addEventListener("click", closeLightbox);
    document.getElementById("imageLightbox")?.addEventListener("click", e => {
        if (e.target.id === "imageLightbox" || e.target.classList.contains("lightbox-content")) {
            closeLightbox();
        }
    });

    // Lightbox navigation
    document.getElementById("lightboxPrevBtn")?.addEventListener("click", e => {
        e.stopPropagation(); lbNavigate(-1);
    });
    document.getElementById("lightboxNextBtn")?.addEventListener("click", e => {
        e.stopPropagation(); lbNavigate(1);
    });

    // Keyboard
    document.addEventListener("keydown", onKeyDown);

    // Touch swipe inside lightbox
    const lb = document.getElementById("imageLightbox");
    if (lb) {
        lb.addEventListener("touchstart", onTouchStart, { passive: true });
        lb.addEventListener("touchmove",  onTouchMove,  { passive: true });
        lb.addEventListener("touchend",   onTouchEnd,   { passive: true });
    }

    // Share button
    document.getElementById("btnShareAction")?.addEventListener("click", handleShare);

    // Pinch-to-zoom on main gallery image
    setupGalleryZoom();
}

// ─── Gallery Pinch-to-Zoom ────────────────────────────
function setupGalleryZoom() {
    const container = document.querySelector(".gallery-main-container");
    if (!container) return;

    // Prevent native browser zoom on the container
    container.addEventListener("touchstart",  gzTouchStart, { passive: false });
    container.addEventListener("touchmove",   gzTouchMove,  { passive: false });
    container.addEventListener("touchend",    gzTouchEnd,   { passive: false });
    container.addEventListener("touchcancel", gzTouchEnd,   { passive: false });
}

function gzApply(img) {
    img.style.transition = "none";
    img.style.transform  = `translate(${GZ.tx}px, ${GZ.ty}px) scale(${GZ.scale})`;
}

function gzReset(img, animated) {
    GZ.scale = 1; GZ.tx = 0; GZ.ty = 0;
    img.style.transition = animated ? "transform 0.25s ease" : "none";
    img.style.transform  = "";
    img.style.cursor     = "zoom-in";
}

function gzClampOffset(img) {
    const container = img.closest(".gallery-main-container");
    if (!container) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const maxTx = (cw  * (GZ.scale - 1)) / 2;
    const maxTy = (ch * (GZ.scale - 1)) / 2;
    GZ.tx = Math.max(-maxTx, Math.min(maxTx, GZ.tx));
    GZ.ty = Math.max(-maxTy, Math.min(maxTy, GZ.ty));
}

function gzDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function gzMid(t, container) {
    const rect = container.getBoundingClientRect();
    return {
        x: ((t[0].clientX + t[1].clientX) / 2) - rect.left,
        y: ((t[0].clientY + t[1].clientY) / 2) - rect.top,
    };
}

function gzTouchStart(e) {
    const img = document.getElementById("mainGalleryImg");
    if (!img) return;

    if (e.touches.length === 2) {
        e.preventDefault();
        GZ.isPinching  = true;
        GZ.isPanning   = false;
        GZ.startDist   = gzDist(e.touches);
        GZ.startScale  = GZ.scale;
        GZ.startTx     = GZ.tx;
        GZ.startTy     = GZ.ty;
        const mid      = gzMid(e.touches, e.currentTarget);
        GZ.startMidX   = mid.x;
        GZ.startMidY   = mid.y;
        e.currentTarget.style.touchAction = "none";
        return;
    }

    if (e.touches.length === 1) {
        // Double-tap detection
        const now = Date.now();
        if (now - GZ.lastTap < 300) {
            e.preventDefault();
            gzReset(img, true);
            const container = document.querySelector(".gallery-main-container");
            if (container) container.style.touchAction = "pan-y";
            GZ.lastTap = 0;
            return;
        }
        GZ.lastTap = now;

        if (GZ.scale > 1) {
            // Pan mode
            e.preventDefault();
            GZ.isPanning  = true;
            GZ.panStartX  = e.touches[0].clientX;
            GZ.panStartY  = e.touches[0].clientY;
            GZ.panTx      = GZ.tx;
            GZ.panTy      = GZ.ty;
            img.style.cursor = "grabbing";
            e.currentTarget.style.touchAction = "none";
        }
        // scale === 1 → fall through to normal gallery swipe (handled by existing handlers)
    }
}

function gzTouchMove(e) {
    const img = document.getElementById("mainGalleryImg");
    if (!img) return;

    if (GZ.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist  = gzDist(e.touches);
        let newScale = GZ.startScale * (dist / GZ.startDist);
        newScale     = Math.max(GZ.minScale, Math.min(GZ.maxScale, newScale));

        // Adjust translation so zoom is centred on pinch midpoint
        const mid    = gzMid(e.touches, e.currentTarget);
        const factor = newScale / GZ.startScale;
        GZ.tx = mid.x - factor * (GZ.startMidX - GZ.startTx);
        GZ.ty = mid.y - factor * (GZ.startMidY - GZ.startTy);
        GZ.scale = newScale;

        // Reset to origin coordinates convention
        GZ.tx = GZ.startTx + (mid.x - GZ.startMidX) + (GZ.startMidX * (1 - factor));
        GZ.ty = GZ.startTy + (mid.y - GZ.startMidY) + (GZ.startMidY * (1 - factor));

        gzClampOffset(img);
        gzApply(img);
        img.style.cursor = "grab";
        return;
    }

    if (GZ.isPanning && e.touches.length === 1 && GZ.scale > 1) {
        e.preventDefault();
        GZ.tx = GZ.panTx + (e.touches[0].clientX - GZ.panStartX);
        GZ.ty = GZ.panTy + (e.touches[0].clientY - GZ.panStartY);
        gzClampOffset(img);
        gzApply(img);
        return;
    }
}

function gzTouchEnd(e) {
    const img = document.getElementById("mainGalleryImg");
    if (!img) return;

    if (GZ.isPinching) {
        GZ.isPinching = false;
        const container = document.querySelector(".gallery-main-container");
        if (container) container.style.touchAction = GZ.scale > 1 ? "none" : "pan-y";
        // Snap back to 1x if released below threshold
        if (GZ.scale < 1.05) {
            gzReset(img, true);
            if (container) container.style.touchAction = "pan-y";
        } else {
            gzClampOffset(img);
            img.style.cursor = GZ.scale > 1 ? "grab" : "zoom-in";
        }
        return;
    }

    if (GZ.isPanning) {
        GZ.isPanning = false;
        img.style.cursor = GZ.scale > 1 ? "grab" : "zoom-in";
        const container = document.querySelector(".gallery-main-container");
        if (container) container.style.touchAction = GZ.scale > 1 ? "none" : "pan-y";
    }
}


function selectImage(index) {
    if (index < 0 || index >= galleryImages.length) return;
    activeImageIdx = index;

    const mainImg = document.getElementById("mainGalleryImg");
    if (mainImg) {
        // Reset zoom state on slide change
        GZ.scale = 1; GZ.tx = 0; GZ.ty = 0;
        mainImg.style.transition = "none";
        mainImg.style.transform  = "";
        mainImg.style.cursor     = "zoom-in";

        mainImg.style.opacity = "0";
        setTimeout(() => {
            mainImg.src           = galleryImages[activeImageIdx];
            mainImg.style.opacity = "1";
        }, 200);
    }

    document.querySelectorAll(".thumb-item").forEach((el, i) => {
        el.classList.toggle("active", i === activeImageIdx);
        if (i === activeImageIdx) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    });
}

function nextImage() { if (GZ.scale <= 1) selectImage((activeImageIdx + 1) % galleryImages.length); }
function prevImage() { if (GZ.scale <= 1) selectImage((activeImageIdx - 1 + galleryImages.length) % galleryImages.length); }

function openLightbox() {
    if (GZ.scale > 1) return; // don't open lightbox while zoomed
    const lb  = document.getElementById("imageLightbox");
    const img = document.getElementById("lightboxImg");
    if (!lb || !img) return;

    img.src           = galleryImages[activeImageIdx];
    img.style.transform = "";
    img.style.opacity   = "1";
    lb.style.background = "";
    updateLbCounter();
    lb.classList.add("active");
    document.body.style.overflow = "hidden";

    const multi = galleryImages.length > 1;
    document.getElementById("lightboxPrevBtn")
        && (document.getElementById("lightboxPrevBtn").style.display = multi ? "flex" : "none");
    document.getElementById("lightboxNextBtn")
        && (document.getElementById("lightboxNextBtn").style.display = multi ? "flex" : "none");
}

function closeLightbox() {
    const lb  = document.getElementById("imageLightbox");
    const img = document.getElementById("lightboxImg");
    if (lb)  lb.classList.remove("active");
    document.body.style.overflow = "";
    // Reset any transform left by a swipe gesture
    if (img) { img.style.transition = ""; img.style.transform = ""; img.style.opacity = "1"; }
    if (lb)  lb.style.background = "";
}

function lbNavigate(dir) {
    activeImageIdx = (activeImageIdx + dir + galleryImages.length) % galleryImages.length;

    const img = document.getElementById("lightboxImg");
    if (img) {
        img.style.transition = "opacity 0.18s ease";
        img.style.opacity    = "0";
        requestAnimationFrame(() => {
            img.src           = galleryImages[activeImageIdx];
            img.style.opacity = "1";
        });
    }

    updateLbCounter();
    syncGallery(activeImageIdx);
}

function syncGallery(index) {
    const mainImg = document.getElementById("mainGalleryImg");
    if (mainImg) mainImg.src = galleryImages[index];

    document.querySelectorAll(".thumb-item").forEach((el, i) => {
        el.classList.toggle("active", i === index);
        if (i === index) el.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
    });
}

function updateLbCounter() {
    const el = document.getElementById("lightboxCounter");
    if (el) el.textContent = `${activeImageIdx + 1} / ${galleryImages.length}`;
}

// ─── Touch / Swipe ────────────────────────────────────
function onTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    swipingVert = false;
}

function onTouchMove(e) {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;

    if (Math.abs(dy) > Math.abs(dx)) {
        swipingVert = true;
        const img = document.getElementById("lightboxImg");
        const lb  = document.getElementById("imageLightbox");
        if (!img || !lb) return;

        const dist = Math.abs(dy);
        img.style.transition = "none";
        img.style.transform  = `translateY(${dy}px) scale(${Math.max(0.85, 1 - dist / 1000)})`;
        lb.style.background  = `rgba(0,0,0,${Math.max(0.4, 0.98 - dist / 500)})`;
    }
}

function onTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    const img = document.getElementById("lightboxImg");
    const lb  = document.getElementById("imageLightbox");

    // Swipe up or down to close (must be clearly more vertical than horizontal)
    if (swipingVert && Math.abs(dy) > 110 && Math.abs(dy) > Math.abs(dx)) {
        swipingVert = false;
        closeLightbox();
        return;
    }

    // Not dismissed — snap back
    if (img) { img.style.transition = "transform 0.25s ease, opacity 0.25s ease"; img.style.transform = ""; }
    if (lb)  lb.style.background = "";
    swipingVert = false;

    // Horizontal swipe to navigate
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        lbNavigate(dx > 0 ? -1 : 1);
    }
}

// ─── Keyboard ─────────────────────────────────────────
function onKeyDown(e) {
    const lb = document.getElementById("imageLightbox");
    if (!lb?.classList.contains("active")) return;

    if      (e.key === "Escape")      closeLightbox();
    else if (e.key === "ArrowLeft")   lbNavigate(-1);
    else if (e.key === "ArrowRight")  lbNavigate(1);
}

// ─── Share ────────────────────────────────────────────
async function handleShare() {
    const url = window.location.href;
    try {
        if (navigator.share) {
            await navigator.share({ title: document.title, url });
        } else {
            await navigator.clipboard.writeText(url);
            showToast(tr("copied_to_clipboard"));
        }
    } catch (err) {
        // Share cancelled (AbortError) — silently ignore
        if (err.name !== "AbortError") {
            try {
                await navigator.clipboard.writeText(url);
                showToast(tr("copied_to_clipboard"));
            } catch {
                showToast(tr("share_error"));
            }
        }
    }
}

function showToast(message) {
    const toast = document.getElementById("toastMessage");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}
