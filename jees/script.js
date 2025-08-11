// Initialize theme toggle and login functionality
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    
    // Set initial theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(savedTheme + '-mode');
    updateThemeIcon(savedTheme);
    
    // Theme toggle event
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            const newTheme = isDark ? 'light' : 'dark';
            
            document.body.classList.remove(isDark ? 'dark-mode' : 'light-mode');
            document.body.classList.add(newTheme + '-mode');
            
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }
    
    function updateThemeIcon(theme) {
        if (themeToggle) {
            themeToggle.innerHTML = `<i class="fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`;
        }
    }

    // Login functionality for index.html
    const studentBtn = document.getElementById('student-btn');
    const teacherBtn = document.getElementById('teacher-btn');
    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('password-input');
    const confirmPasswordBtn = document.getElementById('confirm-password-btn');
    const cancelPasswordBtn = document.getElementById('cancel-password-btn');
    const closePasswordModal = document.getElementById('close-password-modal');
    const passwordError = document.getElementById('password-error');

    if (studentBtn) {
        studentBtn.addEventListener('click', () => {
            window.location.href = 'index_murid.html';
        });
    }

    if (teacherBtn) {
        teacherBtn.addEventListener('click', () => {
            passwordModal.style.display = 'block';
            passwordInput.focus();
        });
    }

    if (confirmPasswordBtn) {
        confirmPasswordBtn.addEventListener('click', verifyTeacherPassword);
    }

    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', () => {
            passwordModal.style.display = 'none';
            passwordInput.value = '';
            passwordError.textContent = '';
        });
    }

    if (closePasswordModal) {
        closePasswordModal.addEventListener('click', () => {
            passwordModal.style.display = 'none';
            passwordInput.value = '';
            passwordError.textContent = '';
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyTeacherPassword();
            }
        });
    }

    async function verifyTeacherPassword() {
        const password = passwordInput.value.trim();
        passwordError.textContent = '';

        if (!password) {
            passwordError.textContent = 'Masukkan password guru';
            return;
        }

        try {
            // Check password against Supabase
            const { data, error } = await supabase
                .from('teacher_passwords')
                .select('*')
                .eq('password', password)
                .single();

            if (error || !data) {
                throw new Error('Password salah');
            }

            // Set session flag in localStorage and timestamp
            localStorage.setItem('teacher_authenticated', 'true');
            localStorage.setItem('teacher_auth_time', Date.now());
            
            // Password correct, redirect to teacher page
            window.location.href = 'index_guru.html';

        } catch (error) {
            console.error('Password verification error:', error);
            passwordError.textContent = error.message;
            passwordInput.focus();
        }
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.style.display = 'none';
            passwordInput.value = '';
            passwordError.textContent = '';
        }
    });
});