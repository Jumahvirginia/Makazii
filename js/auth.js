// Add this logic to the bottom of your js/auth.js file

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    
    // Check if the current page is register.html and the form exists
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.querySelector('input[name="role"]:checked').value; // Get the selected role
            
            const registerButton = document.getElementById('register-button');
            registerButton.disabled = true; // Disable button to prevent double-click

            // 1. Sign up the user with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) {
                alert(`Registration failed: ${authError.message}`);
                registerButton.disabled = false;
                return;
            }
            
            // User successfully created in auth.users, now create the profile
            const user = authData.user;

            // 2. Create the profile in the user_profiles table with the selected role
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert([
                    {
                        id: user.id,
                        name: name,
                        role: role
                    }
                ]);

            if (profileError) {
                // If profile creation fails, log the user out to avoid a broken account
                console.error("Profile creation failed:", profileError);
                await supabase.auth.signOut();
                alert('Account created, but profile failed. Please try logging in.');
                window.location.href = '/login.html';
                return;
            }

            // 3. Success! Redirect to the appropriate dashboard
            alert('Registration successful! Redirecting to your dashboard.');
            redirectToDashboard(); // Use the existing function from the previous step
        });
    }

    // --- (Keep the existing login form handling and redirection logic here) ---
});
// --- (Re-insert the redirectToDashboard function here for context) ---

const ROLE_REDIRECTS = {
    'tenant': '/dashboards/tenant.html',
    'landlord': '/dashboards/landlord.html',
    'admin': '/dashboards/admin.html'
};

async function redirectToDashboard() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // If we are on a protected page without a user, redirect to login
        if (window.location.pathname.includes('dashboard')) {
            window.location.href = '/login.html'; 
        }
        return;
    }

    const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error || !data) {
        console.error('Error fetching user role, logging out:', error);
        await supabase.auth.signOut();
        window.location.href = '/login.html';
        return;
    }

    // --- THIS IS THE NEW, FIXED CODE ---
    const userRole = data.role;
    const targetUrl = ROLE_REDIRECTS[userRole]; // e.g., '/dashboards/tenant.html'
    const currentPath = window.location.pathname;

    if (targetUrl) {
        // Check if we are currently on a dashboard page
        if (currentPath.includes('/dashboards/')) {
            
            // If we are on a dashboard, BUT it's not our correct one, redirect.
            // This stops a tenant from viewing /admin.html
            if (!currentPath.endsWith(targetUrl)) {
                window.location.href = targetUrl;
            }
        }
        
        // If we are on a login/register page while already logged in, redirect
        if (currentPath.endsWith('/login.html') || currentPath.endsWith('/register.html')) {
            window.location.href = targetUrl;
        }
    }
}

// --- (Main DOM Content Loaded Listener) ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. LOGIN FORM HANDLER (for login.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginButton = document.getElementById('login-button');
            loginButton.disabled = true;

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                alert(`Login failed: ${error.message}`);
                loginButton.disabled = false;
            } else {
                // Success! Redirect based on role
                redirectToDashboard();
            }
        });
        
        // Check if user is already logged in on the login page and redirect immediately
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                redirectToDashboard();
            }
        });
    }

    // 2. REGISTRATION FORM HANDLER (Your logic from the previous step goes here)
    // ... (Your registerForm event listener and profile creation logic) ...

    // 3. LOGOUT FUNCTIONALITY (Needed on all dashboards)
    document.getElementById('logout-button')?.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = '/login.html';
        } else {
            alert('Logout failed.');
        }
    });

    // 4. PROTECTION HOOK (Run redirect on all protected pages)
    // If the page is a dashboard, ensure the user is logged in and has the right role
    if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('pages')) {
        redirectToDashboard();
    }
});