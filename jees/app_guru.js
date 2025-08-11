// Initialize file manager for teachers
document.addEventListener('DOMContentLoaded', () => {
    initTeacherFileManager();
    // Proses link preview di deskripsi tugas
    document.querySelectorAll('.task-description, .exam-description').forEach(el => {
        processLinksInText(el);
    });
});

function initTeacherFileManager() {
    // Check authentication
    if (!localStorage.getItem('teacher_authenticated')) {
        showNotification('Akses ditolak. Harap login sebagai guru terlebih dahulu.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Check if authentication is older than 8 hours
    const authTime = localStorage.getItem('teacher_auth_time');
    if (authTime && Date.now() - parseInt(authTime) > 8 * 60 * 60 * 1000) {
        localStorage.removeItem('teacher_authenticated');
        localStorage.removeItem('teacher_auth_time');
        showNotification('Sesi telah berakhir. Harap login kembali.', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    const fileInput = document.getElementById('file-upload');
    const dropZone = document.getElementById('drop-zone');
    const fileList = document.getElementById('file-list');
    const uploadFileBtn = document.getElementById('upload-file-btn');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const fileCountElement = document.getElementById('file-count');
    const folderCountElement = document.getElementById('folder-count');
    
    let currentPath = '/';
    let pathHistory = ['/'];
    let currentHistoryIndex = 0;

    // Add logout button to user controls
    const userControls = document.querySelector('.user-controls');
    if (userControls) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn-icon';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        logoutBtn.title = 'Logout';
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('teacher_authenticated');
            localStorage.removeItem('teacher_auth_time');
            window.location.href = 'index.html';
        });
        userControls.insertBefore(logoutBtn, userControls.firstChild);
    }

    // Setup event listeners
    setupEventListeners();
    loadFiles();
    loadFileStats();

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
        
        // Create folder button
        createFolderBtn.addEventListener('click', () => {
            document.getElementById('folder-name-input').value = '';
            document.getElementById('folder-error').textContent = '';
            document.getElementById('create-folder-modal').style.display = 'block';
            document.getElementById('folder-name-input').focus();
        });
        
        // Create folder modal events
        document.getElementById('confirm-folder-btn').addEventListener('click', createFolder);
        document.getElementById('cancel-folder-btn').addEventListener('click', () => {
            document.getElementById('create-folder-modal').style.display = 'none';
        });
        document.getElementById('close-folder-modal').addEventListener('click', () => {
            document.getElementById('create-folder-modal').style.display = 'none';
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
                // Check file size (50MB max for teachers)
                const maxSize = 50 * 1024 * 1024;
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
                        created_by: 'teacher'
                    }], {
                        onConflict: 'path'
                    });
                
                if (dbError) throw dbError;
            }
            
            showNotification('File berhasil diunggah!', 'success');
            loadFiles();
            loadFileStats();
            
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Gagal mengunggah: ' + error.message, 'error');
        } finally {
            // Reset file input
            fileInput.value = '';
            dropZone.style.display = 'none';
        }
    }
    
    async function createFolder() {
        const folderName = document.getElementById('folder-name-input').value.trim();
        const errorElement = document.getElementById('folder-error');
        
        if (!folderName) {
            errorElement.textContent = 'Masukkan nama folder';
            return;
        }
        
        // Validate folder name
        if (/[\\/:*?"<>|]/.test(folderName)) {
            errorElement.textContent = 'Nama folder tidak boleh mengandung karakter: \\ / : * ? " < > |';
            return;
        }
        
        try {
            const folderPath = currentPath === '/' ? `${folderName}/` : `${currentPath}/${folderName}/`;
            
            // First check if folder already exists
            const { data: existingFolder, error: checkError } = await supabase
                .from('files')
                .select('*')
                .eq('path', folderPath)
                .single();
            
            if (existingFolder && !checkError) {
                throw new Error('Folder sudah ada');
            }
            
            // Create folder in storage (empty file with trailing slash)
            const { error: storageError } = await supabase.storage
                .from('files')
                .upload(`${folderPath}.empty`, new Blob());
            
            if (storageError && storageError.message !== 'The resource already exists') {
                throw storageError;
            }
            
            // Then save folder metadata to database
            const { error: dbError } = await supabase
                .from('files')
                .insert([{
                    name: folderName,
                    path: folderPath,
                    is_folder: true,
                    parent_path: currentPath === '/' ? '/' : currentPath,
                    created_by: 'teacher'
                }]);
            
            if (dbError) throw dbError;
            
            showNotification('Folder berhasil dibuat!', 'success');
            document.getElementById('create-folder-modal').style.display = 'none';
            loadFiles();
            loadFileStats();
            
        } catch (error) {
            console.error('Error creating folder:', error);
            errorElement.textContent = 'Gagal membuat folder: ' + error.message;
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
            
            // Update file stats in the current view
            const fileCount = files ? files.filter(f => !f.is_folder).length : 0;
            const folderCount = files ? files.filter(f => f.is_folder).length : 0;
            document.getElementById('file-count').textContent = `${fileCount} file`;
            document.getElementById('folder-count').textContent = `${folderCount} folder`;
            
        } catch (error) {
            console.error('Error loading files:', error);
            showNotification('Gagal memuat daftar file', 'error');
        }
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
                    <button class="action-btn rename-btn" title="Rename">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="action-btn download-btn" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Add folder navigation
            if (file.is_folder) {
                fileItem.querySelector('.file-name').addEventListener('click', () => {
                    navigateTo(file.path);
                });
            }
            
            // Add rename action
            fileItem.querySelector('.rename-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                showRenameModal(file);
            });
            
            // Add download action
            fileItem.querySelector('.download-btn').addEventListener('click', () => {
                window.open(file.url, '_blank');
            });
            
            // Add delete action
            fileItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteItem(file);
            });
            
            fileList.appendChild(fileItem);
        });
    }
    
    // Ganti fungsi showRenameModal dengan versi yang lebih sederhana
