// MOTOBY main.js

let allMotorcycles = [];
let filteredMotorcycles = [];
let currentDisplayCount = 0;
let activeLanguage = "EN";

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Initialize Application
async function initApp() {
    loadConfiguration();
    initLanguage();
    setupEventListeners();
    await loadCatalogData();
    setupScrollHandler();
}

// Load configurations from config.js
function loadConfiguration() {
    const config = window.CONFIG || {
        siteName: "MOTOBY",
        telegram: "#",
        whatsapp: "#",
        email: "info@example.com",
        itemsPerPage: 20
    };

    // Set page title
    document.title = `${config.siteName} - Premium Used Motorcycles`;

    // Set header links
    const telegramBtn = document.getElementById("contactTelegram");
    if (telegramBtn) telegramBtn.href = config.telegram;

    const whatsappBtn = document.getElementById("contactWhatsapp");
    if (whatsappBtn) whatsappBtn.href = config.whatsapp;

    const emailBtn = document.getElementById("contactEmail");
    if (emailBtn) {
        emailBtn.href = `mailto:${config.email}`;
        const emailText = document.getElementById("contactEmailText");
        if (emailText) emailText.textContent = config.email;
    }
}

// Language Settings Manager
function initLanguage() {
    const savedLang = localStorage.getItem("motoby_lang");
    if (savedLang && window.TRANSLATIONS[savedLang]) {
        activeLanguage = savedLang;
    } else {
        // Auto-detect system language
        const sysLang = navigator.language || navigator.userLanguage || "en";
        const prefix = sysLang.substring(0, 2).toUpperCase();
        if (window.TRANSLATIONS[prefix]) {
            activeLanguage = prefix;
        } else {
            activeLanguage = "EN";
        }
        localStorage.setItem("motoby_lang", activeLanguage);
    }

    applyTranslations();
    updateLangSwitcherUI();
}

// Switch active language
function setLanguage(lang) {
    if (!window.TRANSLATIONS[lang]) return;
    activeLanguage = lang;
    localStorage.setItem("motoby_lang", lang);
    applyTranslations();
    updateLangSwitcherUI();
    
    // Re-render catalog to translate statuses or dynamic fields
    renderCatalog();

    // Refresh counter text in new language
    const counter = document.getElementById("resultsCounter");
    if (counter) {
        const searchQuery = document.getElementById("searchInput").value.toLowerCase().trim();
        const selectedBrand = document.getElementById("filterBrand").value;
        const yearFrom = parseInt(document.getElementById("filterYearFrom").value) || null;
        const yearTo = parseInt(document.getElementById("filterYearTo").value) || null;
        const engineFrom = parseInt(document.getElementById("filterEngineFrom").value) || null;
        const engineTo = parseInt(document.getElementById("filterEngineTo").value) || null;
        const hasActiveFilters = searchQuery !== "" || selectedBrand !== "" ||
            yearFrom !== null || yearTo !== null || engineFrom !== null || engineTo !== null;
        counter.innerHTML = buildCounterHTML(filteredMotorcycles.length, hasActiveFilters);
    }
}

// Apply translations to UI elements
function applyTranslations() {
    const t = window.TRANSLATIONS[activeLanguage];
    if (!t) return;

    // Translate standard static texts with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (t[key]) {
            el.textContent = t[key];
        }
    });

    // Translate placeholders
    const searchInput = document.getElementById("searchInput");
    if (searchInput && t.search_placeholder) {
        searchInput.placeholder = t.search_placeholder;
    }

    const yearFrom = document.getElementById("filterYearFrom");
    if (yearFrom && t.year_from) yearFrom.placeholder = t.year_from;

    const yearTo = document.getElementById("filterYearTo");
    if (yearTo && t.year_to) yearTo.placeholder = t.year_to;

    const engineFrom = document.getElementById("filterEngineFrom");
    if (engineFrom && t.engine_from) engineFrom.placeholder = t.engine_from;

    const engineTo = document.getElementById("filterEngineTo");
    if (engineTo && t.engine_to) engineTo.placeholder = t.engine_to;

    // Reset default select option
    const brandSelect = document.getElementById("filterBrand");
    if (brandSelect && brandSelect.options[0]) {
        brandSelect.options[0].textContent = t.brand_filter_all;
    }
}

