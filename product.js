// MOTOBY product.js

let currentLotId = null;
let currentMotorcycle = null;
let activeLanguage = "EN";
let loadedImages = [];
let activeImageIndex = 0;

// Touch swipe tracking variables
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isDraggingVertical = false;

document.addEventListener("DOMContentLoaded", () => {
    initProductApp();
});

// Main Page Initialization
async function initProductApp() {
    initLanguage();
    parseQueryParam();
    loadConfiguration();
    setupScrollHandler();
    
    if (currentLotId) {
        await loadProductData();
    } else {
        showProductNotFound();
    }
}

// Language Settings Manager
function initLanguage() {
    const savedLang = localStorage.getItem("motoby_lang");
    if (savedLang && window.TRANSLATIONS[savedLang]) {
        activeLanguage = savedLang;
    } else {
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
    
    // Refresh motorcycle fields in the new language
    if (currentMotorcycle) {
        populateProductUI(currentMotorcycle);
    }
}

// Apply translated texts to DOM
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

// Read 'lot' parameter from url query string
function parseQueryParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const lot = urlParams.get("lot");
    if (lot) {
        currentLotId = lot.trim();
    }
}

// Load contacts info from config.js
function loadConfiguration() {
    const config = window.CONFIG || {
        siteName: "MOTOBY",
        telegram: "#",
        whatsapp: "#",
        email: "info@example.com"
    };

    // Header Links
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

// Shrink header on scroll event
function setupScrollHandler() {
    window.addEventListener("scroll", () => {
        const header = document.querySelector("header");
        if (header) {
            if (window.scrollY > 30) {
                header.classList.add("scrolled");
            } else {
                header.classList.remove("scrolled");
            }
        }
    }, { passive: true });
}

// Load catalog data to find specific motorcycle
async function loadProductData() {
    try {
        const response = await fetch("motorcycles.csv");
        if (!response.ok) {
            throw new Error(`Failed to fetch catalog. Status: ${response.status}`);
        }
        const csvText = await response.text();
        const motorcycles = parseCSV(csvText);
        
        // Find motorcycle matching lot id
        currentMotorcycle = motorcycles.find(m => {
            const mId = m.lot ? m.lot.trim() : "";
            return mId === currentLotId || parseInt(mId) === parseInt(currentLotId);
        });

        if (currentMotorcycle) {
            document.getElementById("productLayout").style.display = "grid";
            document.getElementById("lotNotFoundBlock").style.display = "none";
            
            // Set Page Title
            const config = window.CONFIG || { siteName: "MOTOBY" };
            const brand = currentMotorcycle.brand !== "NA" ? currentMotorcycle.brand : "";
            const model = currentMotorcycle.model !== "NA" ? currentMotorcycle.model : "";
            document.title = `${brand} ${model} - Lot ${currentMotorcycle.lot} | ${config.siteName}`;

            populateProductUI(currentMotorcycle);
            setupEventListeners();
            await loadProductImages(currentMotorcycle.lot);
        } else {
            showProductNotFound();
        }
    } catch (error) {
        console.error("Error loading product detail data:", error);
        showProductNotFound();
    }
}

// Simple CSV Parser
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
        if (line.length < headers.length) continue;
        
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

// Populates fields & translates tags
function populateProductUI(moto) {
    const t = window.TRANSLATIONS[activeLanguage];

    // Main header lot display
    const lotDisplay = moto.lot ? `LOT ${moto.lot}` : "LOT --";
    document.getElementById("productLotText").textContent = lotDisplay;

    // Title
    const brandName = (moto.brand && moto.brand !== "NA") ? moto.brand : "";
    const modelName = (moto.model && moto.model !== "NA") ? moto.model : "";
    document.getElementById("productTitle").textContent = `${brandName} ${modelName}`.trim() || "Motorcycle";

    // Status Badge setup
    const statusKey = moto.status ? moto.status.toLowerCase().trim() : "";
    let statusLabel = "";
    let badgeClass = "";
    
    if (statusKey === "available") {
        statusLabel = t.status_available;
        badgeClass = "badge-available";
    } else if (statusKey === "reserved") {
        statusLabel = t.status_reserved;
        badgeClass = "badge-reserved";
    } else if (statusKey === "in_transit") {
        statusLabel = t.status_in_transit;
        badgeClass = "badge-in_transit";
    } else if (statusKey === "sold") {
        statusLabel = t.status_sold;
        badgeClass = "badge-sold";
    } else {
        statusLabel = moto.status;
        badgeClass = "badge-available";
    }
    document.getElementById("productStatusBadgeContainer").innerHTML = `<span class="badge ${badgeClass}">${statusLabel}</span>`;

    // Price section: hidden if NA
    const priceContainer = document.getElementById("productPriceContainer");
    if (moto.price && moto.price !== "NA" && moto.price !== "") {
        priceContainer.style.display = "block";
        const formattedPrice = Number(moto.price).toLocaleString(activeLanguage === "RU" ? "ru-RU" : "en-US");
        document.getElementById("productPrice").textContent = `$${formattedPrice}`;
    } else {
        priceContainer.style.display = "none";
    }

    // Spec rows: hidden if NA
    const renderSpecRow = (rowId, valId, key, rawVal, unit = "") => {
        const rowEl = document.getElementById(rowId);
        const valEl = document.getElementById(valId);
        if (rawVal && rawVal !== "NA" && rawVal !== "") {
            rowEl.style.display = "flex";
            if (unit !== "") {
                const num = Number(rawVal);
                const displayVal = !isNaN(num) ? num.toLocaleString(activeLanguage === "RU" ? "ru-RU" : "en-US") : rawVal;
                valEl.textContent = `${displayVal} ${unit}`;
            } else {
                if (key === "condition") {
                    const condTranslation = t[`condition_${rawVal}`] || rawVal;
                    valEl.textContent = condTranslation;
                } else {
                    valEl.textContent = rawVal;
                }
            }
        } else {
            rowEl.style.display = "none";
        }
    };

    renderSpecRow("rowLot", "specLot", "lot", moto.lot);
    // Brand + Model are merged into a single "Model" row on the product page.
    const rowBrandEl = document.getElementById("rowBrand");
    if (rowBrandEl) rowBrandEl.style.display = "none";
    const combinedModel = `${moto.brand || ""} ${moto.model || ""}`.trim();
    renderSpecRow("rowModel", "specModel", "model", combinedModel);
    renderSpecRow("rowYear", "specYear", "year", moto.year);
    renderSpecRow("rowEngine", "specEngine", "engine", moto.engine_cc, t.engine_unit);
    renderSpecRow("rowMileage", "specMileage", "mileage", moto.mileage, t.mileage_unit);
    renderSpecRow("rowLocation", "specLocation", "location", moto.location);
    renderSpecRow("rowCondition", "specCondition", "condition", moto.condition);

    // Description text section
    const descPanel = document.getElementById("descPanel");
    if (moto.description && moto.description !== "NA" && moto.description !== "") {
        descPanel.style.display = "block";
        document.getElementById("descText").textContent = moto.description;
    } else {
        descPanel.style.display = "none";
    }

    // Set Premium Dynamic Action URLs for WhatsApp & Telegram
    const config = window.CONFIG || {};
    const encodedText = encodeURIComponent(`Hello, I am interested in Lot ${moto.lot}: ${brandName} ${modelName} ($${moto.price || "NA"})`);
    
    // Telegram Direct URL
    const btnActionTelegram = document.getElementById("btnActionTelegram");
    if (config.telegram) {
        if (config.telegram.includes("t.me/")) {
            const handle = config.telegram.split("t.me/")[1];
            btnActionTelegram.href = `https://t.me/${handle}?text=${encodedText}`;
        } else {
            btnActionTelegram.href = config.telegram;
        }
    }

    // WhatsApp Direct URL
    const btnActionWhatsapp = document.getElementById("btnActionWhatsapp");
    if (config.whatsapp) {
        let phone = config.whatsapp;
        if (phone.includes("wa.me/")) {
            phone = phone.split("wa.me/")[1];
        }
        phone = phone.replace(/\D/g, "");
        btnActionWhatsapp.href = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
    }
}

// Show standard Not Found Screen
function showProductNotFound() {
    document.getElementById("productLayout").style.display = "none";
    document.getElementById("lotNotFoundBlock").style.display = "block";
}

// Async dynamic image scan loop
async function loadProductImages(lotId) {
    const mainImg = document.getElementById("mainGalleryImg");
    const thumbsContainer = document.getElementById("galleryThumbs");
    thumbsContainer.innerHTML = "";
    
    loadedImages = [];
    activeImageIndex = 0;

    let index = 1;
    let keepScanning = true;
    const maxChecks = 40; // absolute boundary limit

    mainImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200' style='background:%2311141a;'><rect width='300' height='200' fill='%2311141a'/><text x='150' y='110' fill='%238e8e93' font-size='14' text-anchor='middle'>Scanning Images...</text></svg>";

    while (keepScanning && index <= maxChecks) {
        const url = `images/lot${lotId}/${index}.jpg`;
        const exists = await checkImageExists(url);
        
        if (exists) {
            loadedImages.push(url);
            index++;
        } else {
            keepScanning = false;
        }
    }

    // If zero images scanned successfully, load dynamic mock fallback emblem
    if (loadedImages.length === 0) {
        const placeholderSVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:%2311141a; font-family:-apple-system,BlinkMacSystemFont,sans-serif;"><rect width="600" height="400" fill="%2311141a"/><circle cx="300" cy="170" r="50" stroke="%232c323f" stroke-width="4" fill="none"/><path d="M250,250 L275,210 L325,210 L350,250 Z" stroke="%232c323f" stroke-width="4" fill="none"/><text x="300" y="295" fill="%238e8e93" font-size="20" font-weight="bold" text-anchor="middle">LOT ${lotId}</text><text x="300" y="325" fill="%2348484a" font-size="14" text-anchor="middle">No Images Found</text></svg>`;
        loadedImages.push(placeholderSVG);
    }

    renderGallery();
}

// Image load validation promise
function checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// Setup and display photo gallery nodes
function renderGallery() {
    const mainImg = document.getElementById("mainGalleryImg");
    const thumbsContainer = document.getElementById("galleryThumbs");
    thumbsContainer.innerHTML = "";

    mainImg.src = loadedImages[activeImageIndex];

    const arrowPrev = document.getElementById("galleryPrevBtn");
    const arrowNext = document.getElementById("galleryNextBtn");
    if (loadedImages.length <= 1) {
        arrowPrev.style.display = "none";
        arrowNext.style.display = "none";
    } else {
        arrowPrev.style.display = "flex";
        arrowNext.style.display = "flex";
    }

    loadedImages.forEach((src, idx) => {
        const thumb = document.createElement("div");
        thumb.className = `thumb-item ${idx === activeImageIndex ? "active" : ""}`;
        thumb.innerHTML = `<img src="${src}" alt="Lot thumbnail ${idx+1}" class="thumb-img">`;
        
        thumb.addEventListener("click", () => {
            selectGalleryImage(idx);
        });

        thumbsContainer.appendChild(thumb);
    });
}

// Select main gallery image by index
function selectGalleryImage(index) {
    if (index < 0 || index >= loadedImages.length) return;
    
    activeImageIndex = index;
    const mainImg = document.getElementById("mainGalleryImg");
    mainImg.style.opacity = 0; 
    
    setTimeout(() => {
        mainImg.src = loadedImages[activeImageIndex];
        mainImg.style.opacity = 1; 
    }, 150);

    document.querySelectorAll(".thumb-item").forEach((thumb, idx) => {
        if (idx === activeImageIndex) {
            thumb.classList.add("active");
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            thumb.classList.remove("active");
        }
    });
}

// Next photo action
function nextGalleryImage() {
    let nextIdx = activeImageIndex + 1;
    if (nextIdx >= loadedImages.length) {
        nextIdx = 0; 
    }
    selectGalleryImage(nextIdx);
}

// Prev photo action
function prevGalleryImage() {
    let prevIdx = activeImageIndex - 1;
    if (prevIdx < 0) {
        prevIdx = loadedImages.length - 1; 
    }
    selectGalleryImage(prevIdx);
}

// Setup detail page event handlers
function setupEventListeners() {
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setLanguage(btn.getAttribute("data-lang"));
        });
    });

    document.getElementById("galleryPrevBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        prevGalleryImage();
    });
    
    document.getElementById("galleryNextBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        nextGalleryImage();
    });

    document.getElementById("mainGalleryImg").addEventListener("click", () => {
        openLightbox();
    });

    document.getElementById("lightboxCloseBtn").addEventListener("click", closeLightbox);
    document.getElementById("imageLightbox").addEventListener("click", (e) => {
        if (e.target.id === "imageLightbox" || e.target.classList.contains("lightbox-content")) {
            closeLightbox();
        }
    });

    document.getElementById("lightboxPrevBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        navigateLightbox(-1);
    });

    document.getElementById("lightboxNextBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        navigateLightbox(1);
    });

    document.addEventListener("keydown", handleKeyDown);

    const lightboxContainer = document.getElementById("imageLightbox");
    lightboxContainer.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isDraggingVertical = false;
    }, {passive: true});

    lightboxContainer.addEventListener("touchmove", (e) => {
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = e.changedTouches[0].screenY - touchStartY;
        // Treat as "drag to close" when the move is mostly vertical (up OR down)
        if (Math.abs(dy) > Math.abs(dx)) {
            isDraggingVertical = true;
            const lightboxImg = document.getElementById("lightboxImg");
            if (lightboxImg) {
                const dist = Math.abs(dy);
                lightboxImg.style.transition = "none";
                lightboxImg.style.transform = `translateY(${dy}px) scale(${Math.max(0.85, 1 - dist / 1000)})`;
                const lb = document.getElementById("imageLightbox");
                lb.style.background = `rgba(0, 0, 0, ${Math.max(0.4, 0.98 - dist / 500)})`;
            }
        }
    }, {passive: true});

    lightboxContainer.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipeGesture();
    }, {passive: true});

    document.getElementById("btnShareAction").addEventListener("click", handleShareAction);
}

