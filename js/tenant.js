// js/tenant.js (Complete File)

// --- 1. PROPERTY LISTING FUNCTIONS ---

// Function to render a single property card (FLIP-CARD LAYOUT)
function createPropertyCard(property) {
   
    const isLandingPage = window.location.pathname === '/index.html' || window.location.pathname.endsWith('/') || window.location.pathname.includes('127.0.0.1');
   
    const detailsPath = isLandingPage ? `pages/property_details.html?id=${property.id}` : `../pages/property_details.html?id=${property.id}`;
    
   
    let detailsSnippetHTML = '';
    if (property.details) {
        
        detailsSnippetHTML = property.details.split('\n')
            .slice(0, 3) 
            .map(item => `<li><i class="fas fa-check-circle"></i> ${item}</li>`)
            .join('');
        detailsSnippetHTML = `<ul class="card-details-list">${detailsSnippetHTML}<li>...</li></ul>`;
    } else {
        detailsSnippetHTML = '<p>No details available.</p>';
    }
    // --- END NEW ---

    return `
        <div class="property-card">
            <div class="flip-card-inner">
                
                <div class="flip-card-front">
                    <img src="${property.image_url || 'placeholder.jpg'}" alt="${property.title}" class="property-image">
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

// Function to fetch listings from Supabase with filters
async function fetchListings(locationFilter = null, priceMaxFilter = null) {
    const container = document.getElementById('listings-container');
    if (container) {
        container.innerHTML = '<p>Loading properties...</p>'; // Show loading state
    }
    
    // Base query: Select all fields from 'properties' table
    let query = supabase
        .from('properties')
        .select('*')
        // ONLY show properties that are verified and not rented
        .eq('is_verified', true)
        .eq('is_rented', false);

    // Apply location filter if provided
    if (locationFilter) {
        query = query.ilike('location', `%${locationFilter}%`);
    }

    // Apply max price filter if provided
    if (priceMaxFilter && !isNaN(priceMaxFilter) && priceMaxFilter > 0) {
        query = query.lte('price', priceMaxFilter);
    }
    
    // Execute the query
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

// --- 2. "MY TOUR REQUESTS" FUNCTIONS ---

// Fetch and render tenant's request statuses
async function fetchMyTourRequests(tenantId) {
    const container = document.getElementById('my-tour-requests-container');
    if (!container) return; // Only run if the container exists

    container.innerHTML = '<p>Loading your tour request statuses...</p>';

    // Fetch all requests for this tenant
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
}

// Helper to create HTML for a single request status card
function renderMyRequestCard(req) {
    let statusText = req.status.charAt(0).toUpperCase() + req.status.slice(1);
    let requestedDate = new Date(req.requested_date + 'T00:00:00').toLocaleDateString();
    
    let responseHTML = '';
    // If landlord denied and suggested a new date
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
            </div>
        </div>
    `;
}


// --- 3. INITIALIZATION (EVENT LISTENER) ---

document.addEventListener('DOMContentLoaded', async () => {

    // --- Load "My Tour Requests" on Tenant Dashboard ---
    const requestsContainer = document.getElementById('my-tour-requests-container');
    if (requestsContainer) {
        // Fetch the user ID to load their requests
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            fetchMyTourRequests(user.id);
        }
    }

    // --- Handle Search on Tenant Dashboard (dashboards/tenant.html) ---
    const dashboardSearchForm = document.getElementById('search-form');
    if (dashboardSearchForm) {
        dashboardSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const location = document.getElementById('location').value.trim();
            const priceMax = parseFloat(document.getElementById('price-max').value);
            
            fetchListings(location, priceMax);
        });

        document.getElementById('clear-search')?.addEventListener('click', () => {
            document.getElementById('location').value = '';
            document.getElementById('price-max').value = '';
            fetchListings(); // Fetch all listings without filters
        });
    }

    // --- Handle Search on Landing Page (index.html) ---
    const landingSearchForm = document.getElementById('landing-search-form');
    if (landingSearchForm) {
        landingSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const location = document.getElementById('landing-location').value.trim();
            
            // Only search by location on the landing page for simplicity
            fetchListings(location);
        });
    }
    
    // --- Initial Load ---
    // Automatically load all verified properties when the page loads
    // This runs on index.html (featured) AND dashboards/tenant.html
    fetchListings(); 
});