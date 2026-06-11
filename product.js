// MOTOBY — product.js · product page entry point & core logic
"use strict";

let currentLotId    = null;
let currentMoto     = null;

// Product-specific language behaviour, registered into the shared language core.
registerLanguageChangeHook(() => {
    if (currentMoto) populateUI(currentMoto);
});

document.addEventListener("DOMContentLoaded", () => {
    initLanguage();
    parseLotParam();
    loadConfiguration();
    setupScrollHandler();
    setupHeaderContacts();
    setupThemeLogo();
    if (currentLotId) {
        loadProductData().catch(err => console.error("Product load failed:", err));
    } else {
        showNotFound();
    }
});

function setupThemeLogo() {
    const logo = document.querySelector("img[data-theme-logo]");
    if (!logo) return;

    const update = () => {
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        logo.src = isLight ? "logo-light.png" : "logo.png";
    };

    update();
    window.addEventListener("motoby:themechange", update);
}

function parseLotParam() {
    try {
        const lot = new URLSearchParams(window.location.search).get("lot");
        if (lot) currentLotId = lot.trim();
    } catch (e) {
        console.error("URL parse error:", e);
    }
}

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

    // Share button
    document.getElementById("btnShareAction")?.addEventListener("click", handleShare);

    // Favorites button
    const favBtn = document.getElementById("productFavBtn");
    if (favBtn && currentLotId) {
        favBtn.classList.toggle("active", Favorites.has(currentLotId));
        favBtn.addEventListener("click", () => {
            const added = Favorites.toggle(currentLotId);
            favBtn.classList.toggle("active", added);
        });
    }

    // Lightbox touch: swipe + pinch-to-zoom
    setupPinchZoom();
}

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
