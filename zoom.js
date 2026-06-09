// MOTOBY — zoom.js · lightbox touch gestures: swipe-to-close, pinch & double-tap zoom
"use strict";

let touchStartX = 0, touchStartY = 0;
let touchEndX   = 0, touchEndY   = 0;
let swipingVert = false;

// Pinch-to-zoom state (lightbox only)
let zoomScale = 1, zoomTX = 0, zoomTY = 0;
let isPinching = false, isPanning = false;
let initPinchDist = 0, initScale = 1, initTX = 0, initTY = 0;
let lbNatCX = 0, lbNatCY = 0;       // natural center of lightbox img in viewport
let lbAnchorLX = 0, lbAnchorLY = 0; // pinch anchor in image local coords
let zPanStartX = 0, zPanStartY = 0;
// Double-tap state
let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
let doubleTapPending = false;
const ZOOM_MAX = 4;
const DOUBLE_TAP_ZOOM = 2;

function setupPinchZoom() {
    const lb = document.getElementById("imageLightbox");
    if (!lb) return;
    lb.addEventListener("touchstart",  onLbTouchStart,  { passive: false });
    lb.addEventListener("touchmove",   onLbTouchMove,   { passive: false });
    lb.addEventListener("touchend",    onLbTouchEnd,    { passive: false });
    lb.addEventListener("touchcancel", onLbTouchCancel, { passive: false });
}

function zPinchDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function applyZoomTransform(animated) {
    const img = document.getElementById("lightboxImg");
    if (!img) return;
    clampZoomOffset();
    img.style.transition = animated ? "transform 0.2s ease" : "none";
    img.style.transform  = `translate(${zoomTX}px, ${zoomTY}px) scale(${zoomScale})`;
}

function clampZoomOffset() {
    if (zoomScale <= 1) { zoomTX = 0; zoomTY = 0; return; }
    const img = document.getElementById("lightboxImg");
    if (!img) return;
    const iw    = img.offsetWidth;
    const ih    = img.offsetHeight;
    const maxTX = Math.max(0, (iw * zoomScale - window.innerWidth)  / 2);
    const maxTY = Math.max(0, (ih * zoomScale - window.innerHeight) / 2);
    zoomTX = Math.max(-maxTX, Math.min(maxTX, zoomTX));
    zoomTY = Math.max(-maxTY, Math.min(maxTY, zoomTY));
}

function resetZoomState(animated) {
    zoomScale = 1; zoomTX = 0; zoomTY = 0;
    isPinching = false; isPanning = false;
    const img = document.getElementById("lightboxImg");
    if (!img) return;
    if (animated) {
        img.style.transition = "transform 0.2s ease";
        img.style.transform  = "translate(0px, 0px) scale(1)";
        setTimeout(() => { if (img) { img.style.transition = ""; img.style.transform = ""; } }, 220);
    } else {
        img.style.transition = "";
        img.style.transform  = "";
        img.style.opacity    = "1";
    }
}

function onLbTouchStart(e) {
    const t = e.touches;

    if (t.length === 2) {
        // Cancel any pending double-tap detection
        doubleTapPending = false;
        e.preventDefault();
        isPinching    = true;
        isPanning     = false;
        initPinchDist = zPinchDist(t[0], t[1]);
        initScale     = zoomScale;
        initTX        = zoomTX;
        initTY        = zoomTY;
        const pmx = (t[0].clientX + t[1].clientX) / 2;
        const pmy = (t[0].clientY + t[1].clientY) / 2;
        const img = document.getElementById("lightboxImg");
        if (img) {
            const rect = img.getBoundingClientRect();
            lbNatCX    = rect.left + rect.width  / 2 - initTX;
            lbNatCY    = rect.top  + rect.height / 2 - initTY;
            lbAnchorLX = (pmx - lbNatCX - initTX) / (initScale || 1);
            lbAnchorLY = (pmy - lbNatCY - initTY) / (initScale || 1);
        }

    } else if (t.length === 1) {
        const now  = Date.now();
        const cx   = t[0].clientX;
        const cy   = t[0].clientY;
        const ddx  = cx - lastTapX;
        const ddy  = cy - lastTapY;
        const img  = document.getElementById("lightboxImg");

        // Check double-tap: within 300ms, within 30px, touch on the image
        const onImage = img && (() => {
            const rect = img.getBoundingClientRect();
            return cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
        })();

        if (now - lastTapTime < 300 && Math.sqrt(ddx * ddx + ddy * ddy) < 30 && onImage) {
            e.preventDefault();
            doubleTapPending = false;
            lastTapTime = 0;

            if (zoomScale > 1) {
                // Already zoomed → reset to 1x
                resetZoomState(true);
            } else {
                // At 1x → zoom to 2x centered on tap point
                const targetScale = DOUBLE_TAP_ZOOM;
                if (img) {
                    const rect  = img.getBoundingClientRect();
                    const natCX = rect.left + rect.width  / 2;
                    const natCY = rect.top  + rect.height / 2;
                    zoomScale   = targetScale;
                    zoomTX      = (natCX - cx) * (targetScale - 1);
                    zoomTY      = (natCY - cy) * (targetScale - 1);
                    applyZoomTransform(true);
                }
            }
            return;
        }

        lastTapTime = now;
        lastTapX    = cx;
        lastTapY    = cy;

        if (zoomScale > 1) {
            // Pan mode while zoomed
            e.preventDefault();
            isPanning  = true;
            isPinching = false;
            zPanStartX = cx - zoomTX;
            zPanStartY = cy - zoomTY;
        } else {
            // Normal swipe tracking (close / navigate)
            touchStartX = t[0].screenX;
            touchStartY = t[0].screenY;
            swipingVert = false;
        }
    }
}

