// MOTOBY — filters.js · brand filter, filtering logic, results counter
"use strict";

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
    const togFav = document.getElementById("toggleShowFavorites");
    if (togFav) togFav.checked = false;
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
    const showFavs = document.getElementById("toggleShowFavorites")?.checked ?? false;

    filteredMotorcycles = allMotorcycles.filter(m => {
        if (!showSold && (m.status || "").toLowerCase().trim() === "sold") return false;
        if (showFavs && !Favorites.has(m.lot)) return false;

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

    const hasFilters = !!(q || brand || yearFrom || engFrom || engTo || showFavs);
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