// Highlight Active Language Button
function updateLangSwitcherUI() {
    document.querySelectorAll(".lang-btn").forEach(btn => {
        if (btn.getAttribute("data-lang") === activeLanguage) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

// Attach all necessary UI Event Listeners
function setupEventListeners() {
    // Language switcher
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setLanguage(btn.getAttribute("data-lang"));
        });
    });

    // Filters event listeners for instant filtering
    document.getElementById("searchInput").addEventListener("input", handleFiltersChange);
    document.getElementById("filterBrand").addEventListener("change", handleFiltersChange);
    document.getElementById("filterYearFrom").addEventListener("input", handleFiltersChange);
    document.getElementById("filterYearTo").addEventListener("input", handleFiltersChange);
    document.getElementById("filterEngineFrom").addEventListener("input", handleFiltersChange);
    document.getElementById("filterEngineTo").addEventListener("input", handleFiltersChange);
    document.getElementById("toggleShowSold").addEventListener("change", handleFiltersChange);

    // Reset Filters button
    document.getElementById("btnResetFilters").addEventListener("click", resetFilters);

    // Load More button
    document.getElementById("btnLoadMore").addEventListener("click", loadMoreItems);
}

// Shrink header on scroll event
function setupScrollHandler() {
    window.addEventListener("scroll", () => {
        const header = document.querySelector("header");
        if (header) {
            if (window.scrollY > 20) {
                header.classList.add("scrolled");
            } else {
                header.classList.remove("scrolled");
            }
        }
    }, { passive: true });
}

// Fetch and Parse CSV Catalog
async function loadCatalogData() {
    try {
        const response = await fetch("motorcycles.csv");
        if (!response.ok) {
            throw new Error(`Failed to fetch catalog. Status: ${response.status}`);
        }
        const csvText = await response.text();
        allMotorcycles = parseCSV(csvText);
        
        buildBrandFilter();
        applyFilters(true); // first run
    } catch (error) {
        console.error("Error loading CSV catalog data:", error);
        document.getElementById("catalogGrid").innerHTML = `
            <div class="no-results-state">
                <p style="color: #ff453a; font-weight: 600;">Error loading catalog. Please check if motorcycles.csv exists and is well-formatted.</p>
            </div>
        `;
    }
}

// Robust custom CSV parser to support quoted descriptions with commas
function parseCSV(text) {
    let lines = [];
    let row = [""];
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let next = text[i+1];
        
        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push("");
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') {
                i++;
            }
            lines.push(row);
            row = [""];
        } else {
            row[row.length - 1] += c;
        }
    }
    
    if (row.length > 1 || row[0] !== "") {
        lines.push(row);
    }
    
    if (lines.length === 0) return [];

    const headers = lines[0].map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < headers.length) continue; // skip blank/invalid rows
        
        let motorcycleObj = {};
        let isValidRow = false;
        
        headers.forEach((header, index) => {
            const val = line[index] ? line[index].trim() : "";
            motorcycleObj[header] = val;
            if (val !== "") isValidRow = true;
        });

        if (isValidRow && motorcycleObj.lot) {
            result.push(motorcycleObj);
        }
    }
    return result;
}

// Populate the Brand dropdown menu from CSV values dynamically
function buildBrandFilter() {
    const brandSelect = document.getElementById("filterBrand");
    if (!brandSelect) return;

    // Get distinct sorted brands (excluding NA / blank)
    const brandsSet = new Set();
    allMotorcycles.forEach(moto => {
        if (moto.brand && moto.brand !== "NA" && moto.brand !== "") {
            brandsSet.add(moto.brand);
        }
    });

    const sortedBrands = Array.from(brandsSet).sort();

    // Clear previous dynamic options
    brandSelect.innerHTML = `<option value="" data-i18n="brand_filter_all">${window.TRANSLATIONS[activeLanguage].brand_filter_all}</option>`;
    
    sortedBrands.forEach(brand => {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        brandSelect.appendChild(option);
    });
}

