
// js/property.js (Complete New Version)

let currentProperty = null; // Store the whole property object

// --- NEW: Function to handle thumbnail clicks ---
function handleThumbnailClick(event) {
    // Get the new image source from the clicked thumbnail
    const newSrc = event.target.src;
    
    // Set the main image source
    document.getElementById('main-property-image').src = newSrc;

    // Update the 'active' class
    document.querySelectorAll('.thumbnail-grid img').forEach(img => {
        img.classList.remove('active-thumbnail');
    });
    event.target.classList.add('active-thumbnail');
}

// Function to fetch and display the property details
async function loadPropertyDetails() {
    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get('id');
    
    // Target the new content container, not the whole section
    const detailsContainer = document.getElementById('property-details-content');

    if (!propertyId) {
        detailsContainer.innerHTML = '<h2>Error: Property ID not found.</h2>';
        return;
    }

    // Fetch the property using its ID, including all new image URLs
    const { data: property, error } = await supabase
        .from('properties')
        .select(`
            *, 
            cover_image_url, 
            image_url_2, 
            image_url_3, 
            image_url_4
        `)
        .eq('id', propertyId)
        .single();

    if (error || !property) {
        detailsContainer.innerHTML = `<h2>Error: Property not found.</h2><p>${error?.message || ''}</p>`;
        return;
    }
    
    // Store the full property object
    currentProperty = property; 
    
    // Update the page title
    document.getElementById('page-title').textContent = `${property.title} - Makazi`;

    // --- 1. POPULATE THE IMAGE GALLERY ---
    const mainImage = document.getElementById('main-property-image');
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    
    mainImage.src = property.cover_image_url || 'placeholder.jpg';
    thumbnailGrid.innerHTML = ''; // Clear any placeholders

    // Create a list of all available images
    const images = [
        property.cover_image_url,
        property.image_url_2,
        property.image_url_3,
        property.image_url_4
    ];

    images.forEach((url, index) => {
        if (url) { // Only add if the URL exists
            const img = document.createElement('img');
            img.src = url;
            img.alt = `Property view ${index + 1}`;
            
            // Add 'active' class to the first thumbnail
            if (index === 0) {
                img.classList.add('active-thumbnail');
            }
            
            // Add the click listener
            img.addEventListener('click', handleThumbnailClick);
            thumbnailGrid.appendChild(img);
        }
    });

    // --- 2. POPULATE THE TEXT DETAILS ---
    let detailsHTML = '';
    if (property.details) {
        detailsHTML = property.details.split('\n')
            .map(item => `<li><i class="fas fa-check-circle"></i> ${item}</li>`)
            .join('');
        detailsHTML = `<ul class="property-details-list">${detailsHTML}</ul>`;
    } else {
        detailsHTML = '<p>No details provided.</p>';
    }

    // Render the property details
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
            <p><strong>Status:</strong> <span class="status-${property.status}">${property.status}</span></p>
            <p class="verification-status">
                <strong>Verified:</strong> ${property.is_verified ? '<span class="status-verified">✅ Yes</span>' : '<span class="status-pending">❌ No (Pending Approval)</span>'}
            </prop>
        </div>
    `;
}

// Function to handle the tour request submission
async function handleTourRequestSubmit(event) {
    event.preventDefault();
    
    const requestedDate = document.getElementById('tour-date').value;
    const message = document.getElementById('message').value;
    const tourBtn = document.getElementById('submit-tour-btn');
    const messageArea = document.getElementById('inquiry-message-area');

    if (!requestedDate) {
        alert('Please select a date for the tour.');
        return;
    }

    tourBtn.disabled = true;
    messageArea.textContent = 'Sending request...';

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('You must be logged in to send a request.');
        }
        
        if (!currentProperty || !currentProperty.landlord_id) {
            throw new Error('Property information is missing. Please refresh.');
        }

        const { error } = await supabase
            .from('tour_requests')
            .insert({
                property_id: currentProperty.id,
                tenant_id: user.id,
                landlord_id: currentProperty.landlord_id,
                requested_date: requestedDate,
                message: message,
                status: 'pending'
            });

        if (error) {
            throw new Error(`Failed to send request: ${error.message}`);
        }

        messageArea.textContent = 'Tour request sent successfully! The landlord will respond soon.';
        messageArea.style.color = 'var(--dark-gray)'; 
        document.getElementById('tour-request-form').reset();
        
    } catch (e) {
        console.error("Tour Request Error:", e);
        messageArea.textContent = `Error: ${e.message}`;
        messageArea.style.color = 'var(--danger-color)';
    } finally {
        tourBtn.disabled = false;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Load property details on page load
    loadPropertyDetails();

    // Set up the form listener
    const tourForm = document.getElementById('tour-request-form');
    if (tourForm) {
        tourForm.addEventListener('submit', handleTourRequestSubmit);
    }
    
    // --- Template Message Button ---
    const templateBtn = document.getElementById('use-template-btn');
    if (templateBtn) {
        templateBtn.addEventListener('click', () => {
            const messageBox = document.getElementById('message');
            const template = "Hello, I am interested in this property. The date I selected for a tour works best for me, but please let me know if another time is better. Thanks!";
            messageBox.value = template;
        });
    }
    
    // Show logout button if logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            document.getElementById('logout-button').style.display = 'inline-block';
        }
    });
});