/* MOTOBY — theme.js · light/dark theme controller
   - First visit: follow the browser's prefers-color-scheme.
   - After the user clicks the toggle: remember their choice in localStorage.
   - Keep following the OS until an explicit choice is made.
   Loaded synchronously in <head> (before stylesheets) so the correct theme is
   applied before first paint — no flash of the wrong theme. */
(function () {
    "use strict";

    var STORAGE_KEY = "motoby_theme"; // "light" | "dark"
    var root = document.documentElement;

    function systemPrefersLight() {
        return typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-color-scheme: light)").matches;
    }

    function getStored() {
        try {
            var v = localStorage.getItem(STORAGE_KEY);
            return (v === "light" || v === "dark") ? v : null;
        } catch (e) { return null; }
    }

    function store(theme) {
        try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    }

    function resolveTheme() {
        var stored = getStored();
        if (stored) return stored;
        return systemPrefersLight() ? "light" : "dark";
    }

    function applyTheme(theme) {
        root.setAttribute("data-theme", theme);
        try {
            window.dispatchEvent(new CustomEvent("motoby:themechange", { detail: { theme: theme } }));
        } catch (e) {}
    }

    // Apply immediately (runs while <head> is parsed — before paint).
    applyTheme(resolveTheme());

    function currentTheme() {
        return root.getAttribute("data-theme") === "light" ? "light" : "dark";
    }

    function updateThemeUI() {
        var theme = currentTheme();
        var label = "Switch theme";
        if (typeof window.tr === "function") {
            var translated = window.tr("theme_toggle");
            if (translated && translated !== "theme_toggle") label = translated;
        }
        var buttons = document.querySelectorAll(".theme-toggle");
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
            btn.setAttribute("aria-label", label);
            btn.setAttribute("title", label);
        }
    }

    function setTheme(theme) {
        applyTheme(theme);
        store(theme);
        updateThemeUI();
    }

    function toggleTheme() {
        setTheme(currentTheme() === "light" ? "dark" : "light");
    }

    function initThemeUI() {
        var buttons = document.querySelectorAll(".theme-toggle");
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener("click", toggleTheme);
        }
        updateThemeUI();
        // Refresh the accessible label when the site language changes.
        if (typeof window.registerLanguageChangeHook === "function") {
            window.registerLanguageChangeHook(updateThemeUI);
        }
        if (typeof window.registerTranslationHook === "function") {
            window.registerTranslationHook(updateThemeUI);
        }
    }

    // Follow OS changes only while the user hasn't made an explicit choice.
    if (typeof window.matchMedia === "function") {
        var mq = window.matchMedia("(prefers-color-scheme: light)");
        var onChange = function (e) {
            if (getStored()) return;
            applyTheme(e.matches ? "light" : "dark");
            updateThemeUI();
        };
        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", onChange);
        } else if (typeof mq.addListener === "function") {
            mq.addListener(onChange);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initThemeUI);
    } else {
        initThemeUI();
    }

    window.MotobyTheme = {
        get: currentTheme,
        set: setTheme,
        toggle: toggleTheme
    };
})();
