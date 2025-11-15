// js/tenant.js (Complete File)

// --- 1. PROPERTY LISTING FUNCTIONS ---

// Function to render a single property card (FLIP-CARD LAYOUT)
function createPropertyCard(property) {
    // Check if we are on the landing page
    const isLandingPage = window.location.pathname === '/index.html' || window.location.pathname.endsWith('/') || window.location.pathname.includes('127.0.0.1');
    
    // Set the correct path for the details page
    const detailsPath = isLandingPage ? `pages/property_details.html?id=${property.id}` : `../pages/property_details.html?id=${property.id}`;
    
    // Create a details list snippet
    let detailsSnippetHTML = '';
    if (property.details) {
        detailsSnippetHTML = property.details.split('\n')
            .slice(0, 3) // Get first 3 items
            .map(item => `<li><i class="fas fa-check-circle"></i> ${item}</li>`)
            .join('');
        detailsSnippetHTML = `<ul class="card-details-list">${detailsSnippetHTML}<li>...</li></ul>`;
    } else {
        detailsSnippetHTML = '<p>No details available.</p>';
    }

    return `
        <div class="property-card">
            <div class="flip-card-inner">
                
                <div class="flip-card-front">
                    <img src="${property.cover_image_url || 'placeholder.jpg'}" alt="${property.title}" class="property-image">
                    <div class="card-body">
                        <h3>${property.title}</h3>
                    </div>
                </div>
                
                <div class="flip-card-back">
                    <div class="card-body">
                        <h4>${property.title}</h4>
                        <p class="location">${property.location}</p>
                        <p class="price">Ksh ${property.price.toLocaleString()}</p>
                        ${detailsSnippetHTML}
                        <a href="${detailsPath}" class="details-button">View Details</a>
                    </div>
                </div>

            </div>
        </div>
    `;
}

// Function to inject the fetched properties into the container
function renderListings(properties, containerId = 'listings-container') {
    const container = document.getElementById(containerId);
    if (!container) return; // Exit if container doesn't exist

    if (properties.length === 0) {
        container.innerHTML = '<p>No properties found matching your criteria.</p>';
        return;
    }

    // Map the array of properties to an array of HTML strings and join them
    container.innerHTML = properties.map(createPropertyCard).join('');
}

// --- 👇 UPDATED fetchListings function 👇 ---
// Function to fetch listings from Supabase with filters
async function fetchListings(locationFilter = null, priceMinFilter = null, priceMaxFilter = null) {
    const container = document.getElementById('listings-container');
    if (container) {
        container.innerHTML = '<p>Loading properties...</p>'; // Show loading state
    }
    
    let query = supabase
        .from('properties')
        .select(`
            *,
            cover_image_url,
            details
        `)
        .eq('status', 'available')
        .eq('is_verified', true);

    // Apply location filter
    if (locationFilter) {
        query = query.ilike('location', `%${locationFilter}%`);
    }

    // Apply min price filter
    if (priceMinFilter && !isNaN(priceMinFilter) && priceMinFilter > 0) {
        query = query.gte('price', priceMinFilter); // gte = "greater than or equal to"
    }

    // Apply max price filter
    if (priceMaxFilter && !isNaN(priceMaxFilter) && priceMaxFilter > 0) {
        query = query.lte('price', priceMaxFilter); // lte = "less than or equal to"
    }
    
    const { data: properties, error } = await query;

    if (error) {
        console.error('Error fetching properties:', error);
        if (container) {
            container.innerHTML = '<p>Could not load properties at this time.</p>';
        }
        return;
    }

    renderListings(properties, 'listings-container');
}
// --- 👆 END OF UPDATE 👆 ---


// --- 2. "MY TOUR REQUESTS" FUNCTIONS ---

// Function to handle the "Cancel" button click
async function handleCancelRequest(event) {
    const requestId = event.target.closest('button').dataset.id;
    if (!confirm('Are you sure you want to cancel this tour request?')) {
        return;
    }

    const { error } = await supabase
        .from('tour_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

    if (error) {
        alert(`Error cancelling request: ${error.message}`);
    } else {
        alert('Tour request cancelled.');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            fetchMyTourRequests(user.id);
        }
    }
}

