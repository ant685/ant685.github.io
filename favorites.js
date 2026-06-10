// MOTOBY — favorites.js · shared localStorage favorites logic
"use strict";

const FAVORITES_KEY = "motoby_favorites";

const Favorites = {
    getAll() {
        try {
            return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        } catch (_) { return []; }
    },

    has(lotId) {
        return this.getAll().includes(String(lotId));
    },

    toggle(lotId) {
        const id   = String(lotId);
        const list = this.getAll();
        const idx  = list.indexOf(id);
        if (idx === -1) list.push(id);
        else            list.splice(idx, 1);
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)); } catch (_) {}
        return idx === -1; // true = added, false = removed
    },

    count() {
        return this.getAll().length;
    }
};
