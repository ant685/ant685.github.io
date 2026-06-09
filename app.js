// MOTOBY — app.js · catalog entry point: bootstraps the page and wires events
"use strict";

history.scrollRestoration = 'manual';

// Catalog-specific language behaviour, registered into the shared language core.
registerTranslationHook(() => {
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
});

registerLanguageChangeHook(() => {
    renderCatalog(); // re-render so status labels update
    const hasFilters = !!(
        (document.getElementById("searchInput")?.value || "").trim() ||
        document.getElementById("filterBrand")?.value ||
        document.getElementById("filterYearFrom")?.value ||
        document.getElementById("filterEngineFrom")?.value ||
        document.getElementById("filterEngineTo")?.value
    );
    updateCounter(filteredMotorcycles.length, hasFilters);
});

// ─── Init ─────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initLanguage();
    loadConfiguration();
    setupEventListeners();
    loadCatalogData().catch(err => console.error("Catalog load failed:", err));
    setupScrollHandler();
    setupHeaderContacts();
});

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
