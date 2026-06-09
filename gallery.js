// MOTOBY — gallery.js · product image gallery + thumbnails
"use strict";

let galleryImages   = [];
let activeImageIdx  = 0;

async function loadGallery(lotId) {
    galleryImages  = [];
    activeImageIdx = 0;

    const thumbs = document.getElementById("galleryThumbs");
    if (thumbs) thumbs.innerHTML = "";

    // Check images sequentially — stops after 2 consecutive missing files
    const MAX          = 40;
    let consecutiveMiss = 0;

    for (let i = 1; i <= MAX; i++) {
        const url = `images/lot${lotId}/${i}.jpg`;
        const found = await probeImage(url);
        if (found) {
            galleryImages.push(url);
            consecutiveMiss = 0;
        } else {
            consecutiveMiss++;
            if (consecutiveMiss >= 2) break;
        }
    }

    if (galleryImages.length === 0) {
        galleryImages.push(makePlaceholder(lotId));
    }

    renderGallery();
}

function probeImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload  = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

function makePlaceholder(lotId) {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%2311141a"/><text x="300" y="210" fill="%238e8e93" font-size="18" font-weight="bold" text-anchor="middle" font-family="sans-serif">LOT ${lotId}</text></svg>`;
}

function renderGallery() {
    const mainImg = document.getElementById("mainGalleryImg");
    const thumbs  = document.getElementById("galleryThumbs");
    const prevBtn = document.getElementById("galleryPrevBtn");
    const nextBtn = document.getElementById("galleryNextBtn");

    if (mainImg) {
        mainImg.src            = galleryImages[activeImageIdx];
        mainImg.style.opacity  = "1";
    }

    const multi = galleryImages.length > 1;
    if (prevBtn) prevBtn.style.display = multi ? "flex" : "none";
    if (nextBtn) nextBtn.style.display = multi ? "flex" : "none";

    if (!thumbs) return;
    thumbs.innerHTML = "";
    galleryImages.forEach((src, idx) => {
        const item = document.createElement("div");
        item.className = `thumb-item${idx === activeImageIdx ? " active" : ""}`;
        item.innerHTML = `<img src="${src}" alt="Photo ${idx + 1}" class="thumb-img" loading="lazy">`;
        item.addEventListener("click", () => selectImage(idx));
        thumbs.appendChild(item);
    });
}

function selectImage(index) {
    if (index < 0 || index >= galleryImages.length) return;
    activeImageIdx = index;

    const mainImg = document.getElementById("mainGalleryImg");
    if (mainImg) {
        mainImg.style.opacity = "0";
        setTimeout(() => {
            mainImg.src           = galleryImages[activeImageIdx];
            mainImg.style.opacity = "1";
        }, 200);
    }

    document.querySelectorAll(".thumb-item").forEach((el, i) => {
        el.classList.toggle("active", i === activeImageIdx);
        if (i === activeImageIdx) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    });
}

function nextImage() { selectImage((activeImageIdx + 1) % galleryImages.length); }
function prevImage() { selectImage((activeImageIdx - 1 + galleryImages.length) % galleryImages.length); }