// Reset all filters to default state
function resetFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("filterBrand").value = "";
    document.getElementById("filterYearFrom").value = "";
    document.getElementById("filterYearTo").value = "";
    document.getElementById("filterEngineFrom").value = "";
    document.getElementById("filterEngineTo").value = "";
    document.getElementById("toggleShowSold").checked = false;

    applyFilters();
}

// Handle trigger event on any filter update
function handleFiltersChange() {
    applyFilters();
}

// Filter core implementation
function applyFilters(isFirstLoad = false) {
    const searchQuery = document.getElementById("searchInput").value.toLowerCase().trim();
    const selectedBrand = document.getElementById("filterBrand").value;
    const yearFrom = parseInt(document.getElementById("filterYearFrom").value) || null;
    const yearTo = parseInt(document.getElementById("filterYearTo").value) || null;
    const engineFrom = parseInt(document.getElementById("filterEngineFrom").value) || null;
    const engineTo = parseInt(document.getElementById("filterEngineTo").value) || null;
    const showSold = document.getElementById("toggleShowSold").checked;

    filteredMotorcycles = allMotorcycles.filter(moto => {
        // Status filter: ignore "sold" if toggle "Show Sold" is OFF
        const status = moto.status ? moto.status.toLowerCase().trim() : "";
        if (!showSold && status === "sold") {
            return false;
        }

        // Search Query filter: matches lot number or model name
        if (searchQuery !== "") {
            const lotStr = moto.lot ? moto.lot.toLowerCase() : "";
            const modelStr = moto.model ? moto.model.toLowerCase() : "";
            const brandStr = moto.brand ? moto.brand.toLowerCase() : "";
            const matchLot = lotStr.includes(searchQuery);
            const matchModel = modelStr.includes(searchQuery) || brandStr.includes(searchQuery);
            if (!matchLot && !matchModel) {
                return false;
            }
        }

        // Brand filter
        if (selectedBrand && moto.brand !== selectedBrand) {
            return false;
        }

        // Year filter range
        const motoYear = parseInt(moto.year);
        if (!isNaN(motoYear)) {
            if (yearFrom && motoYear < yearFrom) return false;
            if (yearTo && motoYear > yearTo) return false;
        } else if (yearFrom || yearTo) {
            // If year criteria is set but moto year is NA, exclude it
            return false;
        }

        // Engine size filter range
        const motoEngine = parseInt(moto.engine_cc);
        if (!isNaN(motoEngine)) {
            if (engineFrom && motoEngine < engineFrom) return false;
            if (engineTo && motoEngine > engineTo) return false;
        } else if (engineFrom || engineTo) {
            return false;
        }

        return true;
    });

    // Detect if any filter is active
    const hasActiveFilters = searchQuery !== "" || selectedBrand !== "" ||
        yearFrom !== null || yearTo !== null ||
        engineFrom !== null || engineTo !== null;

    // Update results counter
    updateResultsCounter(filteredMotorcycles.length, hasActiveFilters);

    // Reset pagination
    currentDisplayCount = Math.min(window.CONFIG.itemsPerPage, filteredMotorcycles.length);
    renderCatalog();
}

// Show/update results counter — inside filter panel on desktop, below on mobile
function updateResultsCounter(count, hasActiveFilters) {
    // Remove old counter from wherever it was
    const existing = document.getElementById("resultsCounter");
    if (existing) existing.remove();

    const counter = document.createElement("div");
    counter.id = "resultsCounter";
    counter.innerHTML = buildCounterHTML(count, hasActiveFilters);

    const filterSection = document.querySelector(".search-filter-section");
    if (!filterSection) return;

    if (window.innerWidth >= 601) {
        // Desktop: append inside the filter panel, after the filters-grid
        counter.className = "results-counter-desktop";
        filterSection.appendChild(counter);
    } else {
        // Mobile: insert after the filter panel as a separate element
        counter.className = "results-counter-mobile";
        if (filterSection.parentNode) {
            filterSection.parentNode.insertBefore(counter, filterSection.nextSibling);
        }
    }
}

