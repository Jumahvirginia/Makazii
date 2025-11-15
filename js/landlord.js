// js/landlord.js (Complete New Version)

// --- 1. CORE UPLOAD/SUBMIT FUNCTIONS ---

async function uploadImage(file, userId) {
    if (!file) return null; // Skip if no file

    const fileName = `${userId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const { data, error } = await supabase.storage
        .from('property-images')
        .upload(fileName, file);

    if (error) {
        throw new Error(`Image upload failed: ${error.message}`);
    }

    const { data: publicURLData } = supabase.storage
        .from('property-images')
        .getPublicUrl(fileName);
        
    return publicURLData.publicUrl;
}

async function handleNewPropertySubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submit-listing-btn');
    const messageArea = document.getElementById('message-area');
    submitBtn.disabled = true;
    messageArea.textContent = 'Uploading images and submitting listing... This may take a moment.';
    messageArea.style.color = 'var(--secondary-color)'; // Teal

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('You must be logged in.');

        const title = document.getElementById('title').value;
        const location = document.getElementById('location').value;
        const price = parseFloat(document.getElementById('price').value);
        const details = document.getElementById('details').value;

        const file1 = document.getElementById('image-file-1').files[0];
        const file2 = document.getElementById('image-file-2').files[0];
        const file3 = document.getElementById('image-file-3').files[0];
        const file4 = document.getElementById('image-file-4').files[0];

        const [url1, url2, url3, url4] = await Promise.all([
            uploadImage(file1, user.id),
            uploadImage(file2, user.id),
            uploadImage(file3, user.id),
            uploadImage(file4, user.id)
        ]);

        if (!url1) {
            throw new Error('Image 1 (Cover Image) is required.');
        }

        const { error: dbError } = await supabase
            .from('properties')
            .insert({
                landlord_id: user.id,
                title: title,
                location: location,
                price: price,
                details: details,
                status: 'available',
                is_verified: false,
                cover_image_url: url1,
                image_url_2: url2,
                image_url_3: url3,
                image_url_4: url4
            });

        if (dbError) {
            throw new Error(`Database insert failed: ${dbError.message}`);
        }

        messageArea.textContent = 'Listing submitted successfully! It is awaiting Admin approval.';
        messageArea.style.color = 'var(--secondary-color)';
        document.getElementById('add-property-form').reset();
        fetchMyProperties(user.id);

    } catch (e) {
        console.error("Listing Error:", e);
        messageArea.textContent = `Listing failed: ${e.message}`;
        messageArea.style.color = 'var(--danger-color)';
    } finally {
        submitBtn.disabled = false;
    }
}


// --- 2. TOUR REQUEST & PROPERTY LISTING FUNCTIONS ---

let currentRequestId = null; // Store the request ID for the modal

// Fetch and render *pending* tour requests
async function fetchTourRequests(landlordId) {
    const container = document.getElementById('tour-requests-container');
    container.innerHTML = '<p>Loading new tour requests...</p>';

    const { data: requests, error } = await supabase
        .from('tour_requests')
        .select(`
            id,
            requested_date,
            message,
            status,
            properties ( title, location ),
            user_profiles!tenant_id ( name )
        `)
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
    addRequestListeners();
}

// Helper to create HTML for a single *pending* request card
function renderRequestCard(req) {
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
                <button class="deny-btn" data-id="${req.id}"><i class="fas fa-times"></i> Deny</button>
                <button class="suggest-btn" data-id="${req.id}"><i class="fas fa-calendar-alt"></i> Suggest</button>
            </div>
        </div>
    `;
}

// --- 👇 NEW FUNCTION: Fetch and render *upcoming* tours ---
async function fetchUpcomingTours(landlordId) {
    const container = document.getElementById('upcoming-tours-container');
    container.innerHTML = '<p>Loading upcoming tours...</p>';

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    const { data: requests, error } = await supabase
        .from('tour_requests')
        .select(`
            id,
            requested_date,
            properties ( title ),
            user_profiles!tenant_id ( name )
        `)
        .eq('landlord_id', landlordId)
        .eq('status', 'approved')
        .gte('requested_date', today) // "greater than or equal to" today
        .order('requested_date', { ascending: true }); // Show the soonest first

    if (error) {
        container.innerHTML = `<p class="error">Error loading tours: ${error.message}</p>`;
        return;
    }

    if (requests.length === 0) {
        container.innerHTML = '<p>You have no upcoming tours scheduled.</p>';
        return;
    }

    // Render as a simple list
    container.innerHTML = '<ul class="upcoming-tours-list">' + requests.map(tour => {
        const tourDate = new Date(tour.requested_date + 'T00:00:00').toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        return `
            <li>
                <strong>${tourDate}</strong>
                <p>With ${tour.user_profiles.name} at ${tour.properties.title}</p>
            </li>
        `;
    }).join('') + '</ul>';
}
// --- 👆 END OF NEW FUNCTION 👆 ---


