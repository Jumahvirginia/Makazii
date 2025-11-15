// js/admin.js (Complete New Version)

// --- 1. NEW: LOAD ADMIN ANALYTICS ---
async function loadAdminAnalytics() {
    try {
        // We use { count: 'exact', head: true } to only fetch the count, not the data
        
        // Get tenant count
        const { count: tenantCount, error: tenantError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'tenant');
        if (tenantError) throw tenantError;

        // Get landlord count
        const { count: landlordCount, error: landlordError } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'landlord');
        if (landlordError) throw landlordError;

        // Get active listings count
        const { count: activeCount, error: activeError } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'available');
        if (activeError) throw activeError;

        // Get rented listings count
        const { count: rentedCount, error: rentedError } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rented');
        if (rentedError) throw rentedError;

        // Update the HTML
        document.getElementById('stat-tenants').textContent = tenantCount;
        document.getElementById('stat-landlords').textContent = landlordCount;
        document.getElementById('stat-active-listings').textContent = activeCount;
        document.getElementById('stat-rented-properties').textContent = rentedCount;

    } catch (error) {
        console.error('Error loading admin analytics:', error);
        document.getElementById('stat-tenants').textContent = 'Error';
    }
}


// --- 2. PENDING APPROVALS FUNCTIONS ---

// Function to fetch and display listings awaiting verification
async function fetchPendingListings() {
    const container = document.getElementById('pending-listings-container');
    container.innerHTML = '<p>Loading pending listings...</p>';

    // Query 'properties' table for any listing that is NOT verified
    const { data: listings, error } = await supabase
        .from('properties')
        .select(`
            *,
            user_profiles ( name ),
            cover_image_url
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
                <p><strong>Details:</strong> ${p.details.substring(0, 100)}...</p>
                <a href="${p.cover_image_url}" target="_blank" class="small-btn">View Image</a>
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
    if (!confirm('Are you sure you want to deny and delete this listing? This cannot be undone.')) {
        return;
    }
    
    // We must delete from 'tour_requests' first if any exist
    await supabase
        .from('tour_requests')
        .delete()
        .eq('property_id', propertyId);
        
    // Now we can delete the property
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
            const id = e.target.closest('button').dataset.id;
            approveListing(id);
        });
    });

    document.querySelectorAll('.deny-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            denyListing(id);
        });
    });
}

// --- 3. DOM EVENT LISTENER INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Load both analytics and pending listings
    loadAdminAnalytics();
    fetchPendingListings();
});