function buildCounterHTML(count, hasActiveFilters) {
    const lang = activeLanguage;
    const n = `<span class="counter-number">${count}</span>`;
    if (hasActiveFilters) {
        if (lang === "RU") return `Найдено: ${n} лот${getRuPlural(count)}`;
        if (lang === "PL") return `Znaleziono: ${n} lot${count === 1 ? "" : "ów"}`;
        return `Found: ${n} lot${count !== 1 ? "s" : ""}`;
    } else {
        if (lang === "RU") return `Всего: ${n} лот${getRuPlural(count)}`;
        if (lang === "PL") return `Łącznie: ${n} lot${count === 1 ? "" : "ów"}`;
        return `Total: ${n} lot${count !== 1 ? "s" : ""}`;
    }
}

function getRuPlural(n) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return "ов";
    if (mod10 === 1) return "";
    if (mod10 >= 2 && mod10 <= 4) return "а";
    return "ов";
}

// Load more action
function loadMoreItems() {
    const remainingCount = filteredMotorcycles.length - currentDisplayCount;
    const nextBatchSize = Math.min(window.CONFIG.itemsPerPage, remainingCount);
    currentDisplayCount += nextBatchSize;
    renderCatalog();
}

// Render dynamic elements to the page
function renderCatalog() {
    const grid = document.getElementById("catalogGrid");
    if (!grid) return;

    grid.innerHTML = "";

    if (filteredMotorcycles.length === 0) {
        const noResultsText = window.TRANSLATIONS[activeLanguage].no_results || "No motorcycles matched filters.";
        grid.innerHTML = `
            <div class="no-results-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <p style="font-size: 1.1rem; font-weight: 500;">${noResultsText}</p>
            </div>
        `;
        document.getElementById("btnLoadMore").style.display = "none";
        return;
    }

    // Get current slice
    const visibleBatch = filteredMotorcycles.slice(0, currentDisplayCount);

    visibleBatch.forEach(moto => {
        const card = createCardElement(moto);
        grid.appendChild(card);
    });

    // Handle "Load More" button visibility
    const loadMoreBtn = document.getElementById("btnLoadMore");
    if (loadMoreBtn) {
        if (currentDisplayCount < filteredMotorcycles.length) {
            loadMoreBtn.style.display = "block";
        } else {
            loadMoreBtn.style.display = "none";
        }
    }
}