// Open Lightbox Fullscreen mode
function openLightbox() {
    const lightbox = document.getElementById("imageLightbox");
    const lightboxImg = document.getElementById("lightboxImg");
    
    lightboxImg.src = loadedImages[activeImageIndex];
    lightboxImg.style.transition = "";
    lightboxImg.style.transform = "";
    lightbox.style.background = "";
    updateLightboxCounter();
    
    lightbox.classList.add("active");
    document.body.style.overflow = "hidden"; 

    const prevBtn = document.getElementById("lightboxPrevBtn");
    const nextBtn = document.getElementById("lightboxNextBtn");
    if (loadedImages.length <= 1) {
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
    } else {
        prevBtn.style.display = "flex";
        nextBtn.style.display = "flex";
    }
}

// Close Lightbox Fullscreen mode
function closeLightbox() {
    const lightbox = document.getElementById("imageLightbox");
    lightbox.classList.remove("active");
    document.body.style.overflow = ""; 
}

// Navigate inside fullscreen lightbox
function navigateLightbox(direction) {
    let newIndex = activeImageIndex + direction;
    if (newIndex >= loadedImages.length) {
        newIndex = 0;
    } else if (newIndex < 0) {
        newIndex = loadedImages.length - 1;
    }

    activeImageIndex = newIndex;

    // Swap the lightbox image immediately for a snappy feel, fade via CSS only.
    const lightboxImg = document.getElementById("lightboxImg");
    lightboxImg.style.transition = "opacity 0.18s ease";
    lightboxImg.style.transform = "";
    lightboxImg.style.opacity = "0";

    requestAnimationFrame(() => {
        lightboxImg.src = loadedImages[activeImageIndex];
        lightboxImg.style.opacity = "1";
    });

    updateLightboxCounter();

    // Keep the underlying gallery in sync, but WITHOUT the heavy fade/smooth-scroll
    // that was making navigation feel sluggish.
    syncGalleryState(activeImageIndex);
}

