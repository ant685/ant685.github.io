// MOTOBY — main.js
"use strict";

history.scrollRestoration = 'manual';

let allMotorcycles  = [];
let filteredMotorcycles = [];
let displayCount    = 0;
let activeLanguage  = "EN";

// ─── Init ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initLanguage();
    loadConfiguration();
    setupEventListeners();
    loadCatalogData().catch(err => console.error("Catalog load failed:", err));
    setupScrollHandler();
    setupHeaderContacts();
});

// ─── Configuration ────────────────────────────────────
function loadConfiguration() {
    const cfg = window.CONFIG || {};
    document.title = `${cfg.siteName || "MOTOBY"} - Premium Used Motorcycles`;

    const el = id => document.getElementById(id);

    const tg = el("contactTelegram");
    if (tg) tg.href = cfg.telegram || "#";

    const wa = el("contactWhatsapp");
    if (wa) wa.href = cfg.whatsapp || "#";

    const em = el("contactEmail");
    if (em && cfg.email) {
        em.href = `mailto:${cfg.email}`;
        const txt = el("contactEmailText");
        if (txt) txt.textContent = cfg.email;
    }
}

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
    renderCatalog(); // re-render so status labels update
    const hasFilters = !!(
        (document.getElementById("searchInput")?.value || "").trim() ||
        document.getElementById("filterBrand")?.value ||
        document.getElementById("filterYearFrom")?.value ||
        document.getElementById("filterEngineFrom")?.value ||
        document.getElementById("filterEngineTo")?.value
    );
    updateCounter(filteredMotorcycles.length, hasFilters);
}

/** Shorthand: get translated string for key */
function tr(key) {
    return window.TRANSLATIONS?.[activeLanguage]?.[key] ?? key;
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const val = tr(el.getAttribute("data-i18n"));
        if (val) el.textContent = val;
    });

    const placeholders = {
        searchInput:      "search_placeholder",
        filterYearFrom:   "year_from",
        filterYearTo:     "year_to",
        filterEngineFrom: "engine_from",
        filterEngineTo:   "engine_to",
    };

    for (const [id, key] of Object.entries(placeholders)) {
        const el = document.getElementById(id);
        const val = tr(key);
        if (el && val !== key) el.placeholder = val;
    }

    const sel = document.getElementById("filterBrand");
    if (sel?.options[0]) sel.options[0].textContent = tr("brand_filter_all");

    updateToggleLabel();
}

function updateToggleLabel() {
    const el = document.querySelector(".toggle-label");
    if (!el) return;
    const val = tr("show_sold");
    if (activeLanguage !== "EN" && window.innerWidth < 768) {
        const idx = val.indexOf(" ");
        el.innerHTML = idx > -1
            ? val.slice(0, idx) + "<br>" + val.slice(idx + 1)
            : val;
    } else {
        el.textContent = val;
    }
}

function updateLangUI() {
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.lang === activeLanguage);
    });
}

// ─── Event listeners ──────────────────────────────────
function setupEventListeners() {
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
    });

    [
        { id: "searchInput",      ev: "input"  },
        { id: "filterBrand",      ev: "change" },
        { id: "filterYearFrom",   ev: "input"  },
        { id: "filterEngineFrom", ev: "input"  },
        { id: "filterEngineTo",   ev: "input"  },
        { id: "toggleShowSold",   ev: "change" },
    ].forEach(({ id, ev }) => {
        document.getElementById(id)?.addEventListener(ev, applyFilters);
    });

    document.getElementById("btnResetFilters")?.addEventListener("click", resetFilters);
    document.getElementById("btnLoadMore")?.addEventListener("click", loadMore);

    // Save catalog state when navigating to a product card
    document.getElementById("catalogGrid")?.addEventListener("click", e => {
        if (e.target.closest(".card-link")) saveSessionState();
    });

    let _resizeTmr;
    window.addEventListener("resize", () => {
        clearTimeout(_resizeTmr);
        _resizeTmr = setTimeout(() => {
            updateToggleLabel();
            const hasFilters = !!(
                (document.getElementById("searchInput")?.value || "").trim() ||
                document.getElementById("filterBrand")?.value ||
                document.getElementById("filterYearFrom")?.value ||
                document.getElementById("filterEngineFrom")?.value ||
                document.getElementById("filterEngineTo")?.value
            );
            updateCounter(filteredMotorcycles.length, hasFilters);
        }, 150);
    }, { passive: true });
}

