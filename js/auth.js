// --- 1. REDIRECTION LOGIC ---

const ROLE_REDIRECTS = {
    'tenant': 'dashboards/tenant.html',
    'landlord': 'dashboards/landlord.html',
    'admin': 'dashboards/admin.html'
};

// --- NEW FUNCTION TO LOAD USER INFO ---
async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Not logged in

    const { data, error } = await supabase
        .from('user_profiles')
        .select('username') // We only need the username
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return;
    }

    if (data) {
        const welcomeEl = document.getElementById('welcome-message');
        if (welcomeEl) {
            welcomeEl.textContent = `Welcome, @${data.username}`;
        }
    }
}
async function redirectToDashboard() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // If we are on a protected page without a user, redirect to login
        if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('pages')) {
            window.location.href = 'login.html'; // Use relative path
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
        window.location.href = 'login.html'; // Use relative path
        return;
    }

    const userRole = data.role;
    const targetUrl = ROLE_REDIRECTS[userRole];
    const currentPath = window.location.pathname;

    if (targetUrl) {
        // Check if we are currently on a dashboard page
        if (currentPath.includes('/dashboards/')) {
            // If we are on a dashboard, BUT it's not our correct one, redirect.
            if (!currentPath.endsWith(targetUrl)) {
                window.location.href = `../${targetUrl}`; // Adjust path for being inside /dashboards/
            }
        }
        
        // If we are on a login/register page while already logged in, redirect
        if (currentPath.endsWith('/login.html') || currentPath.endsWith('/register.html') || currentPath.endsWith('/')) {
            window.location.href = targetUrl;
        }
    }
}

// --- 2. MAIN EVENT LISTENER ---

document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIN FORM HANDLER (for login.html) ---
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

    // --- REGISTRATION FORM HANDLER (for register.html) ---
    const registerForm = document.getElementById('register-form');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const username = document.getElementById('username').value; // <-- 1. GET USERNAME
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.querySelector('input[name="role"]:checked').value;
            
            const registerButton = document.getElementById('register-button');
            registerButton.disabled = true;

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
                        username: username, // <-- 2. INSERT USERNAME
                        role: role
                    }
                ]);

            if (profileError) {
                console.error("Profile creation failed:", profileError);
                
                // NEW: Check for unique username error
                if (profileError.message.includes('unique constraint')) {
                    alert('Registration failed: This username is already taken. Please try another one.');
                } else {
                    alert('Account created, but profile failed. Please contact support.');
                }
                
                // We should probably delete the auth user we just created
                // This is advanced, but good practice. For now, we'll just log them out.
                await supabase.auth.signOut();
                registerButton.disabled = false;
                return;
            }

            // 3. Success! Redirect to the appropriate dashboard
            alert('Registration successful! Redirecting to your dashboard.');
            redirectToDashboard();
        });
    }

    // --- LOGOUT FUNCTIONALITY (Needed on all dashboards) ---
    document.getElementById('logout-button')?.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            // Check if we are in a subfolder and adjust path
            if (window.location.pathname.includes('dashboards/') || window.location.pathname.includes('pages/')) {
                window.location.href = '../login.html';
            } else {
                window.location.href = 'login.html';
            }
        } else {
            alert('Logout failed.');
        }
    });

    // --- PROTECTION HOOK (Run redirect on all protected pages) ---
    // If the page is a dashboard or details page, ensure the user is logged in
    if (window.location.pathname.includes('dashboards/') || window.location.pathname.includes('pages/')) {
        redirectToDashboard();loadUserProfile();
    }
});
