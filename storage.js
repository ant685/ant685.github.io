// MOTOBY — storage.js · catalog session persistence (scroll, filters, page size)
"use strict";

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