function onLbTouchMove(e) {
    const t = e.touches;

    if (isPinching && t.length >= 2) {
        e.preventDefault();
        const dist     = zPinchDist(t[0], t[1]);
        const newScale = Math.max(1, Math.min(ZOOM_MAX, initScale * dist / initPinchDist));
        const curMidX  = (t[0].clientX + t[1].clientX) / 2;
        const curMidY  = (t[0].clientY + t[1].clientY) / 2;
        zoomScale = newScale;
        zoomTX    = curMidX - lbNatCX - lbAnchorLX * newScale;
        zoomTY    = curMidY - lbNatCY - lbAnchorLY * newScale;
        applyZoomTransform(false);

    } else if (isPanning && t.length === 1 && zoomScale > 1) {
        e.preventDefault();
        zoomTX = t[0].clientX - zPanStartX;
        zoomTY = t[0].clientY - zPanStartY;
        applyZoomTransform(false);

    } else if (!isPinching && !isPanning && zoomScale <= 1 && t.length === 1) {
        // Swipe-to-close gesture
        const dx = t[0].screenX - touchStartX;
        const dy = t[0].screenY - touchStartY;
        if (Math.abs(dy) > Math.abs(dx)) {
            swipingVert = true;
            const img = document.getElementById("lightboxImg");
            const lb  = document.getElementById("imageLightbox");
            if (!img || !lb) return;
            const dist = Math.abs(dy);
            img.style.transition = "none";
            img.style.transform  = `translateY(${dy}px) scale(${Math.max(0.85, 1 - dist / 1000)})`;
            lb.style.background  = `rgba(0,0,0,${Math.max(0.4, 0.98 - dist / 500)})`;
        }
    }
}

function onLbTouchEnd(e) {
    const remaining = e.touches.length;

    if (remaining === 0) {
        if (isPinching && zoomScale < 1.05) resetZoomState(true);
        const wasActive = isPinching || isPanning;
        isPinching = false;
        isPanning  = false;

        if (!wasActive && zoomScale <= 1) {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            const dx  = touchEndX - touchStartX;
            const dy  = touchEndY - touchStartY;
            const img = document.getElementById("lightboxImg");
            const lb  = document.getElementById("imageLightbox");

            // Swipe up/down to close
            if (swipingVert && Math.abs(dy) > 110 && Math.abs(dy) > Math.abs(dx)) {
                swipingVert = false;
                closeLightbox();
                return;
            }
            // Snap back after aborted close gesture
            if (img) { img.style.transition = "transform 0.25s ease, opacity 0.25s ease"; img.style.transform = ""; }
            if (lb)  lb.style.background = "";
            swipingVert = false;

            // Horizontal swipe to navigate
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
                lbNavigate(dx > 0 ? -1 : 1);
            }
        }

    } else if (remaining === 1 && isPinching) {
        // 2 fingers → 1: switch to pan mode
        isPinching = false;
        if (zoomScale > 1) {
            isPanning  = true;
            zPanStartX = e.touches[0].clientX - zoomTX;
            zPanStartY = e.touches[0].clientY - zoomTY;
        }
    }
}

function onLbTouchCancel() {
    isPinching = false;
    isPanning  = false;
}
