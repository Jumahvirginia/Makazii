// Function to fetch and display listings awaiting verification
async function fetchPendingListings() {
    const container = document.getElementById('pending-listings-container');
    container.innerHTML = '<p>Loading pending listings...</p>';

    // Query 'properties' table for any listing that is NOT verified
    const { data: listings, error } = await supabase
        .from('properties')
        .select(`
            *,
            user_profiles ( name ) 
        `) // Join with user_profiles to get the landlord's name
        .eq('is_verified', false)
        .order('id', { ascending: true });

    if (error) {
        container.innerHTML = `<p class="error">Error loading listings: ${error.message}</p>`;
        return;
    }

    if (listings.length === 0) {
        container.innerHTML = '<p>No properties are currently awaiting approval. Good job!</p>';
        return;
    }

    // Render each pending listing as an "admin card"
    container.innerHTML = listings.map(p => `
        <div class="admin-card">
            <div class="card-content">
                <h4>${p.title}</h4>
                <p><strong>Landlord:</strong> ${p.user_profiles?.name || 'Unknown'}</p>
                <p><strong>Location:</strong> ${p.location}</p>
                <p><strong>Price:</strong> Ksh ${p.price.toLocaleString()}</p>
                <p><strong>Details:</strong> ${p.details}</p>
                <a href="${p.image_url}" target="_blank" class="small-btn">View Image</a>
                <a href="../pages/property_details.html?id=${p.id}" target="_blank" class="small-btn">View Details Page</a>
            </div>
            <div class="card-actions">
                <button class="approve-btn" data-id="${p.id}"><i class="fas fa-check-circle"></i> Approve</button>
                <button class="deny-btn" data-id="${p.id}"><i class="fas fa-times-circle"></i> Deny</button>
            </div>
        </div>
    `).join('');

    // Add event listeners to the new buttons
    addAdminEventListeners();
}

// Function to handle the "Approve" action
async function approveListing(propertyId) {
    // Update the property's 'is_verified' status to true
    const { error } = await supabase
        .from('properties')
        .update({ is_verified: true })
        .eq('id', propertyId);

    if (error) {
        alert(`Failed to approve listing: ${error.message}`);
    } else {
        alert('Listing approved and is now public!');
        fetchPendingListings(); // Refresh the list
    }
}

// Function to handle the "Deny" action
async function denyListing(propertyId) {
    // For MVP, we'll just delete the listing. 
    // (A softer approach would be to set a 'is_rejected' flag)
    if (!confirm('Are you sure you want to deny and delete this listing? This cannot be undone.')) {
        return;
    }
    
    const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);
        
    if (error) {
        alert(`Failed to deny listing: ${error.message}`);
    } else {
        alert('Listing denied and deleted.');
        fetchPendingListings(); // Refresh the list
    }
}

// Helper function to attach event listeners to buttons
function addAdminEventListeners() {
    document.querySelectorAll('.approve-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            approveListing(id);
        });
    });

    document.querySelectorAll('.deny-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            denyListing(id);
        });
    });
}

// DOM Event Listener Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Load pending listings immediately
    fetchPendingListings();
});