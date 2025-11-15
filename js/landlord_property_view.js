// js/landlord_property_view.js

let currentPropertyId = null;

// --- 1. HANDLE THUMBNAIL CLICKS ---
function handleThumbnailClick(event) {
    const newSrc = event.target.src;
    document.getElementById('main-property-image').src = newSrc;
    document.querySelectorAll('.thumbnail-grid img').forEach(img => {
        img.classList.remove('active-thumbnail');
    });
    event.target.classList.add('active-thumbnail');
}

// --- 2. LOAD ALL PROPERTY DETAILS ---
async function loadPropertyDetails() {
    const params = new URLSearchParams(window.location.search);
    propertyId = params.get('id');
    const detailsContainer = document.getElementById('property-details-content');
    
    if (!propertyId) {
        detailsContainer.innerHTML = '<h2>Error: Property ID not found.</h2>';
        return;
    }

    currentPropertyId = propertyId; // Save for the update function

    const { data: property, error } = await supabase
        .from('properties')
        .select('*') // Select all columns, including all 4 image URLs
        .eq('id', propertyId)
        .single();

    if (error || !property) {
        detailsContainer.innerHTML = `<h2>Error: Property not found.</h2><p>${error?.message || ''}</p>`;
        return;
    }
    
    document.getElementById('page-title').textContent = `Manage: ${property.title}`;

    // --- A. POPULATE THE IMAGE GALLERY ---
    const mainImage = document.getElementById('main-property-image');
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    
    mainImage.src = property.cover_image_url || 'placeholder.jpg';
    thumbnailGrid.innerHTML = ''; // Clear placeholders

    const images = [
        property.cover_image_url,
        property.image_url_2,
        property.image_url_3,
        property.image_url_4
    ];

    images.forEach((url, index) => {
        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `Property view ${index + 1}`;
            if (index === 0) img.classList.add('active-thumbnail');
            img.addEventListener('click', handleThumbnailClick);
            thumbnailGrid.appendChild(img);
        }
    });

    // --- B. POPULATE THE TEXT DETAILS ---
    let detailsHTML = '';
    if (property.details) {
        detailsHTML = property.details.split('\n')
            .map(item => `<li><i class="fas fa-check-circle"></i> ${item}</li>`)
            .join('');
        detailsHTML = `<ul class="property-details-list">${detailsHTML}</ul>`;
    } else {
        detailsHTML = '<p>No details provided.</p>';
    }

    detailsContainer.innerHTML = `
        <div class="property-header">
            <div class="header-text">
                <h1>${property.title}</h1>
                <p class="location-price">${property.location} | <span class="price">Ksh ${property.price.toLocaleString()} / month</span></p>
            </div>
        </div>
        <div class="property-body">
            <h3>Details & Amenities</h3>
            ${detailsHTML}
            <p><strong>Admin Verified:</strong> ${property.is_verified ? '<span class="status-verified">✅ Yes</span>' : '<span class="status-pending">❌ No (Pending Approval)</span>'}</p>
        </div>
    `;

    // --- C. SET THE CURRENT STATUS IN THE DROPDOWN ---
    document.getElementById('property-status').value = property.status;
}

// --- 3. HANDLE STATUS UPDATE ---
async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!currentPropertyId) return;

    const newStatus = document.getElementById('property-status').value;
    const updateBtn = document.getElementById('update-status-btn');
    const messageArea = document.getElementById('manage-message-area');
    
    updateBtn.disabled = true;
    messageArea.textContent = 'Updating...';

    const { error } = await supabase
        .from('properties')
        .update({ status: newStatus })
        .eq('id', currentPropertyId);

    if (error) {
        messageArea.textContent = `Error: ${error.message}`;
        messageArea.style.color = 'var(--danger-color)';
    } else {
        messageArea.textContent = 'Status updated successfully!';
        messageArea.style.color = 'var(--secondary-color)'; // Teal
    }

    updateBtn.disabled = false;
}

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadPropertyDetails();
    
    const manageForm = document.getElementById('manage-status-form');
    if (manageForm) {
        manageForm.addEventListener('submit', handleStatusUpdate);
    }
});