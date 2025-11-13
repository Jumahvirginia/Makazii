// --- (Keep your existing uploadImage and handleNewPropertySubmit functions) ---

async function uploadImage(file, userId) {
    // ... (Your existing image upload code) ...
    // ... (Make sure this function is at the top) ...
    const fileName = `${userId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const { data, error } = await supabase.storage
        .from('property-images') // Use the bucket name you created
        .upload(fileName, file);

    if (error) {
        throw new Error(`Image upload failed: ${error.message}`);
    }

    // Get the public URL of the uploaded image
    const { data: publicURLData } = supabase.storage
        .from('property-images')
        .getPublicUrl(fileName);
        
    return publicURLData.publicUrl;
}

async function handleNewPropertySubmit(event) {
    // ... (Your existing 'Add Property' submit code) ...
    // ... (Make sure this function is next) ...
    event.preventDefault();
    const submitBtn = document.getElementById('submit-listing-btn');
    const messageArea = document.getElementById('message-area');
    submitBtn.disabled = true;
    messageArea.textContent = 'Processing listing...';

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('You must be logged in.');

        const title = document.getElementById('title').value;
        const location = document.getElementById('location').value;
        const price = parseFloat(document.getElementById('price').value);
        const details = document.getElementById('details').value;
        const imageFile = document.getElementById('image-file').files[0];

        const imageUrl = await uploadImage(imageFile, user.id);

        const { error: dbError } = await supabase
            .from('properties')
            .insert({
                landlord_id: user.id,
                title: title,
                location: location,
                price: price,
                image_url: imageUrl,
                details: details,
                is_verified: false,
                is_rented: false
            });

        if (dbError) throw new Error(`Database insert failed: ${dbError.message}`);

        messageArea.textContent = 'Listing submitted successfully! It is awaiting Admin approval.';
        messageArea.style.color = 'var(--primary-color)';
        document.getElementById('add-property-form').reset();
        fetchMyProperties(user.id); // Reload the simple property list

    } catch (e) {
        console.error("Listing Error:", e);
        messageArea.textContent = `Listing failed: ${e.message}`;
        messageArea.style.color = 'var(--danger-color)';
    } finally {
        submitBtn.disabled = false;
    }
}


// --- (ALL NEW CODE BELOW) ---

let currentRequestId = null; // Store the request ID for the modal

// 1. FETCH AND RENDER PENDING TOUR REQUESTS
async function fetchTourRequests(landlordId) {
    const container = document.getElementById('tour-requests-container');
    container.innerHTML = '<p>Loading new tour requests...</p>';

    // Fetch requests for this landlord that are 'pending'
    const { data: requests, error } = await supabase
        .from('tour_requests')
        .select(`
            id,
            requested_date,
            message,
            status,
            properties ( title, location ),
            user_profiles!tenant_id ( name ) 
        `) // This line is now fixed
        .eq('landlord_id', landlordId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error) {
        container.innerHTML = `<p class="error">Error loading requests: ${error.message}</p>`;
        return;
    }

    if (requests.length === 0) {
        container.innerHTML = '<p>You have no pending tour requests.</p>';
        return;
    }

    container.innerHTML = requests.map(renderRequestCard).join('');
    addRequestListeners(); // Attach listeners to the new buttons
}
// Helper to create HTML for a single request card
function renderRequestCard(req) {
    // Format date for readability
    const tourDate = new Date(req.requested_date + 'T00:00:00').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
        <div class="landlord-listing-card">
            <h4>Tour Request for: ${req.properties.title}</h4>
            <p><strong>From:</strong> ${req.user_profiles.name}</p>
            <p><strong>Requested Date:</strong> ${tourDate}</p>
            <p><strong>Message:</strong> "${req.message || 'No message provided.'}"</p>
            
            <div class="request-actions">
                <button class="approve-btn" data-id="${req.id}"><i class="fas fa-check"></i> Approve</button>
                <button class="deny-btn" data-id="${req.id}"><i class="fas fa-times"></i> Deny/Suggest</button>
            </div>
        </div>
    `;
}

// 2. FETCH AND RENDER LANDLORD'S OWN PROPERTIES
async function fetchMyProperties(landlordId) {
    const container = document.getElementById('landlord-listings-container');
    container.innerHTML = '<p>Loading your properties...</p>';

    const { data: listings, error } = await supabase
        .from('properties')
        .select(`
            title,
            location,
            price,
            is_verified,
            is_rented
        `)
        .eq('landlord_id', landlordId)
        .order('id', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="error">Error loading properties: ${error.message}</p>`;
        return;
    }

    if (listings.length === 0) {
        container.innerHTML = '<p>You have no properties listed yet.</p>';
        return;
    }
    
    container.innerHTML = listings.map(p => `
        <div class="landlord-listing-card simple">
            <h4>${p.title} (${p.location})</h4>
            <p><strong>Price:</strong> Ksh ${p.price.toLocaleString()}</p>
            <p><strong>Status:</strong> ${p.is_rented ? 'Rented' : 'Available'}</p>
            <p><strong>Admin Verified:</strong> ${p.is_verified ? '<span class="status-verified">✅ Yes</span>' : '<span class="status-pending">❌ No</span>'}</p>
        </div>
    `).join('');
}

// 3. HANDLE MODAL AND APPROVE/DENY ACTIONS
function addRequestListeners() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', handleApprove);
    });
    document.querySelectorAll('.deny-btn').forEach(btn => {
        btn.addEventListener('click', showDenyModal);
    });
}

// Handle Approve
async function handleApprove(event) {
    const requestId = event.target.closest('button').dataset.id;
    if (!confirm('Are you sure you want to approve this tour date?')) return;

    const { error } = await supabase
        .from('tour_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

    if (error) {
        alert(`Error: ${error.message}`);
    } else {
        alert('Tour request approved! The tenant will be notified.');
        const { data: { user } } = await supabase.auth.getUser();
        fetchTourRequests(user.id); // Refresh the list
    }
}

// Show Deny/Suggest Modal
function showDenyModal(event) {
    currentRequestId = event.target.closest('button').dataset.id; // Store ID
    document.getElementById('deny-modal').style.display = 'flex';
}

// Hide Deny/Suggest Modal
function hideDenyModal() {
    currentRequestId = null;
    document.getElementById('deny-modal').style.display = 'none';
    document.getElementById('deny-request-form').reset();
}

// Handle the modal form submission
async function handleDenySubmit(event) {
    event.preventDefault();
    if (!currentRequestId) return;

    const suggestedDate = document.getElementById('suggested-date').value;
    const message = document.getElementById('landlord-message').value;
    
    const { error } = await supabase
        .from('tour_requests')
        .update({
            status: 'denied',
            landlord_suggested_date: suggestedDate,
            landlord_message: message
        })
        .eq('id', currentRequestId);

    if (error) {
        alert(`Error: ${error.message}`);
    } else {
        alert('Request denied and new date suggested. The tenant will be notified.');
        hideDenyModal();
        const { data: { user } } = await supabase.auth.getUser();
        fetchTourRequests(user.id); // Refresh the list
    }
}

// 4. DOM EVENT LISTENER INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    // Listener for adding a property
    const addForm = document.getElementById('add-property-form');
    if (addForm) {
        addForm.addEventListener('submit', handleNewPropertySubmit);
    }
    
    // Listeners for the modal
    document.getElementById('deny-request-form').addEventListener('submit', handleDenySubmit);
    document.getElementById('cancel-denial-btn').addEventListener('click', hideDenyModal);

    // Load initial data for the landlord
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        fetchTourRequests(user.id);
        fetchMyProperties(user.id);
    }
});