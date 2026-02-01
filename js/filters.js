let currentBrand = null;
let currentStock = null;

document.querySelectorAll('.filters button').forEach(button => {
    button.addEventListener('click', () => {
        const type = button.dataset.type;
        const value = button.dataset.value;

        if (type === 'brand') {
            if (currentBrand === value) {
                currentBrand = null;
                button.classList.remove('active');
            } else {
                currentBrand = value;
                setActive('brand', button);
            }
        }

        if (type === 'stock') {
            if (currentStock === value) {
                currentStock = null;
                button.classList.remove('active');
            } else {
                currentStock = value;
                setActive('stock', button);
            }
        }

        applyFilters();
    });
});

function setActive(type, activeButton) {
    document.querySelectorAll('.filters button').forEach(btn => {
        if (btn.dataset.type === type) {
            btn.classList.remove('active');
        }
    });
    activeButton.classList.add('active');
}

function applyFilters() {
    document.querySelectorAll('.product').forEach(product => {
        let visible = true;

        if (currentBrand && !product.classList.contains(currentBrand)) {
            visible = false;
        }

        if (currentStock && !product.classList.contains(currentStock)) {
            visible = false;
        }

        product.classList.toggle('hidden', !visible);
    });
}
