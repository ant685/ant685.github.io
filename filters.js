// MOTOBY — filters.js · brand filter, filtering logic, results counter
"use strict";

// ─── Multi-brand dropdown state ──────────────────────
let _selectedBrands = new Set(); // empty = "All Brands"
let _brandDropdownOpen = false;

function buildBrandFilter() {
    const wrapper = document.getElementById("brandDropdownWrapper");
    if (!wrapper) return;

    const brands = [...new Set(
        allMotorcycles.map(m => m.brand).filter(b => b && b !== "NA")
    )].sort();

    _renderBrandDropdown(brands);
}

function _brandCounts() {
    // Counts over the full catalog (independent of active filters).
    const counts = Object.create(null);
    for (const m of allMotorcycles) {
        const b = m.brand;
        if (b && b !== "NA") counts[b] = (counts[b] || 0) + 1;
    }
    return counts;
}

function _renderBrandDropdown(brands) {
    const wrapper = document.getElementById("brandDropdownWrapper");
    if (!wrapper) return;

    const counts = _brandCounts();

    wrapper.innerHTML = `
        <button type="button" class="brand-dropdown-btn" id="brandDropdownBtn" aria-haspopup="listbox" aria-expanded="false">
            ${tr("brand_filter_all")}
        </button>
        <div class="brand-dropdown-menu" id="brandDropdownMenu" role="listbox">
            <div class="brand-dropdown-item" id="brandItemAll" data-brand="">
                <input type="checkbox" id="brandChkAll" checked>
                <label for="brandChkAll">${tr("brand_filter_all")}</label>
            </div>
            <div class="brand-dropdown-separator"></div>
            ${brands.map((b, i) => `
            <div class="brand-dropdown-item" data-brand="${b}" id="brandItem_${i}">
                <input type="checkbox" id="brandChk_${i}">
                <label for="brandChk_${i}">${b}</label>
                <span class="brand-count">(${counts[b] || 0})</span>
            </div>`).join("")}
        </div>`;

    document.getElementById("brandDropdownBtn")
        .addEventListener("click", e => { e.stopPropagation(); _toggleBrandDropdown(); });

    wrapper.querySelectorAll(".brand-dropdown-item").forEach(item => {
        item.addEventListener("click", e => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "LABEL") return;
            const chk = item.querySelector("input[type='checkbox']");
            if (chk) { chk.checked = !chk.checked; _onBrandCheck(item.dataset.brand, chk.checked); }
        });
        const chk = item.querySelector("input[type='checkbox']");
        if (chk) chk.addEventListener("change", () => _onBrandCheck(item.dataset.brand, chk.checked));
        const lbl = item.querySelector("label");
        if (lbl) lbl.addEventListener("click", e => {
            e.preventDefault();
            const c = item.querySelector("input[type='checkbox']");
            c.checked = !c.checked;
            _onBrandCheck(item.dataset.brand, c.checked);
        });
    });
}

function _onBrandCheck(brand, checked) {
    if (brand === "") {
        // "All brands" clicked
        if (checked) {
            _selectedBrands.clear();
        } else {
            // prevent unchecking "All" if nothing else selected
            if (_selectedBrands.size === 0) {
                const chk = document.getElementById("brandChkAll");
                if (chk) chk.checked = true;
                return;
            }
        }
    } else {
        if (checked) {
            _selectedBrands.add(brand);
        } else {
            _selectedBrands.delete(brand);
        }
        if (_selectedBrands.size === 0) {
            // auto-select "All"
        }
    }
    _syncBrandCheckboxes();
    _updateBrandBtnLabel();
    applyFilters();
}

function _syncBrandCheckboxes() {
    const allChk = document.getElementById("brandChkAll");
    if (allChk) allChk.checked = _selectedBrands.size === 0;

    const allItem = document.getElementById("brandItemAll");
    if (allItem) allItem.classList.toggle("selected", _selectedBrands.size === 0);

    document.querySelectorAll("#brandDropdownMenu .brand-dropdown-item[data-brand]").forEach(item => {
        if (item.dataset.brand === "") return;
        const chk = item.querySelector("input[type='checkbox']");
        const sel = _selectedBrands.has(item.dataset.brand);
        if (chk) chk.checked = sel;
        item.classList.toggle("selected", sel);
    });
}

function _updateBrandBtnLabel() {
    const btn = document.getElementById("brandDropdownBtn");
    if (!btn) return;
    if (_selectedBrands.size === 0) {
        btn.textContent = tr("brand_filter_all");
        btn.classList.remove("has-selection");
    } else if (_selectedBrands.size === 1) {
        btn.textContent = [..._selectedBrands][0];
        btn.classList.add("has-selection");
    } else {
        const n = _selectedBrands.size;
        btn.textContent = _brandCountLabel(n);
        btn.classList.add("has-selection");
    }
}

function _brandCountLabel(n) {
    const lang = activeLanguage;
    if (lang === "RU") {
        const m = n % 10, h = n % 100;
        let word;
        if (h >= 11 && h <= 19)      word = "брендов";
        else if (m === 1)            word = "бренд";
        else if (m >= 2 && m <= 4)   word = "бренда";
        else                         word = "брендов";
        return `${n} ${word}`;
    } else if (lang === "PL") {
        let word;
        if (n === 1)                                                      word = "marka";
        else if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) word = "marki";
        else                                                              word = "marek";
        return `${n} ${word}`;
    } else {
        return `${n} brand${n !== 1 ? "s" : ""}`;
    }
}

function _toggleBrandDropdown() {
    _brandDropdownOpen = !_brandDropdownOpen;
    const menu = document.getElementById("brandDropdownMenu");
    const btn  = document.getElementById("brandDropdownBtn");
    if (menu) menu.classList.toggle("open", _brandDropdownOpen);
    if (btn)  { btn.classList.toggle("open", _brandDropdownOpen); btn.setAttribute("aria-expanded", _brandDropdownOpen); }
}

function _closeBrandDropdown() {
    if (!_brandDropdownOpen) return;
    _brandDropdownOpen = false;
    const menu = document.getElementById("brandDropdownMenu");
    const btn  = document.getElementById("brandDropdownBtn");
    if (menu) menu.classList.remove("open");
    if (btn)  { btn.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
}

function resetFilters() {
    ["searchInput","filterYearFrom","filterEngineFrom","filterEngineTo"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    const tog = document.getElementById("toggleShowSold");
    if (tog) tog.checked = false;
    const togFav = document.getElementById("toggleShowFavorites");
    if (togFav) togFav.checked = false;
    _selectedBrands.clear();
    _syncBrandCheckboxes();
    _updateBrandBtnLabel();
    _closeBrandDropdown();
    applyFilters();
}

function getIntVal(id) {
    return parseInt(document.getElementById(id)?.value) || null;
}

function applyFilters() {
    const q        = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
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

        if (_selectedBrands.size > 0 && !_selectedBrands.has(m.brand)) return false;

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

    const hasFilters = !!(q || _selectedBrands.size > 0 || yearFrom || engFrom || engTo || showFavs);
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
