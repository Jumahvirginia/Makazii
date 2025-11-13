// js/property.js

let currentProperty = null; // Store the whole property object

// Function to fetch and display the property details
async function loadPropertyDetails() {
    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get('id'); // Get the ID as a simple variable
    const infoContainer = document.getElementById('property-info');

    // --- THIS IS THE FIX ---
    // We check the simple propertyId variable, not 'currentProperty.id'
    if (!propertyId) {
        infoContainer.innerHTML = '<h2>Error: Property ID not found.</h2>';
        return;
    }
    // --- END FIX ---

    // Fetch the property using its ID
    const { data: property, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

    if (error || !property) {
        infoContainer.innerHTML = `<h2>Error: Property not found.</h2><p>${error?.message || ''}</p>`;
        return;
    }
    
    // NOW we store the full property object
    currentProperty = property; 
    
    // Update the page title
    document.getElementById('page-title').textContent = `${property.title} - Makazi`;

    // --- Create a full details list ---
    let detailsHTML = '';
    if (property.details) {
        detailsHTML = property.details.split('\n')
            .map(item => `<li><i class="fas fa-check-circle"></i> ${item}</li>`)
            .join('');
        detailsHTML = `<ul class="property-details-list">${detailsHTML}</ul>`;
    } else {
        detailsHTML = '<p>No details provided.</p>';
    }
    // --- END NEW ---

    // Render the property details
    infoContainer.innerHTML = `
        <div class="property-header">
            <img src="${property.image_url || 'placeholder.jpg'}" alt="${property.title}" class="detail-image">
            <div class="header-text">
                <h1>${property.title}</h1>
                <p class="location-price">${property.location} | <span class="price">Ksh ${property.price.toLocaleString()} / month</span></p>
            </div>
        </div>
        <div class="property-body">
            <h3>Details & Amenities</h3>
            
            ${detailsHTML}

            <p><strong>Status:</strong> ${property.is_rented ? 'Rented' : 'Available'}</p>
            <p class="verification-status">
                <strong>Verified:</strong> ${property.is_verified ? '<span class="status-verified">✅ Yes</span>' : '<span class="status-pending">❌ No (Pending Approval)</span>'}
            </p>
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
        // 1. Get the current tenant's user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('You must be logged in to send a request.');
        }
        
        // This check will now work because currentProperty is the full object
        if (!currentProperty || !currentProperty.landlord_id) {
            throw new Error('Property information is missing. Please refresh.');
        }

        // 2. Insert into the 'tour_requests' table
        const { error } = await supabase
            .from('tour_requests')
            .insert({
                property_id: currentProperty.id,
                tenant_id: user.id,
                landlord_id: currentProperty.landlord_id,
                requested_date: requestedDate,
                message: message,
                status: 'pending' // Default status
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
    
    // Show logout button if logged in (handled by auth.js)
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            document.getElementById('logout-button').style.display = 'inline-block';
        }
    });
});