async function showRenameModal(item) {
    const modal = document.getElementById('rename-modal');
    const renameInput = document.getElementById('rename-input');
    const errorElement = document.createElement('div');
    errorElement.id = 'rename-error';
    errorElement.className = 'error-message';
    
    // Update modal title based on item type
    document.getElementById('rename-modal-title').innerHTML = 
        `<i class="fas fa-edit"></i> Ubah Nama ${item.is_folder ? 'Folder' : 'File'}`;
    
    // Set current name
    renameInput.value = item.name;
    
    // Clear any previous error
    errorElement.textContent = '';
    
    // Add error element if not exists
    if (!document.getElementById('rename-error')) {
        renameInput.after(errorElement);
    }
    
    // Show modal
    modal.style.display = 'block';
    renameInput.focus();
    renameInput.select();
    
    // Handle confirm button
    document.getElementById('confirm-rename-btn').onclick = async () => {
        const newName = renameInput.value.trim();
        
        if (!newName) {
            errorElement.textContent = 'Masukkan nama baru';
            return;
        }
        
        if (/[\\/:*?"<>|]/.test(newName)) {
            errorElement.textContent = 'Nama tidak boleh mengandung karakter: \\ / : * ? " < > |';
            return;
        }
        
        try {
            await renameItem(item, newName);
            modal.style.display = 'none';
            loadFiles();
            showNotification(`${item.is_folder ? 'Folder' : 'File'} berhasil diubah`, 'success');
        } catch (error) {
            console.error('Error renaming:', error);
            errorElement.textContent = error.message;
        }
    };
    
    // Handle cancel button
    document.getElementById('cancel-rename-btn').onclick = () => {
        modal.style.display = 'none';
    };
}

// Tambahkan event listener untuk close button modal rename
document.getElementById('close-rename-modal').addEventListener('click', () => {
    document.getElementById('rename-modal').style.display = 'none';
});
    
    async function renameItem(item, newName) {
        try {
            if (item.is_folder) {
                // Get all files in this folder and subfolders
                const { data: folderContents, error: listError } = await supabase
                    .from('files')
                    .select('*')
                    .like('path', `${item.path}%`);
                
                if (listError) throw listError;
                
                // Calculate new base path
                const parentPath = item.parent_path === '/' ? '' : item.parent_path;
                const newBasePath = parentPath + '/' + newName + '/';
                const oldBasePath = item.path;
                
                // Rename folder in storage (create new empty marker)
                await supabase.storage
                    .from('files')
                    .upload(`${newBasePath}.empty`, new Blob());
                
                // Update all file paths in database
                for (const file of folderContents) {
                    const newPath = file.path.replace(oldBasePath, newBasePath);
                    
                    const { error: updateError } = await supabase
                        .from('files')
                        .update({
                            name: file.path === oldBasePath ? newName : file.name,
                            path: newPath,
                            parent_path: file.parent_path === oldBasePath.slice(0, -1) ? 
                                newBasePath.slice(0, -1) : 
                                file.parent_path.replace(oldBasePath.slice(0, -1), newBasePath.slice(0, -1))
                        })
                        .eq('path', file.path);
                    
                    if (updateError) throw updateError;
                    
                    // For files (not folders), move them in storage
                    if (!file.is_folder) {
                        const { data: fileData, error: moveError } = await supabase.storage
                            .from('files')
                            .move(file.path, newPath);
                        
                        if (moveError) throw moveError;
                    }
                }
                
                // Delete old empty folder marker
                await supabase.storage
                    .from('files')
                    .remove([`${oldBasePath}.empty`]);
                
            } else {
                // For files
                const parentPath = item.parent_path === '/' ? '' : item.parent_path;
                const newPath = parentPath + '/' + newName;
                
                // Move file in storage
                const { data: movedFile, error: moveError } = await supabase.storage
                    .from('files')
                    .move(item.path, newPath);
                
                if (moveError) throw moveError;
                
                // Update file record in database
                const { error: updateError } = await supabase
                    .from('files')
                    .update({
                        name: newName,
                        path: newPath
                    })
                    .eq('path', item.path);
                
                if (updateError) throw updateError;
            }
            
        } catch (error) {
            console.error('Error renaming item:', error);
            throw new Error(`Gagal mengubah nama: ${error.message}`);
        }
    }
    
    async function deleteItem(item) {
        if (!confirm(`Apakah Anda yakin ingin menghapus ${item.is_folder ? 'folder' : 'file'} "${item.name}"?`)) {
            return;
        }
        
        try {
            if (item.is_folder) {
                // Delete all contents in the folder first
                const { data: folderContents, error: listError } = await supabase
                    .from('files')
                    .select('*')
                    .like('path', `${item.path}%`);
                
                if (listError) throw listError;
                
                // Delete files from storage
                const filesToDelete = folderContents
                    .filter(f => !f.is_folder)
                    .map(f => f.path);
                
                if (filesToDelete.length > 0) {
                    const { error: deleteFilesError } = await supabase.storage
                        .from('files')
                        .remove(filesToDelete);
                    
                    if (deleteFilesError) throw deleteFilesError;
                }
                
                // Delete folder records from database
                const { error: deleteFolderError } = await supabase
                    .from('files')
                    .delete()
                    .like('path', `${item.path}%`);
                
                if (deleteFolderError) throw deleteFolderError;
                
                // Delete the empty folder marker from storage
                const { error: deleteEmptyError } = await supabase.storage
                    .from('files')
                    .remove([`${item.path}.empty`]);
                
                if (deleteEmptyError && deleteEmptyError.message !== 'Object not found') {
                    throw deleteEmptyError;
                }
            } else {
                // Delete single file
                const { error: deleteError } = await supabase.storage
                    .from('files')
                    .remove([item.path]);
                
                if (deleteError) throw deleteError;
                
                // Delete file record from database
                const { error: dbError } = await supabase
                    .from('files')
                    .delete()
                    .eq('path', item.path);
                
                if (dbError) throw dbError;
            }
            
            showNotification(`${item.is_folder ? 'Folder' : 'File'} berhasil dihapus`, 'success');
            loadFiles();
            loadFileStats();
            
        } catch (error) {
            console.error('Error deleting item:', error);
            showNotification(`Gagal menghapus ${item.is_folder ? 'folder' : 'file'}: ${error.message}`, 'error');
        }
    }
    
    function updateBreadcrumb() {
        const breadcrumbPath = document.getElementById('breadcrumb-path');
        if (!breadcrumbPath) return;
        
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
                navigateTo(pathSoFar + (index === parts.length - 1 ? '/' : ''));
            });
            
            breadcrumbPath.appendChild(item);
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
    
    async function loadFileStats() {
        try {
            // Get total file count
            const { count: fileCount } = await supabase
                .from('files')
                .select('*', { count: 'exact', head: true })
                .eq('is_folder', false);
            
            // Get total folder count
            const { count: folderCount } = await supabase
                .from('files')
                .select('*', { count: 'exact', head: true })
                .eq('is_folder', true);
            
            document.getElementById('file-count').textContent = `${fileCount || 0} file`;
            document.getElementById('folder-count').textContent = `${folderCount || 0} folder`;
            
        } catch (error) {
            console.error('Error loading file stats:', error);
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(1) + ' GB';
    }
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