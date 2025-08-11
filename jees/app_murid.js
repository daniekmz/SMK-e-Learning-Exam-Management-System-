// Initialize file manager for students
document.addEventListener('DOMContentLoaded', () => {
    initStudentFileManager();
    // Proses link preview di deskripsi materi
    document.querySelectorAll('.materi-desc, .task-description').forEach(el => {
        processLinksInText(el);
        });
});

function initStudentFileManager() {
    const fileInput = document.getElementById('file-upload');
    const dropZone = document.getElementById('drop-zone');
    const fileList = document.getElementById('file-list');
    const uploadFileBtn = document.getElementById('upload-file-btn');
    
    let currentPath = '/';
    let pathHistory = ['/'];
    let currentHistoryIndex = 0;
    
    // Test Supabase connection
    testSupabaseConnection();
    
    // Setup event listeners
    setupEventListeners();
    loadFiles();
    
    // Add logout button to user controls
    const userControls = document.querySelector('.user-controls');
    if (userControls) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn-icon';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        logoutBtn.title = 'Logout';
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('studentInfo');
            window.location.href = 'index.html';
        });
        userControls.insertBefore(logoutBtn, userControls.firstChild);
    }

    function setupEventListeners() {
        // File upload
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        
        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            dropZone.addEventListener(event, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(event => {
            dropZone.addEventListener(event, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(event => {
            dropZone.addEventListener(event, unhighlight, false);
        });
        
        dropZone.addEventListener('drop', handleDrop, false);
        
        // Upload button
        uploadFileBtn.addEventListener('click', () => {
            dropZone.style.display = dropZone.style.display === 'none' ? 'flex' : 'none';
        });
        
        // Add home button to breadcrumb
        const breadcrumb = document.querySelector('.breadcrumb');
        const homeBtn = document.createElement('button');
        homeBtn.className = 'btn-icon breadcrumb-home';
        homeBtn.innerHTML = '<i class="fas fa-home"></i>';
        homeBtn.title = 'Go to root folder';
        homeBtn.addEventListener('click', () => {
            navigateTo('/');
        });
        breadcrumb.insertBefore(homeBtn, breadcrumb.firstChild);
        
        // Add back button
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-icon breadcrumb-back';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
        backBtn.title = 'Go back';
        backBtn.addEventListener('click', navigateBack);
        breadcrumb.insertBefore(backBtn, breadcrumb.firstChild);

        // Handle soal button click
        const soalBtn = document.getElementById('soal-btn');
        if (soalBtn) {
            soalBtn.addEventListener('click', () => {
                const studentInfo = getStudentInfo();
                if (!studentInfo) {
                    showStudentInfoModal();
                } else {
                    loadAvailableExams();
                }
            });
        }
    }
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropZone.classList.add('dragover');
    }
    
    function unhighlight() {
        dropZone.classList.remove('dragover');
    }
    
    function handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files);
        }
    }
    
    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            handleFileUpload(files);
        }
    }
    
    async function handleFileUpload(files) {
        try {
            for (const file of files) {
                // Check file size (10MB max for students)
                const maxSize = 10 * 1024 * 1024;
                if (file.size > maxSize) {
                    showNotification(`File ${file.name} terlalu besar (maks ${formatFileSize(maxSize)})`, 'error');
                    continue;
                }
                
                // Sanitize filename and create path
                const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const filePath = currentPath === '/' ? sanitizedFileName : `${currentPath}/${sanitizedFileName}`;
                
                // Upload file to Supabase storage
                const { error: uploadError } = await supabase.storage
                    .from('files')
                    .upload(filePath, file, {
                        upsert: true,
                        contentType: file.type
                    });
                
                if (uploadError) throw uploadError;
                
                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('files')
                    .getPublicUrl(filePath);
                
                // Save file metadata to database
                const { error: dbError } = await supabase
                    .from('files')
                    .upsert([{
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        path: filePath,
                        url: publicUrl,
                        is_folder: false,
                        parent_path: currentPath === '/' ? '/' : currentPath,
                        uploaded_by: 'student'
                    }], {
                        onConflict: 'path'
                    });
                
                if (dbError) throw dbError;
            }
            
            showNotification('Tugas berhasil diunggah!', 'success');
            loadFiles();
            
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Gagal mengunggah: ' + error.message, 'error');
        } finally {
            // Reset file input
            fileInput.value = '';
        }
    }
    
    async function loadFiles() {
        try {
            const { data: files, error } = await supabase
                .from('files')
                .select('*')
                .eq('parent_path', currentPath)
                .order('is_folder', { ascending: false }) // Folders first
                .order('name', { ascending: true });
            
            if (error) throw error;
            
            renderFileList(files || []);
            updateBreadcrumb();
            
        } catch (error) {
            console.error('Error loading files:', error);
            showNotification('Gagal memuat daftar file', 'error');
        }
    }
    
    function updateBreadcrumb() {
        const breadcrumbPath = document.getElementById('breadcrumb-path');
        breadcrumbPath.innerHTML = '';
        
        if (currentPath === '/') return;
        
        const parts = currentPath.split('/').filter(part => part);
        let pathSoFar = '';
        
        parts.forEach((part, index) => {
            pathSoFar += (pathSoFar ? '/' : '') + part;
            const separator = index > 0 ? document.createElement('span') : null;
            if (separator) {
                separator.className = 'breadcrumb-separator';
                separator.textContent = '/';
                breadcrumbPath.appendChild(separator);
            }
            
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = part;
            item.addEventListener('click', () => {
                navigateTo(pathSoFar);
            });
            
            breadcrumbPath.appendChild(item);
        });
    }
    
    function renderFileList(files) {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;
        
        fileList.innerHTML = `
            <div class="file-list-header">
                <span>Nama</span>
                <span>Tanggal</span>
                <span>Ukuran</span>
                <span>Aksi</span>
            </div>
        `;
        
        if (files.length === 0) {
            fileList.innerHTML += '<div class="no-files">Tidak ada file di folder ini</div>';
            return;
        }
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name ${file.is_folder ? 'folder' : ''}">
                    <i class="fas ${file.is_folder ? 'fa-folder' : 'fa-file'}"></i>
                    ${file.name}
                </span>
                <span class="file-date">${new Date(file.created_at).toLocaleDateString()}</span>
                <span class="file-size">${file.is_folder ? '-' : formatFileSize(file.size)}</span>
                <div class="file-actions">
                    <button class="action-btn download-btn" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
            
            // Add folder navigation
            if (file.is_folder) {
                fileItem.querySelector('.file-name').addEventListener('click', () => {
                    navigateTo(file.path);
                });
            }
            
            // Add download action
            fileItem.querySelector('.download-btn').addEventListener('click', () => {
                window.open(file.url, '_blank');
            });
            
            fileList.appendChild(fileItem);
        });
    }
    
    function navigateTo(path) {
        currentPath = path;
        
        // Update history
        if (pathHistory[currentHistoryIndex] !== path) {
            pathHistory = pathHistory.slice(0, currentHistoryIndex + 1);
            pathHistory.push(path);
            currentHistoryIndex = pathHistory.length - 1;
        }
        
        loadFiles();
    }
    
    function navigateBack() {
        if (currentHistoryIndex > 0) {
            currentHistoryIndex--;
            currentPath = pathHistory[currentHistoryIndex];
            loadFiles();
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(1) + ' GB';
    }
    
    async function testSupabaseConnection() {
        try {
            const { error } = await supabase
                .from('files')
                .select('id')
                .limit(1);
            
            if (error) throw error;
            
            console.log('Connected to Supabase successfully');
        } catch (error) {
            console.error('Supabase connection error:', error);
            showNotification('Database connection error', 'error');
        }
    }
}