function setupScrollHandler() {
    const header = document.querySelector("header");
    if (!header) return;
    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 20);
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
        const langW     = (document.querySelector(".lang-switcher")?.offsetWidth || 0);
        const contactsW = contacts.scrollWidth;
        const padding   = 40;
        // icon-only when contacts + lang + safety margin exceed half the container
        // (logo is centred absolutely, so each side gets ~half)
        const sideAvail = (available - padding) / 2;
        if (contactsW > sideAvail) {
            contacts.classList.add("icon-only");
        }
    };

    check();
    window.addEventListener("resize", check, { passive: true });
}

// ─── CSV loading ──────────────────────────────────────
async function loadCatalogData() {
    try {
        const res = await fetch("motorcycles.csv");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allMotorcycles = parseCSV(await res.text());
        buildBrandFilter();

        const saved = getSavedState();
        if (saved) restoreFilterValues(saved);

        applyFilters();

        if (saved && saved.displayCount > displayCount) {
            displayCount = Math.min(saved.displayCount, filteredMotorcycles.length);
            renderCatalog();
        }

        sessionStorage.removeItem("motoby_catalog_state");

        if (saved?.scrollY > 0) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                window.scrollTo(0, saved.scrollY);
            }));
        }
    } catch (err) {
        const grid = document.getElementById("catalogGrid");
        if (grid) {
            grid.innerHTML = `<div class="no-results-state"><p style="color:var(--color-red)">
                Error loading catalog. Please check motorcycles.csv.</p></div>`;
        }
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

// ─── Filters ──────────────────────────────────────────
function buildBrandFilter() {
    const sel = document.getElementById("filterBrand");
    if (!sel) return;

    const brands = [...new Set(
        allMotorcycles.map(m => m.brand).filter(b => b && b !== "NA")
    )].sort();

    sel.innerHTML = `<option value="">${tr("brand_filter_all")}</option>`;
    brands.forEach(b => {
        const opt = document.createElement("option");
        opt.value = opt.textContent = b;
        sel.appendChild(opt);
    });
}

function resetFilters() {
    ["searchInput","filterBrand","filterYearFrom","filterEngineFrom","filterEngineTo"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    const tog = document.getElementById("toggleShowSold");
    if (tog) tog.checked = false;
    applyFilters();
}

function getIntVal(id) {
    return parseInt(document.getElementById(id)?.value) || null;
}

function applyFilters() {
    const q        = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
    const brand    = document.getElementById("filterBrand")?.value || "";
    const yearFrom = getIntVal("filterYearFrom");
    const engFrom  = getIntVal("filterEngineFrom");
    const engTo    = getIntVal("filterEngineTo");
    const showSold = document.getElementById("toggleShowSold")?.checked ?? false;

    filteredMotorcycles = allMotorcycles.filter(m => {
        if (!showSold && (m.status || "").toLowerCase().trim() === "sold") return false;

        if (q) {
            const lot   = (m.lot   || "").toLowerCase();
            const model = (m.model || "").toLowerCase();
            const br    = (m.brand || "").toLowerCase();
            if (!lot.includes(q) && !model.includes(q) && !br.includes(q)) return false;
        }

        if (brand && m.brand !== brand) return false;

        const year = parseInt(m.year);
        if (!isNaN(year)) {
            if (yearFrom && year < yearFrom) return false;
        } else if (yearFrom) return false;

        const eng = parseInt(m.engine_cc);
        if (!isNaN(eng)) {
            if (engFrom && eng < engFrom) return false;
            if (engTo   && eng > engTo)   return false;
        } else if (engFrom || engTo) return false;

        return true;
    });

    const hasFilters = !!(q || brand || yearFrom || engFrom || engTo);
    updateCounter(filteredMotorcycles.length, hasFilters);

    const pageSize = getPageSize();
    displayCount = Math.min(pageSize, filteredMotorcycles.length);
    renderCatalog();
}

function updateCounter(count, hasFilters) {
    const el = document.getElementById("resultsCounter");
    if (!el) return;

    const lang  = activeLanguage;
    const label = hasFilters ? tr("counter_found") : tr("counter_total");

    let unit;
    if (lang === "RU") {
        const m = count % 10, h = count % 100;
        if (h >= 11 && h <= 19)        unit = tr("counter_unit_many");
        else if (m === 1)              unit = tr("counter_unit");
        else if (m >= 2 && m <= 4)    unit = tr("counter_unit_few");
        else                           unit = tr("counter_unit_many");
    } else if (lang === "PL") {
        if (count === 1)               unit = tr("counter_unit");
        else if (count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14))
                                       unit = tr("counter_unit_few");
        else                           unit = tr("counter_unit_many");
    } else {
        unit = count !== 1 ? tr("counter_unit_many") : tr("counter_unit");
    }

    const prefix = `<span class="counter-prefix">${label}:</span>`;
    const value  = `<span class="counter-value"><span class="counter-num">${count}</span> ${unit}</span>`;

    el.innerHTML = (window.innerWidth < 768 && lang !== "EN")
        ? `${prefix}<br>${value}`
        : `${prefix} ${value}`;
}

// ─── Rendering ────────────────────────────────────────
function getPageSize() {
    return window.innerWidth < 768 ? 9 : 12;
}

function loadMore() {
    const pageSize = getPageSize();
    displayCount += Math.min(pageSize, filteredMotorcycles.length - displayCount);
    renderCatalog();
}

function renderCatalog() {
    const grid       = document.getElementById("catalogGrid");
    const loadMoreBtn = document.getElementById("btnLoadMore");
    if (!grid) return;

    if (filteredMotorcycles.length === 0) {
        grid.innerHTML = `
            <div class="no-results-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <p>${tr("no_results")}</p>
            </div>`;
        if (loadMoreBtn) loadMoreBtn.style.display = "none";
        return;
    }

    grid.innerHTML = "";
    filteredMotorcycles.slice(0, displayCount).forEach((moto, idx) => {
        const card = createCard(moto);
        card.style.animationDelay = `${Math.min(idx, 12) * 40}ms`;
        grid.appendChild(card);
    });

    if (loadMoreBtn) {
        loadMoreBtn.style.display = displayCount < filteredMotorcycles.length ? "block" : "none";
    }
}

function createCard(moto) {
    const brand  = (moto.brand && moto.brand !== "NA") ? moto.brand : "MOTORCYCLE";
    const model  = (moto.model && moto.model !== "NA") ? moto.model : "Premium Lot";
    const status = (moto.status || "").toLowerCase().trim();
    const locale = activeLanguage === "RU" ? "ru-RU" : "en-US";

    const statusMap = {
        available:  { label: tr("status_available"),  cls: "badge-available"  },
        reserved:   { label: tr("status_reserved"),   cls: "badge-reserved"   },
        in_transit: { label: tr("status_in_transit"), cls: "badge-in_transit" },
        sold:       { label: tr("status_sold"),        cls: "badge-sold"       },
    };
    const { label: statusLabel, cls: badgeCls } =
        statusMap[status] || { label: moto.status || "", cls: "badge-available" };

    const fmtNum = v => { const n = Number(v); return isNaN(n) ? v : n.toLocaleString(locale); };

    const spec = (icon, rawVal, unit = "") =>
        rawVal && rawVal !== "NA"
            ? `<div class="spec-item">${icon}<span>${rawVal}${unit ? " " + unit : ""}</span></div>`
            : `<div class="spec-item"></div>`;

    const icoEngine = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66L12 5h1l-1 7h3.5c.49 0 .54.34.22.68L11 21z"/></svg>`;
    const icoMile   = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
    const icoYear   = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.89 4 3.01 4.9 3.01 6L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>`;
    const icoLoc    = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

    const mileVal = moto.mileage && moto.mileage !== "NA" ? fmtNum(moto.mileage) : null;

    const specsHTML = [
        spec(icoEngine, moto.engine_cc, tr("engine_unit")),
        spec(icoMile,   mileVal,        tr("mileage_unit")),
        spec(icoYear,   moto.year),
        spec(icoLoc,    moto.location),
    ].join("");

    const price = moto.price && moto.price !== "NA" && moto.price !== ""
        ? `€${Number(moto.price).toLocaleString(locale)}`
        : "";

    const imgSrc   = `images/lot${moto.lot}/1.jpg`;
    const fallback = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%2311141a"/><text x="150" y="105" fill="%238e8e93" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">MOTOBY</text></svg>`;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <a href="product.html?lot=${encodeURIComponent(moto.lot)}" class="card-link">
            <div class="card-media">
                <div class="skeleton" id="sk-${moto.lot}"></div>
                <img src="${imgSrc}" alt="${brand} ${model}" class="card-img" id="ci-${moto.lot}" loading="lazy">
                <div class="card-badge-left">
                    <span class="badge ${badgeCls}">${statusLabel}</span>
                </div>
            </div>
            <div class="card-info">
                <div class="card-title-row">
                    <h3 class="card-title">${brand} ${model}</h3>
                    <span class="card-lot-badge">${tr("lot_prefix")} ${moto.lot}</span>
                </div>
                <div class="card-specs">${specsHTML}</div>
                <div class="card-footer-row">
                    <div class="card-price">${price}</div>
                    <div class="card-view-link">
                        <span>${tr("view_details")}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>
            </div>
        </a>`;

    const img = card.querySelector(`#ci-${moto.lot}`);
    const sk  = card.querySelector(`#sk-${moto.lot}`);

    if (img) {
        img.addEventListener("load", () => {
            img.classList.add("loaded");
            if (sk) sk.style.display = "none";
        });
        img.addEventListener("error", () => {
            img.src = fallback;
            img.classList.add("loaded");
            if (sk) sk.style.display = "none";
        });
    }

    return card;
}

// ─── Session State ────────────────────────────────────
function saveSessionState() {
    try {
        sessionStorage.setItem("motoby_catalog_state", JSON.stringify({
            scrollY:      window.scrollY,
            search:       document.getElementById("searchInput")?.value      || "",
            brand:        document.getElementById("filterBrand")?.value       || "",
            yearFrom:     document.getElementById("filterYearFrom")?.value    || "",
            engineFrom:   document.getElementById("filterEngineFrom")?.value  || "",
            engineTo:     document.getElementById("filterEngineTo")?.value    || "",
            showSold:     document.getElementById("toggleShowSold")?.checked  || false,
            displayCount: displayCount
        }));
    } catch (_) {}
}

function getSavedState() {
    try {
        const raw = sessionStorage.getItem("motoby_catalog_state");
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function restoreFilterValues(state) {
    const setEl = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    setEl("searchInput",      state.search);
    setEl("filterBrand",      state.brand);
    setEl("filterYearFrom",   state.yearFrom);
    setEl("filterEngineFrom", state.engineFrom);
    setEl("filterEngineTo",   state.engineTo);
    const tog = document.getElementById("toggleShowSold");
    if (tog) tog.checked = !!state.showSold;
}
