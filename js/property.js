let currentPropertyId = null;

// Function to fetch and display the property details
async function loadPropertyDetails() {
    const params = new URLSearchParams(window.location.search);
    currentPropertyId = params.get('id');
    const infoContainer = document.getElementById('property-info');

    if (!currentPropertyId) {
        infoContainer.innerHTML = '<h2>Error: Property ID not found.</h2>';
        return;
    }

    // Fetch the property using its ID
    const { data: property, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', currentPropertyId)
        .single();

    if (error || !property) {
        infoContainer.innerHTML = `<h2>Error: Property not found.</h2><p>${error?.message || ''}</p>`;
        return;
    }
    
    // Update the page title
    document.getElementById('page-title').textContent = `${property.title} - Makazi`;

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
            <h3>Details</h3>
            <p>${property.details}</p>
            <p><strong>Status:</strong> ${property.is_rented ? 'Rented' : 'Available'}</p>
            <p class="verification-status">
                <strong>Verified:</strong> ${property.is_verified ? '✅ Listing approved by Admin' : '❌ Awaiting Admin Verification'}
            </p>
        </div>
    `;
}

// Function to handle the inquiry submission
async function handleInquirySubmit(event) {
    event.preventDefault();
    const message = document.getElementById('message').value;
    const inquiryBtn = document.getElementById('submit-inquiry-btn');
    const messageArea = document.getElementById('inquiry-message-area');
    
    inquiryBtn.disabled = true;
    messageArea.textContent = 'Sending message...';
    messageArea.style.color = 'blue';

    try {
        // 1. Check if the user is logged in (must be a tenant/user)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('You must be logged in to send an inquiry. Please log in first.');
        }

        // 2. Insert the message into the 'messages' table
        const { error } = await supabase
            .from('messages')
            .insert({
                property_id: currentPropertyId,
                tenant_id: user.id,
                message_body: message,
            });

        if (error) {
            throw new Error(`Failed to send message: ${error.message}`);
        }

        messageArea.textContent = 'Inquiry sent successfully! The landlord will contact you soon.';
        messageArea.style.color = 'green';
        document.getElementById('inquiry-form').reset();
        
    } catch (e) {
        console.error("Inquiry Error:", e);
        messageArea.textContent = `Error: ${e.message}`;
        messageArea.style.color = 'red';
    } finally {
        inquiryBtn.disabled = false;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Load property details on page load
    loadPropertyDetails();

    // Set up the form listener
    const inquiryForm = document.getElementById('inquiry-form');
    if (inquiryForm) {
        inquiryForm.addEventListener('submit', handleInquirySubmit);
    }
    
    // Show logout button if logged in (handled by auth.js)
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            document.getElementById('logout-button').style.display = 'inline-block';
        }
    });
});