function getStudentInfo() {
    try {
        const studentInfo = JSON.parse(localStorage.getItem('studentInfo') || '{}');
        if (studentInfo && studentInfo.name && studentInfo.class) {
            return studentInfo;
        }
        return null;
    } catch (e) {
        console.error('Error parsing student info:', e);
        return null;
    }
}

async function loadAvailableExams() {
    try {
        // Get student info
        const studentInfo = getStudentInfo();
        const studentClass = studentInfo?.class;
        
        if (!studentClass) {
            showNotification('Harap masukkan data kelas Anda terlebih dahulu', 'error');
            showStudentInfoModal();
            return;
        }
        
        // Show loading state
        const container = document.getElementById('exam-list');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Memuat daftar ujian...</p>
                </div>
            `;
        }

        // Load exams for the student's class
        const { data: exams, error } = await supabase
            .from('exams')
            .select('*')
            .eq('published', true)
            .contains('classes', [studentClass])
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }

        if (!exams || exams.length === 0) {
            container.innerHTML = `
                <div class="no-exams">
                    <i class="fas fa-clipboard-question"></i>
                    <p>Tidak ada ujian yang tersedia untuk kelas Anda saat ini</p>
                </div>
            `;
            return;
        }
        
        renderExamList(exams);
        
    } catch (error) {
        console.error('Error loading exams:', error);
        const container = document.getElementById('exam-list');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Gagal memuat daftar ujian</p>
                    <p class="error-detail">${error.message}</p>
                    <button class="btn secondary" onclick="loadAvailableExams()">
                        <i class="fas fa-sync-alt"></i> Coba Lagi
                    </button>
                </div>
            `;
        }
        showNotification('Gagal memuat daftar ujian: ' + error.message, 'error');
    }
}