// Fetch and render landlord's own properties
async function fetchMyProperties(landlordId) {
    const container = document.getElementById('landlord-listings-container');
    container.innerHTML = '<p>Loading your properties...</p>';

    const { data: listings, error } = await supabase
        .from('properties')
        .select(`
            id,
            title,
            location,
            price,
            is_verified,
            status
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
            <p><strong>Status:</strong> <span class="status-${p.status}">${p.status}</span></p>
            <p><strong>Admin Verified:</strong> ${p.is_verified ? '<span class="status-verified">✅ Yes</span>' : '<span class="status-pending">❌ No</span>'}</p>
            
            <a href="../pages/landlord_property_view.html?id=${p.id}" class="details-button">
                <i class="fas fa-edit"></i> Manage Property
            </a>
        </div>
    `).join('');
}

// --- 3. MODAL AND ACTION HANDLERS ---

function addRequestListeners() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', handleApprove);
    });
    document.querySelectorAll('.deny-btn').forEach(btn => {
        btn.addEventListener('click', handleDeny);
    });
    document.querySelectorAll('.suggest-btn').forEach(btn => {
        btn.addEventListener('click', showSuggestModal);
    });
}

// --- 👇 UPDATED: Refresh all lists ---
async function refreshAllTourLists(userId) {
    fetchTourRequests(userId);
    fetchUpcomingTours(userId);
}

// Handle Approve
async function handleApprove(event) {
    const requestId = event.target.closest('button').dataset.id;
    if (!confirm('Are you sure you want to approve this tour date?')) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('tour_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

    if (error) {
        alert(`Error: ${error.message}`);
    } else {
        alert('Tour request approved! The tenant will be notified.');
        refreshAllTourLists(user.id); // Refresh lists
    }
}

// Handle Deny
async function handleDeny(event) {
    const requestId = event.target.closest('button').dataset.id;
    if (!confirm('Are you sure you want to deny this request? This will not suggest a new time.')) return;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('tour_requests')
        .update({ status: 'denied', landlord_message: 'Request denied by landlord.' })
        .eq('id', requestId);

    if (error) {
        alert(`Error: ${error.message}`);
    } else {
        alert('Tour request denied.');
        refreshAllTourLists(user.id); // Refresh lists
    }
}

// Show Suggest Modal
function showSuggestModal(event) {
    currentRequestId = event.target.closest('button').dataset.id;
    document.getElementById('deny-modal').style.display = 'flex';
}

// Hide Suggest Modal
function hideSuggestModal() {
    currentRequestId = null;
    document.getElementById('deny-modal').style.display = 'none';
    document.getElementById('deny-request-form').reset();
}

// Handle the modal form submission
async function handleSuggestSubmit(event) {
    event.preventDefault();
    if (!currentRequestId) return;

    const suggestedDate = document.getElementById('suggested-date').value;
    const message = document.getElementById('landlord-message').value;
    const { data: { user } } = await supabase.auth.getUser();
    
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
        hideSuggestModal();
        refreshAllTourLists(user.id); // Refresh lists
    }
}

// --- 4. DOM EVENT LISTENER INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // Listener for adding a property
    const addForm = document.getElementById('add-property-form');
    if (addForm) {
        addForm.addEventListener('submit', handleNewPropertySubmit);
    }
    
    // Listeners for the modal
    document.getElementById('deny-request-form').addEventListener('submit', handleSuggestSubmit);
    document.getElementById('cancel-denial-btn').addEventListener('click', hideSuggestModal);

    // Template Message Button for Landlord Modal
    const landlordTemplateBtn = document.getElementById('landlord-template-btn');
    if (landlordTemplateBtn) {
        landlordTemplateBtn.addEventListener('click', () => {
            const messageBox = document.getElementById('landlord-message');
            const template = "Unfortunately, I am not available at the requested time. Please see my suggested date. Thank you!";
            messageBox.value = template;
        });
    }

    // --- 👇 UPDATED: Load all initial data for the landlord ---
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        fetchTourRequests(user.id);
        fetchMyProperties(user.id);
        fetchUpcomingTours(user.id); // <-- ADDED THIS
    }
});