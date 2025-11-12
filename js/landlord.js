// Function to upload the image and return the public URL
async function uploadImage(file, userId) {
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

// Function to handle the form submission
async function handleNewPropertySubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submit-listing-btn');
    const messageArea = document.getElementById('message-area');
    submitBtn.disabled = true;
    messageArea.textContent = 'Processing listing...';
    messageArea.style.color = 'blue';

    try {
        // 1. Get the current user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('You must be logged in to list a property.');
            return;
        }

        // 2. Collect form data
        const title = document.getElementById('title').value;
        const location = document.getElementById('location').value;
        const price = parseFloat(document.getElementById('price').value);
        const details = document.getElementById('details').value;
        const imageFile = document.getElementById('image-file').files[0];

        // 3. Upload the image to Supabase Storage
        const imageUrl = await uploadImage(imageFile, user.id);

        // 4. Insert data into the 'properties' table
        const { error: dbError } = await supabase
            .from('properties')
            .insert({
                landlord_id: user.id,
                title: title,
                location: location,
                price: price,
                image_url: imageUrl,
                details: details,
                is_verified: false, // NEW listings start as NOT verified
                is_rented: false
            });

        if (dbError) {
            throw new Error(`Database insert failed: ${dbError.message}`);
        }

        messageArea.textContent = 'Listing submitted successfully! It is awaiting Admin approval.';
        messageArea.style.color = 'green';
        document.getElementById('add-property-form').reset(); // Clear the form
        fetchLandlordListings(user.id); // Reload the listing table

    } catch (e) {
        console.error("Listing Error:", e);
        messageArea.textContent = `Listing failed: ${e.message}`;
        messageArea.style.color = 'red';
    } finally {
        submitBtn.disabled = false;
    }
}

// --- NEW HELPER FUNCTION ---
// Helper to render the list of inquiries for a property
function renderInquiries(messages) {
    if (messages.length === 0) {
        return '<p class="no-inquiries">No inquiries yet.</p>';
    }
    return `
        <ul class="inquiry-list">
            ${messages.map(msg => `
                <li>
                    <strong>From: ${msg.user_profiles?.name || 'Unknown Tenant'}</strong>
                    <p class="message-body">${msg.message_body}</p>
                </li>
            `).join('')}
        </ul>
    `;
}

// --- UPDATED FUNCTION ---
// Function to fetch and display the landlord's own listings AND their inquiries
async function fetchLandlordListings(landlordId) {
    const container = document.getElementById('landlord-listings-container');
    container.innerHTML = '<p>Loading your properties...</p>';

    // 1. UPDATED QUERY: Fetch full message details and tenant's name
    const { data: listings, error } = await supabase
        .from('properties')
        .select(`
            *,
            messages (
                id,
                message_body,
                user_profiles ( name )
            )
        `)
        .eq('landlord_id', landlordId)
        .order('id', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="error">Error loading listings: ${error.message}</p>`;
        return;
    }

    if (listings.length === 0) {
        container.innerHTML = '<p>You have no listings yet. Use the form above to add one!</p>';
        return;
    }
    
    // 2. UPDATED RENDERING: Use the helper function to show messages
    const listHTML = listings.map(p => `
        <div class="landlord-listing-card">
            <h4>${p.title} (${p.location})</h4>
            <p><strong>Status:</strong> ${p.is_rented ? 'Rented' : 'Available'}</p>
            <p><strong>Admin Verified:</strong> ${p.is_verified ? '✅ Yes' : '❌ No (Pending Approval)'}</p>
            <p><strong>Price:</strong> Ksh ${p.price.toLocaleString()}</p>
            
            <div class="inquiries-section">
                <h5>Inquiries (${p.messages.length}):</h5>
                ${renderInquiries(p.messages)} 
            </div>
            
            </div>
    `).join('');

    container.innerHTML = listHTML;
}

// DOM Event Listener Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const addForm = document.getElementById('add-property-form');
    if (addForm) {
        addForm.addEventListener('submit', handleNewPropertySubmit);
    }
    
    // Load the landlord's listings on page load
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        fetchLandlordListings(user.id);
    }
});