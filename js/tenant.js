// Function to render a single property card
function createPropertyCard(property) {
    // We use a simple template literal to construct the HTML for a property card
    return `
        <div class="property-card">
            <img src="${property.image_url || 'placeholder.jpg'}" alt="${property.title}" class="property-image">
            <div class="card-body">
                <h3>${property.title}</h3>
                <p class="location">${property.location}</p>
                <p class="price">Ksh ${property.price.toLocaleString()}</p>
                <a href="../pages/property_details.html?id=${property.id}" class="details-button">View Details</a>
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
        // ONLY show properties that are verified and not rented (MVP Core Rule)
        .eq('is_verified', true)
        .eq('is_rented', false);

    // Apply location filter if provided
    if (locationFilter) {
        // Use ILIKE for case-insensitive partial matching on location
        query = query.ilike('location', `%${locationFilter}%`);
    }

    // Apply max price filter if provided
    if (priceMaxFilter && !isNaN(priceMaxFilter) && priceMaxFilter > 0) {
        // Use 'lte' (less than or equal to) operator for max price
        query = query.lte('price', priceMaxFilter);
    }
    
    // Execute the query
    const { data: properties, error } = await query;

    if (error) {
        console.error('Error fetching properties:', error);
        alert('Could not load properties at this time.');
        renderListings([], 'listings-container'); // Render empty set on error
        return;
    }

    renderListings(properties, 'listings-container');
}

// Initialize listeners when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Handle Search on Tenant Dashboard (dashboards/tenant.html) ---
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

    // --- 2. Handle Search on Landing Page (index.html) ---
    const landingSearchForm = document.getElementById('landing-search-form');
    if (landingSearchForm) {
        landingSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const location = document.getElementById('landing-location').value.trim();
            
            // Only search by location on the landing page for simplicity
            fetchListings(location);
        });
    }
    
    // --- 3. Initial Load ---
    // Automatically load all verified properties when the page loads
    // This runs on index.html (featured) AND dashboards/tenant.html
    fetchListings(); 
});