// Create individual product card node (Clean structure - Location overlay removed from photo)
function createCardElement(moto) {
    const card = document.createElement("div");
    card.className = "card";
    
    // Setup detail page link
    const productURL = `product.html?lot=${moto.lot}`;
    
    // Status translation / colors
    const statusKey = moto.status ? moto.status.toLowerCase().trim() : "";
    let statusLabel = "";
    let badgeClass = "";

    if (statusKey === "available") {
        statusLabel = window.TRANSLATIONS[activeLanguage].status_available;
        badgeClass = "badge-available";
    } else if (statusKey === "reserved") {
        statusLabel = window.TRANSLATIONS[activeLanguage].status_reserved;
        badgeClass = "badge-reserved";
    } else if (statusKey === "in_transit") {
        statusLabel = window.TRANSLATIONS[activeLanguage].status_in_transit;
        badgeClass = "badge-in_transit";
    } else if (statusKey === "sold") {
        statusLabel = window.TRANSLATIONS[activeLanguage].status_sold;
        badgeClass = "badge-sold";
    } else {
        statusLabel = moto.status;
        badgeClass = "badge-available";
    }

    // Check values
    const brandName = (moto.brand && moto.brand !== "NA") ? moto.brand : "MOTORCYCLE";
    const modelName = (moto.model && moto.model !== "NA") ? moto.model : "Premium Lot";
    
    // Render specs column by column (Highly stable inline solid fill SVG icons)
    let specsHTML = "";
    
    if (moto.engine_cc && moto.engine_cc !== "NA") {
        specsHTML += `
            <div class="spec-item">
                <svg viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.1-.2.11-.21C8.75 10.5 12 5 12 5h1l-1 7h3.5c.49 0 .54.34.22.68-.32.34-.1.1-.22.22L11 21z"/></svg>
                <span>${moto.engine_cc} ${window.TRANSLATIONS[activeLanguage].engine_unit}</span>
            </div>
        `;
    } else {
        specsHTML += `<div class="spec-item"></div>`;
    }

    if (moto.mileage && moto.mileage !== "NA") {
        const formattedMileage = Number(moto.mileage).toLocaleString(activeLanguage === "RU" ? "ru-RU" : "en-US");
        specsHTML += `
            <div class="spec-item">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                <span>${formattedMileage} ${window.TRANSLATIONS[activeLanguage].mileage_unit}</span>
            </div>
        `;
    } else {
        specsHTML += `<div class="spec-item"></div>`;
    }

    if (moto.year && moto.year !== "NA") {
        specsHTML += `
            <div class="spec-item">
                <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
                <span>${moto.year}</span>
            </div>
        `;
    } else {
        specsHTML += `<div class="spec-item"></div>`;
    }

    if (moto.location && moto.location !== "NA") {
        specsHTML += `
            <div class="spec-item">
                <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                <span>${moto.location}</span>
            </div>
        `;
    } else {
        specsHTML += `<div class="spec-item"></div>`;
    }

    // First image source try: images/lot${moto.lot}/1.jpg
    const mainImgSrc = `images/lot${moto.lot}/1.jpg`;
    
    // Price value
    let priceHTML = "";
    if (moto.price && moto.price !== "NA" && moto.price !== "") {
        const formattedPrice = Number(moto.price).toLocaleString(activeLanguage === "RU" ? "ru-RU" : "en-US");
        priceHTML = `€${formattedPrice}`;
    }

    card.innerHTML = `
        <a href="${productURL}" style="display: flex; flex-direction: column; height: 100%;">
            <div class="card-media">
                <div class="skeleton" id="skel-${moto.lot}"></div>
                <img src="${mainImgSrc}" alt="${brandName} ${modelName}" class="card-img" id="img-${moto.lot}">
                
                <!-- Overlay Elements: Only status badge remains on the top-left with 100% opaque dark grey background -->
                <div class="card-badge-left">
                    <span class="badge ${badgeClass}">${statusLabel}</span>
                </div>
            </div>
            
            <div class="card-info">
                <!-- Brand + Model in one white row, lot number in orange on right -->
                <div class="card-title-row">
                    <h3 class="card-title">${brandName} ${modelName}</h3>
                    <span class="card-lot-badge">LOT ${moto.lot}</span>
                </div>
                
                <!-- Specs grid with restored original icons and orange texts -->
                <div class="card-specs">
                    ${specsHTML}
                </div>
                
                <!-- Footer row containing price and View Details -->
                <div class="card-footer-row">
                    <div class="card-price">${priceHTML}</div>
                    <div class="card-view-link">
                        <span>${(window.TRANSLATIONS[activeLanguage] && window.TRANSLATIONS[activeLanguage].view_details) ? window.TRANSLATIONS[activeLanguage].view_details : (activeLanguage === "RU" ? "Подробнее" : activeLanguage === "PL" ? "Szczegóły" : "View Details")}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>
            </div>
        </a>
    `;

    // Process lazy picture load & image errors
    const imgEl = card.querySelector(`#img-${moto.lot}`);
    const skelEl = card.querySelector(`#skel-${moto.lot}`);

    if (imgEl) {
        imgEl.onload = () => {
            imgEl.classList.add("loaded");
            if (skelEl) skelEl.style.display = "none";
        };

        imgEl.onerror = () => {
            // Replace with a beautiful custom inline SVG profile as a premium placeholder
            imgEl.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" style="background:%2311141a; font-family:-apple-system,BlinkMacSystemFont,sans-serif;"><rect width="300" height="200" fill="%2311141a"/><circle cx="150" cy="85" r="30" stroke="%233a3f4d" stroke-width="2" fill="none"/><path d="M120,135 L135,110 L165,110 L180,135 Z" stroke="%233a3f4d" stroke-width="2" fill="none"/><text x="150" y="160" fill="%238e8e93" font-size="14" font-weight="bold" text-anchor="middle">MOTOBY</text></svg>`;
            imgEl.classList.add("loaded");
            if (skelEl) skelEl.style.display = "none";
        };
    }

    return card;
}
