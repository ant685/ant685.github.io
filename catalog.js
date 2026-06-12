// MOTOBY — catalog.js · catalog data load, parsing, rendering & cards
"use strict";

let allMotorcycles  = [];
let filteredMotorcycles = [];
let displayCount    = 0;

// Sort the catalog list by lot number in place.
// Controlled entirely by the CONFIG.sortByLot switch in config.js — when it's
// off the original CSV order is preserved. Non-numeric lot ids go last.
function sortByLotNumber(list) {
    const cfg = window.CONFIG || {};
    if (!cfg.sortByLot) return list;
    const dir = cfg.sortByLotDirection === "asc" ? 1 : -1;
    return list.sort((a, b) => {
        const la = parseInt(a.lot, 10);
        const lb = parseInt(b.lot, 10);
        const aNaN = isNaN(la), bNaN = isNaN(lb);
        if (aNaN && bNaN) return 0;
        if (aNaN) return 1;
        if (bNaN) return -1;
        return (la - lb) * dir;
    });
}

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
    const fallbackDark  = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%2311141a"/><text x="150" y="105" fill="%238e8e93" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">MOTOBY</text></svg>`;
    const fallbackLight = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23e6e8eb"/><text x="150" y="105" fill="%236b6b70" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">MOTOBY</text></svg>`;

    const getFallback = () => {
        return document.documentElement.getAttribute("data-theme") === "light" ? fallbackLight : fallbackDark;
    };

    const isFav = Favorites.has(moto.lot);
    const heartSVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path class="heart-outline" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        <path class="heart-filled" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>`;

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
                <button class="fav-btn${isFav ? " active" : ""}" data-lot="${moto.lot}" aria-label="Add to favorites" type="button">${heartSVG}</button>
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
            img.dataset.fallback = "1";
            img.src = getFallback();
            img.classList.add("loaded");
            if (sk) sk.style.display = "none";
        });
    }

    const favBtn = card.querySelector(".fav-btn");
    if (favBtn) {
        favBtn.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            const added = Favorites.toggle(moto.lot);
            favBtn.classList.toggle("active", added);
            const favToggle = document.getElementById("toggleShowFavorites");
            if (favToggle?.checked && !added) {
                applyFilters();
            }
        });
    }

    return card;
}

// Update fallbacks when the user switches theme
window.addEventListener("motoby:themechange", () => {
    const imgs = document.querySelectorAll("img.card-img[data-fallback='1']");
    for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        img.src = isLight ?
            `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23e6e8eb"/><text x="150" y="105" fill="%236b6b70" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">MOTOBY</text></svg>` :
            `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%2311141a"/><text x="150" y="105" fill="%238e8e93" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">MOTOBY</text></svg>`;
    }
});
