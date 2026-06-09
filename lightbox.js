// MOTOBY — lightbox.js · fullscreen image viewer (open/close/navigate/keyboard)
"use strict";

function openLightbox() {
    const lb  = document.getElementById("imageLightbox");
    const img = document.getElementById("lightboxImg");
    if (!lb || !img) return;

    resetZoomState(false);
    img.src           = galleryImages[activeImageIdx];
    img.style.opacity   = "1";
    lb.style.background = "";
    updateLbCounter();
    lb.classList.add("active");
    document.body.style.overflow = "hidden";

    const multi = galleryImages.length > 1;
    document.getElementById("lightboxPrevBtn")
        && (document.getElementById("lightboxPrevBtn").style.display = multi ? "flex" : "none");
    document.getElementById("lightboxNextBtn")
        && (document.getElementById("lightboxNextBtn").style.display = multi ? "flex" : "none");
}

function closeLightbox() {
    const lb = document.getElementById("imageLightbox");
    if (lb) lb.classList.remove("active");
    document.body.style.overflow = "";
    if (lb) lb.style.background = "";
    resetZoomState(false);
}

function lbNavigate(dir) {
    if (zoomScale > 1) return;
    activeImageIdx = (activeImageIdx + dir + galleryImages.length) % galleryImages.length;

    const img = document.getElementById("lightboxImg");
    if (img) {
        img.style.transition = "opacity 0.18s ease";
        img.style.opacity    = "0";
        requestAnimationFrame(() => {
            img.src           = galleryImages[activeImageIdx];
            img.style.opacity = "1";
        });
    }

    updateLbCounter();
    syncGallery(activeImageIdx);
}

function syncGallery(index) {
    const mainImg = document.getElementById("mainGalleryImg");
    if (mainImg) mainImg.src = galleryImages[index];

    document.querySelectorAll(".thumb-item").forEach((el, i) => {
        el.classList.toggle("active", i === index);
        if (i === index) el.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
    });
}

function updateLbCounter() {
    const el = document.getElementById("lightboxCounter");
    if (el) el.textContent = `${activeImageIdx + 1} / ${galleryImages.length}`;
}

function onKeyDown(e) {
    const lb = document.getElementById("imageLightbox");
    if (!lb?.classList.contains("active")) return;

    if      (e.key === "Escape")                       closeLightbox();
    else if (e.key === "ArrowLeft"  && zoomScale <= 1) lbNavigate(-1);
    else if (e.key === "ArrowRight" && zoomScale <= 1) lbNavigate(1);
}