function renderExamList(exams) {
    const container = document.getElementById('exam-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    exams.forEach(exam => {
        const examElement = document.createElement('div');
        examElement.className = 'exam-item';
        examElement.innerHTML = `
            <div class="exam-item-header">
                <h4>${exam.title}</h4>
                <span class="exam-date">${new Date(exam.date).toLocaleDateString()}</span>
            </div>
            <div class="exam-item-details">
                <p>${exam.description || 'Tidak ada deskripsi'}</p>
                <div class="exam-meta">
                    <span><i class="fas fa-clock"></i> ${exam.duration} menit</span>
                    <span><i class="fas fa-question-circle"></i> ${exam.question_count || 0} soal</span>
                </div>
            </div>
            <div class="exam-item-actions">
                <button class="btn primary start-exam-btn" data-exam-id="${exam.id}">
                    <i class="fas fa-play"></i> Mulai Ujian
                </button>
            </div>
        `;
        
        container.appendChild(examElement);
    });
    
    // Set up start exam buttons with validation
    document.querySelectorAll('.start-exam-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const studentInfo = getStudentInfo();
            if (!studentInfo) {
                showNotification('Harap masukkan nama dan kelas Anda terlebih dahulu', 'error');
                showStudentInfoModal();
            } else {
                const examId = e.target.closest('button').dataset.examId;
                window.location.href = `soal.html?examId=${examId}`;
            }
        });
    });
}

function showStudentInfoModal() {
    const modal = document.getElementById('student-info-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    
    // Pre-fill if partial info exists
    const existingInfo = getStudentInfo() || {};
    document.getElementById('student-name').value = existingInfo.name || '';
    document.getElementById('student-class').value = existingInfo.class || '';
    
    // Clear previous event listeners
    const startBtn = document.getElementById('start-exam-btn');
    startBtn.replaceWith(startBtn.cloneNode(true));
    
    document.getElementById('start-exam-btn').addEventListener('click', () => {
        const name = document.getElementById('student-name').value.trim();
        const studentClass = document.getElementById('student-class').value;
        const errorElement = document.getElementById('student-info-error');
        
        if (!name) {
            errorElement.textContent = 'Harap isi nama lengkap';
            return;
        }
        
        if (!studentClass) {
            errorElement.textContent = 'Harap pilih kelas';
            return;
        }
        
        const studentInfo = {
            name,
            class: studentClass
        };
        
        // Save to localStorage
        localStorage.setItem('studentInfo', JSON.stringify(studentInfo));
        
        // Close modal and load exams
        modal.style.display = 'none';
        loadAvailableExams();
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}