// Lightweight sync of the main gallery + thumbnails (no animation/jank)
function syncGalleryState(index) {
    const mainImg = document.getElementById("mainGalleryImg");
    if (mainImg) mainImg.src = loadedImages[index];

    document.querySelectorAll(".thumb-item").forEach((thumb, idx) => {
        if (idx === index) {
            thumb.classList.add("active");
            thumb.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
        } else {
            thumb.classList.remove("active");
        }
    });
}

// Dynamic counter text
function updateLightboxCounter() {
    document.getElementById("lightboxCounter").textContent = `${activeImageIndex + 1} / ${loadedImages.length}`;
}

// Mobile Slide Swipe detection
function handleSwipeGesture() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const lightboxImg = document.getElementById("lightboxImg");
    const lb = document.getElementById("imageLightbox");

    // Vertical swipe UP or DOWN to close (must be clearly more vertical than horizontal)
    if (isDraggingVertical && Math.abs(deltaY) > 110 && Math.abs(deltaY) > Math.abs(deltaX)) {
        closeLightbox();
        // reset visuals after closing so the next open is clean
        if (lightboxImg) {
            lightboxImg.style.transition = "";
            lightboxImg.style.transform = "";
        }
        if (lb) lb.style.background = "";
        isDraggingVertical = false;
        return;
    }

    // Not dismissed: snap the image back into place
    if (lightboxImg) {
        lightboxImg.style.transition = "transform 0.25s ease, opacity 0.25s ease";
        lightboxImg.style.transform = "";
    }
    if (lb) lb.style.background = "";
    isDraggingVertical = false;

    // Horizontal swipe to navigate (only if it wasn't a vertical drag)
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
            navigateLightbox(-1);
        } else {
            navigateLightbox(1);
        }
    }
}

// Keyboard arrow controls support
function handleKeyDown(e) {
    const lightbox = document.getElementById("imageLightbox");
    if (!lightbox.classList.contains("active")) return;

    if (e.key === "Escape") {
        closeLightbox();
    } else if (e.key === "ArrowLeft") {
        navigateLightbox(-1);
    } else if (e.key === "ArrowRight") {
        navigateLightbox(1);
    }
}

// Share function via Web Share API or Clipboard Copy
async function handleShareAction() {
    const shareData = {
        title: document.title,
        text: `Check out this motorcycle lot on MOTOBY!`,
        url: window.location.href
    };

    const t = window.TRANSLATIONS[activeLanguage];

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            console.log("Web Share cancelled or unsupported:", error);
        }
    } else {
        try {
            await navigator.clipboard.writeText(window.location.href);
            showToast(t.copied_to_clipboard);
        } catch (error) {
            console.error("Clipboard copy failed:", error);
            showToast(t.share_error);
        }
    }
}

// Premium visual feedback toast popup
function showToast(message) {
    const toast = document.getElementById("toastMessage");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}
