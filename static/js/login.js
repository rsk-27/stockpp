document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', function (event) {
            const username = loginForm.username.value.trim();
            const password = loginForm.password.value.trim();

            if (!username || !password) {
                event.preventDefault();
                if (loginError) {
                    loginError.textContent = 'Please enter both username and password.';
                    loginError.style.display = 'block';
                }
            }
        });
    }
});