// Fetch and render tenant's request statuses
async function fetchMyTourRequests(tenantId) {
    const container = document.getElementById('my-tour-requests-container');
    if (!container) return; // Only run if the container exists

    container.innerHTML = '<p>Loading your tour request statuses...</p>';

    const { data: requests, error } = await supabase
        .from('tour_requests')
        .select(`
            id,
            requested_date,
            status,
            landlord_message,
            landlord_suggested_date,
            properties ( title, location )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="error">Error loading requests: ${error.message}</p>`;
        return;
    }

    if (requests.length === 0) {
        container.innerHTML = '<p>You have not made any tour requests yet.</p>';
        return;
    }

    container.innerHTML = requests.map(renderMyRequestCard).join('');

    container.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', handleCancelRequest);
    });
}

// Helper to create HTML for a single request status card
function renderMyRequestCard(req) {
    let statusText = req.status.charAt(0).toUpperCase() + req.status.slice(1);
    let requestedDate = new Date(req.requested_date + 'T00:00:00').toLocaleDateString();
    
    let responseHTML = '';
    if (req.status === 'denied' && req.landlord_suggested_date) {
        let suggestedDate = new Date(req.landlord_suggested_date + 'T00:00:00').toLocaleDateString();
        
        responseHTML = `
            <div class="landlord-suggestion">
                <div class="request-detail-item">
                    <i class="fas fa-comment-dots"></i>
                    <span><strong>Landlord Response:</strong> ${req.landlord_message || 'No message.'}</span>
                </div>
                <div class="request-detail-item">
                    <i class="fas fa-calendar-plus"></i>
                    <span><strong>Suggested New Date:</strong> ${suggestedDate}</span>
                </div>
            </div>
        `;
    }

    let cancelButtonHTML = '';
    if (req.status === 'pending') {
        cancelButtonHTML = `<button class="cancel-btn" data-id="${req.id}"><i class="fas fa-times"></i> Cancel</button>`;
    }
    
    return `
        <div class="request-status-card">
            <div class="request-card-header">
                <span class="property-name"><i class="fas fa-building"></i> ${req.properties.title}</span>
                <span class="status-badge status-${req.status}">
                    ${statusText}
                </span>
            </div>
            <div class="request-card-body">
                <div class="request-detail-item">
                    <i class="fas fa-calendar-day"></i>
                    <span><strong>Your Request:</strong> ${requestedDate}</span>
                </div>
                ${responseHTML}
                ${cancelButtonHTML} 
            </div>
        </div>
    `;
}


// --- 3. INITIALIZATION (EVENT LISTENER) ---

document.addEventListener('DOMContentLoaded', async () => {

    // --- Load "My Tour Requests" on Tenant Dashboard ---
    const requestsContainer = document.getElementById('my-tour-requests-container');
    if (requestsContainer) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            fetchMyTourRequests(user.id);
        }
    }

    // --- 👇 UPDATED Dashboard Search Form 👇 ---
    const dashboardSearchForm = document.getElementById('search-form');
    if (dashboardSearchForm) {
        dashboardSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const location = document.getElementById('location').value.trim();
            const priceMin = parseFloat(document.getElementById('price-min').value); // Get Min
            const priceMax = parseFloat(document.getElementById('price-max').value); // Get Max
            
            fetchListings(location, priceMin, priceMax); // Pass both
        });

        // Update "Clear" button to clear both inputs
        document.getElementById('clear-search')?.addEventListener('click', () => {
            document.getElementById('location').value = '';
            document.getElementById('price-min').value = '';
            document.getElementById('price-max').value = '';
            fetchListings(); // Fetch all listings without filters
        });
    }
    // --- 👆 END OF UPDATE 👆 ---

    // --- Handle Search on Landing Page (index.html) ---
    const landingSearchForm = document.getElementById('landing-search-form');
    if (landingSearchForm) {
        landingSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const location = document.getElementById('landing-location').value.trim();
            
            // Landing page search stays simple
            fetchListings(location, null, null);
        });
    }
    
    // --- Initial Load ---
    fetchListings(); 
});