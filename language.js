// MOTOBY — language.js · shared i18n core (loaded by both pages)
// Page-agnostic: pages register extra work through hooks, so this module
// never calls page-specific code directly (no reverse / mutual dependencies).
"use strict";

let activeLanguage = "EN";

const _langApplyHooks  = [];   // run on every applyTranslations()
const _langChangeHooks = [];   // run after the user switches language

function registerTranslationHook(fn)    { _langApplyHooks.push(fn); }
function registerLanguageChangeHook(fn) { _langChangeHooks.push(fn); }

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
    _langChangeHooks.forEach(fn => fn());
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
    _langApplyHooks.forEach(fn => fn());
}

function updateLangUI() {
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.lang === activeLanguage);
    });
}
