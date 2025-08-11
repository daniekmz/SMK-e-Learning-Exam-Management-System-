// Teacher Exam Management
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('teacher-exam-list')) {
        initExamManagement();
    }
    
    // Initialize import functionality
    initImportExam();
});

let currentEditingExam = null;
let currentEditingQuestions = [];
let selectedClasses = [];

function initExamManagement() {
    // Set up create exam button
    const createExamBtn = document.getElementById('create-exam-btn');
    const createFirstExamBtn = document.getElementById('create-first-exam-btn');
    
    if (createExamBtn) {
        createExamBtn.addEventListener('click', showCreateExamModal);
    }
    
    if (createFirstExamBtn) {
        createFirstExamBtn.addEventListener('click', showCreateExamModal);
    }
    
    // Set up add class button
    document.getElementById('add-class-btn')?.addEventListener('click', showAddClassModal);
    
    // Load existing exams
    loadTeacherExams();
}

async function loadTeacherExams() {
    try {
        const { data: exams, error } = await supabase
            .from('exams')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        renderExamList(exams || []);
        
    } catch (error) {
        console.error('Error loading exams:', error);
        showNotification('Gagal memuat daftar ujian', 'error');
    }
}

function renderExamList(exams) {
    const container = document.getElementById('teacher-exam-list');
    
    if (!container) return;
    
    if (exams.length === 0) {
        container.innerHTML = `
            <div class="no-exams">
                <i class="fas fa-clipboard-question"></i>
                <p>Belum ada ujian yang dibuat</p>
                <button id="create-first-exam-btn" class="btn primary">
                    <i class="fas fa-plus"></i> Buat Ujian Pertama
                </button>
            </div>
        `;
        document.getElementById('create-first-exam-btn').addEventListener('click', showCreateExamModal);
        return;
    }
    
    container.innerHTML = '';
    
    exams.forEach(exam => {
        const examElement = document.createElement('div');
        examElement.className = 'exam-item';
        examElement.innerHTML = `
            <div class="exam-item-header">
                <h4>${exam.title}</h4>
                <span class="exam-status ${exam.published ? 'published' : 'draft'}">
                    ${exam.published ? 'Published' : 'Draft'}
                </span>
            </div>
            <div class="exam-item-details">
                <p>${exam.description || 'Tidak ada deskripsi'}</p>
                <div class="exam-meta">
                    <span><i class="fas fa-clock"></i> ${exam.duration} menit</span>
                    <span><i class="fas fa-calendar-alt"></i> ${new Date(exam.date).toLocaleDateString()}</span>
                    <span><i class="fas fa-question-circle"></i> ${exam.question_count || 0} soal</span>
                </div>
            </div>
            <div class="exam-item-actions">
                <button class="btn secondary edit-exam-btn" data-exam-id="${exam.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn primary manage-questions-btn" data-exam-id="${exam.id}">
                    <i class="fas fa-question-circle"></i> Kelola Soal
                </button>
                <button class="btn ${exam.published ? 'secondary' : 'primary'} publish-exam-btn" data-exam-id="${exam.id}">
                    <i class="fas fa-${exam.published ? 'eye' : 'check'}"></i> ${exam.published ? 'Sudah Dipublikasikan' : 'Belum Dipublikasikan'}
                </button>
                <button class="btn danger delete-exam-btn" data-exam-id="${exam.id}">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </div>
        `;
        
        container.appendChild(examElement);
    });
    
    // Set up event listeners for all exam buttons
    document.querySelectorAll('.edit-exam-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            editExam(e.target.closest('button').dataset.examId);
        });
    });
    
    document.querySelectorAll('.manage-questions-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            manageQuestions(e.target.closest('button').dataset.examId);
        });
    });
    
    document.querySelectorAll('.publish-exam-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            togglePublishExam(e.target.closest('button').dataset.examId);
        });
    });
    
    document.querySelectorAll('.delete-exam-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteExam(e.target.closest('button').dataset.examId);
        });
    });
}

function showCreateExamModal() {
    const modal = document.getElementById('create-exam-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    
    // Reset form
    document.getElementById('exam-title-input').value = '';
    document.getElementById('exam-description-input').value = '';
    document.getElementById('exam-duration-input').value = '60';
    document.getElementById('exam-date-input').valueAsDate = new Date();
    document.getElementById('exam-error').textContent = '';
    
    // Load classes for selection
    loadClassesForExam();
    
    // Set up modal buttons
    document.getElementById('cancel-exam-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    document.getElementById('save-exam-btn').addEventListener('click', saveExam);
}

function showAddClassModal() {
    const modal = document.getElementById('add-class-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    document.getElementById('new-class-name').value = '';
    document.getElementById('class-error').textContent = '';
    
    // Set up modal buttons
    document.getElementById('cancel-add-class-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    document.getElementById('confirm-add-class-btn').addEventListener('click', addNewClass);
}

async function addNewClass() {
    const className = document.getElementById('new-class-name').value.trim();
    const errorElement = document.getElementById('class-error');
    
    if (!className) {
        errorElement.textContent = 'Masukkan nama kelas';
        return;
    }
    
    try {
        // Check if class already exists
        const { data: existingClass, error: checkError } = await supabase
            .from('classes')
            .select('*')
            .eq('name', className)
            .single();
        
        if (existingClass && !checkError) {
            throw new Error('Kelas sudah ada');
        }
        
        // Add new class
        const { error } = await supabase
            .from('classes')
            .insert([{ name: className }]);
        
        if (error) throw error;
        
        showNotification('Kelas berhasil ditambahkan', 'success');
        document.getElementById('add-class-modal').style.display = 'none';
        loadClassesForExam();
        
    } catch (error) {
        console.error('Error adding class:', error);
        errorElement.textContent = 'Gagal menambahkan kelas: ' + error.message;
    }
}

async function loadClassesForExam() {
    try {
        const { data: classes, error } = await supabase
            .from('classes')
            .select('*')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        const container = document.getElementById('class-checkboxes');
        if (container) {
            // Buat struktur tabel
            container.innerHTML = `
                <table class="class-table">
                    <thead>
                        <tr>
                            <th>Pilih</th>
                            <th>Nama Kelas</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="class-table-body"></tbody>
                </table>
            `;
            
            const tbody = document.getElementById('class-table-body');
            
            classes.forEach(cls => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <input type="checkbox" class="exam-class" value="${cls.name}" 
                               ${selectedClasses.includes(cls.name) ? 'checked' : ''}>
                    </td>
                    <td>${cls.name}</td>
                    <td>
                        <button class="btn-icon delete-class-btn" data-class-name="${cls.name}">
                            Hapus
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
                
                // Tambahkan event listener untuk tombol hapus
                row.querySelector('.delete-class-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    const modal = document.getElementById('delete-class-modal');
                    if (!modal) return;
                    
                    modal.style.display = 'block';
                    
                    // Set up modal buttons
                    document.getElementById('cancel-delete-class-btn').addEventListener('click', () => {
                        modal.style.display = 'none';
                    });
                    
                    document.getElementById('confirm-delete-class-btn').addEventListener('click', async () => {
                        try {
                            const { error } = await supabase
                                .from('classes')
                                .delete()
                                .eq('name', cls.name);
                            
                            if (error) throw error;
                            
                            showNotification('Kelas berhasil dihapus', 'success');
                            modal.style.display = 'none';
                            loadClassesForExam();
                            
                        } catch (err) {
                            console.error('Error deleting class:', err);
                            showNotification('Gagal menghapus kelas: ' + err.message, 'error');
                        }
                    });
                    
                    // Close modal when clicking outside
                    window.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            modal.style.display = 'none';
                        }
                    });
                });
            });
        }
    } catch (error) {
        console.error('Error loading classes:', error);
        showNotification('Gagal memuat daftar kelas', 'error');
    }
}

async function saveExam() {
    const title = document.getElementById('exam-title-input')?.value.trim();
    const description = document.getElementById('exam-description-input')?.value.trim();
    const duration = parseInt(document.getElementById('exam-duration-input')?.value);
    const date = document.getElementById('exam-date-input')?.value;
    const errorElement = document.getElementById('exam-error');
    
    if (!title || !description || !duration || !date || !errorElement) {
        console.error('Required form elements not found');
        return;
    }
    
    // Get selected classes
    selectedClasses = Array.from(document.querySelectorAll('.exam-class:checked')).map(cb => cb.value);
    
    // Validate inputs
    if (!title) {
        errorElement.textContent = 'Judul ujian harus diisi';
        return;
    }
    
    if (duration < 5 || duration > 180) {
        errorElement.textContent = 'Durasi harus antara 5-180 menit';
        return;
    }
    
    if (!date) {
        errorElement.textContent = 'Tanggal harus diisi';
        return;
    }
    
    if (selectedClasses.length === 0) {
        errorElement.textContent = 'Pilih minimal satu kelas';
        return;
    }
    
    try {
        // Create exam record
        const { data: exam, error } = await supabase
            .from('exams')
            .insert([{
                title,
                description,
                duration,
                date,
                classes: selectedClasses,
                published: false,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        // Close modal and proceed to manage questions
        document.getElementById('create-exam-modal').style.display = 'none';
        currentEditingExam = exam;
        currentEditingQuestions = [];
        showAddQuestionModal();
        
    } catch (error) {
        console.error('Error saving exam:', error);
        errorElement.textContent = 'Gagal menyimpan ujian: ' + error.message;
    }
}

function showAddQuestionModal() {
    const modal = document.getElementById('add-question-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    
    // Reset form dan hapus ID edit jika ada
    const editIdInput = document.getElementById('edit-question-id');
    if (editIdInput) editIdInput.remove();
    
    // Reset form
    document.getElementById('mc-question').value = '';
    document.querySelectorAll('.option-input').forEach((input, i) => {
        input.value = '';
        if (i === 0) {
            const radio = input.closest('.option-item')?.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        }
    });
    document.getElementById('mc-points').value = '5';
    document.getElementById('essay-question').value = '';
    document.getElementById('essay-points').value = '10';
    document.getElementById('question-error').textContent = '';
    
    // Set tab to multiple choice by default
    const mcTab = document.querySelector('.tab-btn[data-type="multiple-choice"]');
    const essayTab = document.querySelector('.tab-btn[data-type="essay"]');
    const mcForm = document.getElementById('multiple-choice-form');
    const essayForm = document.getElementById('essay-form');
    
    if (mcTab && essayTab && mcForm && essayForm) {
        mcTab.classList.add('active');
        essayTab.classList.remove('active');
        mcForm.style.display = 'block';
        essayForm.style.display = 'none';
    }
    
    // Set up tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mcForm = document.getElementById('multiple-choice-form');
            const essayForm = document.getElementById('essay-form');
            if (mcForm && essayForm) {
                mcForm.style.display = btn.dataset.type === 'multiple-choice' ? 'block' : 'none';
                essayForm.style.display = btn.dataset.type === 'essay' ? 'block' : 'none';
            }
        });
    });
    
    // Set up modal buttons
    document.getElementById('cancel-question-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    document.getElementById('save-question-btn').addEventListener('click', saveQuestion);
}

async function saveQuestion() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.type;
    const errorElement = document.getElementById('question-error');
    
    if (!activeTab || !errorElement) return;
    
    try {
        let questionData;
        
        if (activeTab === 'multiple-choice') {
            const question = document.getElementById('mc-question')?.value.trim();
            const options = Array.from(document.querySelectorAll('.option-input')).map(input => input.value.trim());
            const correctAnswer = document.querySelector('input[name="correct-answer"]:checked')?.value;
            const points = parseInt(document.getElementById('mc-points')?.value);
            
            // Validasi lebih ketat
            if (!question) {
                errorElement.textContent = 'Pertanyaan harus diisi';
                return;
            }
            
            if (options.some(opt => !opt)) {
                errorElement.textContent = 'Semua pilihan jawaban harus diisi';
                return;
            }
            
            if (options.length < 2) {
                errorElement.textContent = 'Minimal harus ada 2 pilihan jawaban';
                return;
            }
            
            if (!correctAnswer) {
                errorElement.textContent = 'Pilih jawaban yang benar';
                return;
            }
            
            if (isNaN(points)) {
                errorElement.textContent = 'Poin harus berupa angka';
                return;
            }
            
            questionData = {
                exam_id: currentEditingExam.id,
                type: 'multiple-choice',
                question,
                options: JSON.stringify(options),
                correct_answer: correctAnswer,
                points,
                created_at: new Date().toISOString()
            };
            
        } else {
            const question = document.getElementById('essay-question')?.value.trim();
            const points = parseInt(document.getElementById('essay-points')?.value);
            
            if (!question) {
                errorElement.textContent = 'Pertanyaan harus diisi';
                return;
            }
            
            if (isNaN(points)) {
                errorElement.textContent = 'Poin harus berupa angka';
                return;
            }
            
            questionData = {
                exam_id: currentEditingExam.id,
                type: 'essay',
                question,
                points,
                created_at: new Date().toISOString()
            };
        }
        
        // Cek apakah ini edit soal yang sudah ada
        const editedQuestionId = document.getElementById('edit-question-id')?.value;
        if (editedQuestionId) {
            // Update soal yang sudah ada
            const index = currentEditingQuestions.findIndex(q => q.id === editedQuestionId);
            if (index !== -1) {
                currentEditingQuestions[index] = {
                    ...currentEditingQuestions[index],
                    ...questionData
                };
            }
        } else {
            // Tambahkan soal baru
            currentEditingQuestions.push(questionData);
        }
        
        // Reset form dan tampilkan preview
        document.getElementById('add-question-modal').style.display = 'none';
        showExamPreview();
        
    } catch (error) {
        console.error('Error saving question:', error);
        errorElement.textContent = 'Gagal menyimpan soal: ' + error.message;
    }
}

function showExamPreview() {
    const modal = document.getElementById('exam-preview-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    
    // Set exam info
    document.getElementById('preview-exam-title').textContent = currentEditingExam.title;
    document.getElementById('preview-exam-description').textContent = 
        currentEditingExam.description || 'Tidak ada deskripsi';
    
    // Render questions
    const container = document.getElementById('preview-questions');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (currentEditingQuestions.length === 0) {
        container.innerHTML = '<p class="no-questions">Belum ada soal yang ditambahkan</p>';
    } else {
        currentEditingQuestions.forEach((question, index) => {
            const questionElement = document.createElement('div');
            questionElement.className = 'preview-question';
            questionElement.dataset.questionId = question.id || `temp-${index}`;
            
            if (question.type === 'multiple-choice') {
                const options = JSON.parse(question.options);
                questionElement.innerHTML = `
                    <div class="question-header">
                        <h5>Soal ${index + 1} (Pilihan Ganda - ${question.points} poin)</h5>
                        <button class="btn-icon edit-question-btn" data-index="${index}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-question-btn" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="question-text">${question.question}</div>
                    <div class="question-options">
                        ${options.map((option, i) => `
                            <div class="option ${i.toString() === question.correct_answer ? 'correct' : ''}">
                                <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                                <span class="option-text">${option}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                questionElement.innerHTML = `
                    <div class="question-header">
                        <h5>Soal ${index + 1} (Essay - ${question.points} poin)</h5>
                        <button class="btn-icon edit-question-btn" data-index="${index}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-question-btn" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="question-text">${question.question}</div>
                `;
            }
            
            container.appendChild(questionElement);
        });
    }
    
    // Set up edit question buttons
    document.querySelectorAll('.edit-question-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            editQuestion(index);
        });
    });
    
    // Set up delete question buttons
    document.querySelectorAll('.delete-question-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            deleteQuestion(index);
        });
    });
    
    // Set up modal buttons
    document.getElementById('back-to-edit-btn').addEventListener('click', () => {
        modal.style.display = 'none';
        showAddQuestionModal();
    });
    
    // Enable/disable publish button based on validation
    const publishBtn = document.getElementById('publish-exam-btn');
    if (publishBtn) {
        publishBtn.disabled = currentEditingQuestions.length === 0;
        publishBtn.addEventListener('click', publishExam);
    }
}

function editQuestion(index) {
    const question = currentEditingQuestions[index];
    
    // Tampilkan modal edit dengan ID soal
    const modal = document.getElementById('add-question-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    document.getElementById('exam-preview-modal').style.display = 'none';
    
    // Tambahkan input hidden untuk ID soal
    if (!document.getElementById('edit-question-id')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = 'edit-question-id';
        modal.querySelector('.modal-body').appendChild(input);
    }
    document.getElementById('edit-question-id').value = question.id;
    
    if (question.type === 'multiple-choice') {
        // Set tab ke multiple choice
        document.querySelector('.tab-btn[data-type="multiple-choice"]').classList.add('active');
        document.querySelector('.tab-btn[data-type="essay"]').classList.remove('active');
        document.getElementById('multiple-choice-form').style.display = 'block';
        document.getElementById('essay-form').style.display = 'none';
        
        // Isi form
        document.getElementById('mc-question').value = question.question;
        const options = JSON.parse(question.options);
        
        // Update semua radio button
        document.querySelectorAll('input[name="correct-answer"]').forEach(radio => {
            radio.checked = (radio.value === question.correct_answer);
        });
        
        // Isi pilihan jawaban
        document.querySelectorAll('.option-input').forEach((input, i) => {
            input.value = options[i] || '';
        });
        
        document.getElementById('mc-points').value = question.points;
    } else {
        // Set tab ke essay
        document.querySelector('.tab-btn[data-type="essay"]').classList.add('active');
        document.querySelector('.tab-btn[data-type="multiple-choice"]').classList.remove('active');
        document.getElementById('multiple-choice-form').style.display = 'none';
        document.getElementById('essay-form').style.display = 'block';
        
        // Isi form
        document.getElementById('essay-question').value = question.question;
        document.getElementById('essay-points').value = question.points;
    }
}

async function publishExam() {
    try {
        // Validasi minimal 1 soal
        if (currentEditingQuestions.length === 0) {
            throw new Error('Tambahkan minimal satu soal sebelum mempublikasikan');
        }
        
        // Validasi semua soal
        const invalidQuestions = currentEditingQuestions.filter(q => {
            if (!q.question || !q.points) return true;
            if (q.type === 'multiple-choice' && (!q.options || !q.correct_answer)) return true;
            return false;
        });
        
        if (invalidQuestions.length > 0) {
            throw new Error('Ada soal yang belum lengkap. Harap periksa kembali.');
        }
        
        // Pisahkan soal baru dan yang sudah ada
        const newQuestions = currentEditingQuestions.filter(q => !q.id);
        const existingQuestions = currentEditingQuestions.filter(q => q.id);
        
        // Update soal yang sudah ada
        for (const question of existingQuestions) {
            const { error } = await supabase
                .from('questions')
                .update(question)
                .eq('id', question.id);
            
            if (error) throw error;
        }
        
        // Insert soal baru
        if (newQuestions.length > 0) {
            const { error } = await supabase
                .from('questions')
                .insert(newQuestions);
            
            if (error) throw error;
        }
        
        // Update exam dengan jumlah soal dan status published
        const { error: examError } = await supabase
            .from('exams')
            .update({
                question_count: currentEditingQuestions.length,
                published: true,
                published_at: new Date().toISOString()
            })
            .eq('id', currentEditingExam.id);
        
        if (examError) throw examError;
        
        // Tutup modal dan refresh daftar ujian
        document.getElementById('exam-preview-modal').style.display = 'none';
        showNotification('Ujian berhasil dipublikasikan!', 'success');
        loadTeacherExams();
        
    } catch (error) {
        console.error('Error publishing exam:', error);
        const errorElement = document.getElementById('question-error');
        if (errorElement) {
            errorElement.textContent = 'Gagal mempublikasikan: ' + error.message;
        }
        showNotification('Gagal mempublikasikan: ' + error.message, 'error');
    }
}

async function editExam(examId) {
    try {
        // Load exam data
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('*')
            .eq('id', examId)
            .single();
        
        if (examError || !exam) {
            throw new Error('Ujian tidak ditemukan');
        }
        
        currentEditingExam = exam;
        selectedClasses = exam.classes || [];
        
        // Load questions
        const { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', examId)
            .order('id', { ascending: true });
        
        if (questionsError) throw questionsError;
        
        // Simpan semua soal dengan ID aslinya
        currentEditingQuestions = questions || [];
        
        // Show preview
        showExamPreview();
        
    } catch (error) {
        console.error('Error editing exam:', error);
        showNotification('Gagal memuat ujian: ' + error.message, 'error');
    }
}

async function manageQuestions(examId) {
    try {
        // Load exam data
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('*')
            .eq('id', examId)
            .single();
        
        if (examError || !exam) {
            throw new Error('Ujian tidak ditemukan');
        }
        
        currentEditingExam = exam;
        selectedClasses = exam.classes || [];
        
        // Load questions
        const { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', examId)
            .order('id', { ascending: true });
        
        if (questionsError) throw questionsError;
        
        // Simpan semua soal dengan ID aslinya
        currentEditingQuestions = questions || [];
        
        // Show preview
        showExamPreview();
        
    } catch (error) {
        console.error('Error managing questions:', error);
        showNotification('Gagal memuat soal: ' + error.message, 'error');
    }
}

async function deleteQuestion(index) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) {
        return;
    }
    
    try {
        const question = currentEditingQuestions[index];
        
        // Jika soal sudah ada di database, hapus
        if (question.id) {
            const { error } = await supabase
                .from('questions')
                .delete()
                .eq('id', question.id);
            
            if (error) throw error;
        }
        
        // Hapus dari array
        currentEditingQuestions.splice(index, 1);
        
        // Perbarui tampilan
        showExamPreview();
        showNotification('Soal berhasil dihapus', 'success');
        
    } catch (error) {
        console.error('Error deleting question:', error);
        showNotification('Gagal menghapus soal: ' + error.message, 'error');
    }
}

async function togglePublishExam(examId) {
    try {
        // Get current published status
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('published')
            .eq('id', examId)
            .single();
        
        if (examError || !exam) {
            throw new Error('Ujian tidak ditemukan');
        }
        
        // Toggle published status
        const { error: updateError } = await supabase
            .from('exams')
            .update({
                published: !exam.published,
                published_at: exam.published ? null : new Date().toISOString()
            })
            .eq('id', examId);
        
        if (updateError) throw updateError;
        
        showNotification(`Ujian berhasil ${exam.published ? 'diunpublish' : 'dipublish'}`, 'success');
        loadTeacherExams();
        
    } catch (error) {
        console.error('Error toggling publish status:', error);
        showNotification('Gagal mengubah status ujian: ' + error.message, 'error');
    }
}

async function deleteExam(examId) {
    if (!confirm('Apakah Anda yakin ingin menghapus ujian ini? Semua soal dan jawaban yang terkait juga akan dihapus.')) {
        return;
    }
    
    try {
        // Delete questions first
        const { error: questionsError } = await supabase
            .from('questions')
            .delete()
            .eq('exam_id', examId);
        
        if (questionsError) throw questionsError;
        
        // Delete answers
        const { error: answersError } = await supabase
            .from('answers')
            .delete()
            .eq('exam_id', examId);
        
        if (answersError) throw answersError;
        
        // Finally delete the exam
        const { error: examError } = await supabase
            .from('exams')
            .delete()
            .eq('id', examId);
        
        if (examError) throw examError;
        
        showNotification('Ujian berhasil dihapus', 'success');
        loadTeacherExams();
        
    } catch (error) {
        console.error('Error deleting exam:', error);
        showNotification('Gagal menghapus ujian: ' + error.message, 'error');
    }
}

async function loadExamFilterOptions() {
    try {
        const { data: exams, error } = await supabase
            .from('exams')
            .select('id, title')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const select = document.getElementById('exam-filter');
        if (!select) return;
        
        select.innerHTML = '<option value="">Pilih Ujian</option>';
        
        exams.forEach(exam => {
            const option = document.createElement('option');
            option.value = exam.id;
            option.textContent = exam.title;
            select.appendChild(option);
        });
        
        // Load classes for filter
        const { data: classes, error: classError } = await supabase
            .from('classes')
            .select('*')
            .order('name', { ascending: true });
        
        if (classError) throw classError;
        
        const classSelect = document.getElementById('class-filter');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Pilih Kelas</option>';
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.name;
                option.textContent = cls.name;
                classSelect.appendChild(option);
            });
        }
        
        // Set up filter change events
        document.getElementById('exam-filter').addEventListener('change', loadGrades);
        document.getElementById('class-filter').addEventListener('change', loadGrades);
        
    } catch (error) {
        console.error('Error loading exam filter options:', error);
        showNotification('Gagal memuat daftar ujian', 'error');
    }
}

async function loadGrades() {
    const examId = document.getElementById('exam-filter')?.value;
    const studentClass = document.getElementById('class-filter')?.value;
    
    if (!examId || !studentClass) {
        return;
    }
    
    try {
        // Get unique students who have submitted answers for this exam and class
        const { data: students, error: studentsError } = await supabase
            .from('answers')
            .select('student_name, student_class')
            .eq('exam_id', examId)
            .eq('student_class', studentClass)
            .order('student_name', { ascending: true });
        
        if (studentsError) throw studentsError;
        
        // Get unique students
        const uniqueStudents = [...new Map(students.map(item => 
            [item.student_name, item])).values()];
        
        renderGradesList(Array.from(uniqueStudents), examId, studentClass);
        
    } catch (error) {
        console.error('Error loading grades:', error);
        showNotification('Gagal memuat daftar nilai', 'error');
    }
}

function renderGradesList(students, examId, studentClass) {
    const container = document.getElementById('grades-list');
    if (!container) return;
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="no-grades">
                <i class="fas fa-user-graduate"></i>
                <p>Tidak ada siswa yang mengumpulkan ujian ini</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    students.forEach(student => {
        const studentElement = document.createElement('div');
        studentElement.className = 'grade-item';
        studentElement.innerHTML = `
            <div class="grade-student-info">
                <h4>${student.student_name}</h4>
                <p>Kelas: ${student.student_class}</p>
            </div>
            <div class="grade-actions">
                <button class="btn primary view-answers-btn" 
                    data-exam-id="${examId}" 
                    data-student-name="${student.student_name}" 
                    data-student-class="${studentClass}">
                    <i class="fas fa-eye"></i> Lihat Jawaban
                </button>
            </div>
        `;
        
        container.appendChild(studentElement);
    });
    
    // Set up view answers buttons
    document.querySelectorAll('.view-answers-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { examId, studentName, studentClass } = e.target.closest('button').dataset;
            viewStudentAnswers(examId, studentName, studentClass);
        });
    });
    
    // Set up export button
    document.getElementById('export-grades-btn').addEventListener('click', () => {
        document.getElementById('export-filename').value = `Nilai_${examId}_${studentClass.replace(' ', '_')}`;
        document.getElementById('export-modal').style.display = 'block';
    });
    
    // Set up export modal buttons
    document.getElementById('confirm-export-btn').addEventListener('click', () => {
        exportGrades(examId, studentClass);
    });
    
    document.getElementById('cancel-export-btn').addEventListener('click', () => {
        document.getElementById('export-modal').style.display = 'none';
    });
    
    document.getElementById('close-export-modal').addEventListener('click', () => {
        document.getElementById('export-modal').style.display = 'none';
    });
}

async function exportGrades(examId, studentClass) {
    const format = document.getElementById('export-format').value;
    const filename = document.getElementById('export-filename').value.trim() || 
                     `Nilai_${examId}_${studentClass.replace(' ', '_')}`;
    
    try {
        // Get exam title
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('title')
            .eq('id', examId)
            .single();
        
        if (examError) throw examError;
        
        // Get all questions for the exam
        const { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', examId);
        
        if (questionsError) throw questionsError;
        
        // Get all answers for this exam and class
        const { data: answers, error: answersError } = await supabase
            .from('answers')
            .select('*')
            .eq('exam_id', examId)
            .eq('student_class', studentClass);
        
        if (answersError) throw answersError;
        
        // Group answers by student
        const students = {};
        answers.forEach(answer => {
            if (!students[answer.student_name]) {
                students[answer.student_name] = {
                    name: answer.student_name,
                    class: answer.student_class,
                    answers: {},
                    totalScore: 0
                };
            }
            students[answer.student_name].answers[answer.question_id] = answer;
        });
        
        // Calculate scores for each student
        Object.values(students).forEach(student => {
            let totalPossible = 0;
            let totalEarned = 0;
            
            questions.forEach(question => {
                totalPossible += question.points;
                const answer = student.answers[question.id];
                if (answer) {
                    if (question.type === 'multiple-choice') {
                        if (answer.answer === question.correct_answer) {
                            totalEarned += question.points;
                        }
                    }
                    // For essay questions, we'd need manual grading
                }
            });
            
            student.totalScore = Math.round((totalEarned / totalPossible) * 100);
        });
        
        // Prepare data for export
        let exportData = '';
        
        if (format === 'csv') {
            // CSV header
            exportData = 'Nama,Kelas,Nilai\n';
            
            // Add student data
            Object.values(students).forEach(student => {
                exportData += `"${student.name}","${student.class}",${student.totalScore}\n`;
            });
            
            // Create download link
            const blob = new Blob([exportData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } else if (format === 'excel') {
            // For Excel, we'll just create a CSV (real Excel export would require a library)
            exportData = 'Nama,Kelas,Nilai\n';
            
            Object.values(students).forEach(student => {
                exportData += `"${student.name}","${student.class}",${student.totalScore}\n`;
            });
            
            const blob = new Blob([exportData], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.xls`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } else if (format === 'pdf') {
            // PDF export would require a library like jsPDF
            showNotification('Ekspor PDF memerlukan library tambahan fitur ini akan di update secara berkala jika sudah tersedia ^_^', 'info');
            return;
        }
        
        showNotification('Nilai berhasil diekspor', 'success');
        document.getElementById('export-modal').style.display = 'none';
        
    } catch (error) {
        console.error('Error exporting grades:', error);
        showNotification('Gagal mengekspor nilai: ' + error.message, 'error');
    }
}

async function viewStudentAnswers(examId, studentName, studentClass) {
    try {
        // Load exam data
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('*')
            .eq('id', examId)
            .single();
        
        if (examError) throw examError;
        
        // Load questions
        const { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', examId)
            .order('id', { ascending: true });
        
        if (questionsError) throw questionsError;
        
        // Load student answers
        const { data: answers, error: answersError } = await supabase
            .from('answers')
            .select('*')
            .eq('exam_id', examId)
            .eq('student_name', studentName)
            .eq('student_class', studentClass);
        
        if (answersError) throw answersError;
        
        // Create a map of answers by question ID
        const answerMap = {};
        answers.forEach(answer => {
            answerMap[answer.question_id] = answer;
        });
        
        // Display student info
        document.getElementById('student-name-display').textContent = studentName;
        document.getElementById('student-class-display').textContent = `Kelas: ${studentClass}`;
        
        // Calculate score
        let totalPossible = 0;
        let totalEarned = 0;
        
        questions.forEach(question => {
            totalPossible += question.points;
            const answer = answerMap[question.id];
            if (answer) {
                if (question.type === 'multiple-choice' && answer.answer === question.correct_answer) {
                    totalEarned += question.points;
                }
            }
        });
        
        const score = Math.round((totalEarned / totalPossible) * 100);
        document.getElementById('student-score-display').textContent = `Nilai: ${score}`;
        document.getElementById('total-score').value = score;
        
        // Render answers
        const container = document.getElementById('student-answers');
        if (!container) return;
        
        container.innerHTML = '';
        
        questions.forEach((question, index) => {
            const answer = answerMap[question.id];
            const answerElement = document.createElement('div');
            answerElement.className = 'student-answer';
            
            if (question.type === 'multiple-choice') {
                const options = JSON.parse(question.options);
                answerElement.innerHTML = `
                    <div class="answer-question">
                        <h5>Soal ${index + 1} (Pilihan Ganda - ${question.points} poin)</h5>
                        <p>${question.question}</p>
                    </div>
                    <div class="answer-options">
                        ${options.map((option, i) => `
                            <div class="option 
                                ${i.toString() === question.correct_answer ? 'correct' : ''}
                                ${answer && i.toString() === answer.answer ? 'selected' : ''}">
                                <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                                <span class="option-text">${option}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="answer-feedback">
                        ${answer && answer.answer && answer.answer !== question.correct_answer ? 
                            '<span class="incorrect-feedback">Jawaban salah</span>' : ''}
                    </div>
                `;
            } else {
                answerElement.innerHTML = `
                    <div class="answer-question">
                        <h5>Soal ${index + 1} (Essay - ${question.points} poin)</h5>
                        <p>${question.question}</p>
                    </div>
                    <div class="answer-text">
                        <p>${answer?.answer || 'Tidak ada jawaban'}</p>
                    </div>
                `;
            }
            
            container.appendChild(answerElement);
        });
        
        // Show modal
        const modal = document.getElementById('answers-modal');
        if (modal) {
            modal.style.display = 'block';
            
            // Set up modal buttons
            document.getElementById('cancel-grading-btn').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            document.getElementById('save-grade-btn').addEventListener('click', async () => {
                const comment = document.getElementById('teacher-comment').value.trim();
                
                try {
                    // Update all answers with the score and comment
                    const { error } = await supabase
                        .from('answers')
                        .update({
                            score: score,
                            teacher_comment: comment
                        })
                        .eq('exam_id', examId)
                        .eq('student_name', studentName)
                        .eq('student_class', studentClass);
                    
                    if (error) throw error;
                    
                    showNotification('Nilai dan komentar berhasil disimpan', 'success');
                    modal.style.display = 'none';
                    
                } catch (error) {
                    console.error('Error saving grade:', error);
                    showNotification('Gagal menyimpan nilai: ' + error.message, 'error');
                }
            });
            
            document.getElementById('delete-answers-btn').addEventListener('click', async () => {
                if (confirm('Apakah Anda yakin ingin menghapus jawaban siswa ini?')) {
                    try {
                        const { error } = await supabase
                            .from('answers')
                            .delete()
                            .eq('exam_id', examId)
                            .eq('student_name', studentName)
                            .eq('student_class', studentClass);
                        
                        if (error) throw error;
                        
                        showNotification('Jawaban berhasil dihapus', 'success');
                        modal.style.display = 'none';
                        loadGrades();
                        
                    } catch (error) {
                        console.error('Error deleting answers:', error);
                        showNotification('Gagal menghapus jawaban: ' + error.message, 'error');
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Error viewing student answers:', error);
        showNotification('Gagal memuat jawaban siswa: ' + error.message, 'error');
    }
}

// Import Exam Functions
function initImportExam() {
    const importExamBtn = document.getElementById('import-exam-btn');
    if (importExamBtn) {
        importExamBtn.addEventListener('click', showImportExamModal);
    }
    
    // Initialize template download link
    const templateLink = document.getElementById('download-template-link');
    if (templateLink) {
        templateLink.addEventListener('click', function(e) {
            e.preventDefault();
            showTemplateOptions();
        });
    }

    // Add event listener for the import add class button
    document.getElementById('import-add-class-btn')?.addEventListener('click', showAddClassModal);
}

function showTemplateOptions() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.position = 'fixed';
    modal.style.zIndex = '1000';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.backgroundColor = '#353534ff';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.width = '400px';
    modalContent.style.maxWidth = '90%';

    modalContent.innerHTML = `
        <div class="modal-header">
            <h3><i class="fas fa-file-download"></i> Download Template</h3>
            <button class="modal-close" id="close-template-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; float: right;">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <p>Pilih format template yang ingin diunduh:</p>
            <div class="template-options" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                <button id="download-csv-template-btn" class="btn primary" style="text-align: left;">
                    <i class="fas fa-file-csv"></i> Template CSV
                </button>
                <button id="download-excel-template-btn" class="btn primary" style="text-align: left;">
                    <i class="fas fa-file-excel"></i> Template Excel
                </button>
            </div>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Event listeners untuk tombol download - gunakan event delegation
    const csvBtn = modal.querySelector('#download-csv-template-btn');
    const excelBtn = modal.querySelector('#download-excel-template-btn');
    const closeBtn = modal.querySelector('#close-template-modal');
    
    if (csvBtn) {
        csvBtn.addEventListener('click', () => {
            downloadCsvTemplate();
            modal.remove();
        });
    }
    
    if (excelBtn) {
        excelBtn.addEventListener('click', () => {
            downloadExcelTemplate();
            modal.remove();
        });
    }
    
    // Close modal - perbaiki event listener
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.remove();
        });
    }

    // Close modal ketika klik di luar
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Prevent modal content clicks from closing modal
    modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function showImportExamModal() {
    const modal = document.getElementById('import-exam-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    
    // Reset form
    resetImportForm();
    importedQuestions = [];
    currentFileData = [];
    
    // Set default exam title
    const titleInput = document.getElementById('import-exam-title');
    if (titleInput) {
        titleInput.value = `Ujian Impor - ${new Date().toLocaleDateString('id-ID')}`;
    }
    
    // Load classes with table layout - perbaiki loading
    setTimeout(() => {
        loadClassesForImport();
    }, 100);
    
    // Setup event listeners - DIPERBAIKI dengan delay untuk memastikan DOM ready
    setTimeout(() => {
        setupImportEventListeners();
    }, 200);
    
    // Refresh classes button
    const refreshBtn = document.getElementById('import-refresh-classes-btn');
    if (refreshBtn) {
        // Remove existing listeners
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        newRefreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadClassesForImport();
        });
    }
}

function resetImportForm() {
    // Reset class checkboxes container
    const classContainer = document.getElementById('import-class-checkboxes');
    if (classContainer) {
        classContainer.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    }
    
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.value = '';
    }
    
    const columnMapping = document.getElementById('column-mapping-section');
    if (columnMapping) {
        columnMapping.style.display = 'none';
    }
    
    const preview = document.getElementById('import-preview');
    if (preview) {
        preview.style.display = 'none';
    }
    
    const errorDiv = document.getElementById('import-error');
    if (errorDiv) {
        errorDiv.textContent = '';
    }
    
    const confirmBtn = document.getElementById('confirm-import-btn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
    
    // Clear any existing validation messages
    const validationDiv = document.getElementById('import-validation');
    if (validationDiv) {
        validationDiv.innerHTML = '';
    }
    
    // Remove processing message if exists
    const processingElement = document.getElementById('processing-message');
    if (processingElement) {
        processingElement.remove();
    }
}

function setupImportEventListeners() {
    const dropZone = document.getElementById('import-drop-zone');
    const fileInput = document.getElementById('import-file-input');
    const browseLink = document.getElementById('import-browse-link');
    const modal = document.getElementById('import-exam-modal');

    // Pastikan elemen ada
    if (!dropZone || !fileInput || !browseLink) {
        console.error('Required elements not found');
        return;
    }

    // Fungsi untuk membuka file explorer
    function openFileExplorer() {
        fileInput.click();
    }

    // Klik pada teks "cari file"
    browseLink.addEventListener('click', function(e) {
        e.preventDefault();
        openFileExplorer();
    });

    // Klik pada area drop zone (selain tombol browse)
    dropZone.addEventListener('click', function(e) {
        // Jika yang diklik bukan tombol browse atau link browse
        if (e.target !== browseLink && !browseLink.contains(e.target)) {
            openFileExplorer();
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', function(e) {
        handleFileSelect(e);
    });

    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    dropZone.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    });

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



    // Modal close events - DIPERBAIKI
    if (modal) {
        const closeModalBtn = document.getElementById('close-import-modal');
        const cancelBtn = document.getElementById('cancel-import-btn');
        const confirmBtn = document.getElementById('confirm-import-btn');
        
        // Close modal button
        if (closeModalBtn) {
            const newCloseBtn = closeModalBtn.cloneNode(true);
            closeModalBtn.parentNode.replaceChild(newCloseBtn, closeModalBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.style.display = 'none';
            });
        }
        
        // Cancel button
        if (cancelBtn) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.style.display = 'none';
            });
        }
        
        // Confirm button
        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                confirmImport();
            });
        }
        
        // Close modal when clicking outside - gunakan event delegation
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Prevent modal content clicks from closing modal
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }
    
    console.log('Import event listeners setup complete');
}

function downloadCsvTemplate() {
    const headers = ['Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Jawaban Benar', 'Poin'];
    const sampleData = [
        [
            'Apa ibukota Indonesia?',
            'Jakarta',
            'Surabaya',
            'Bandung',
            'Medan',
            'A',
            '5'
        ],
        [
            'Berapa hasil dari 2 + 2?',
            '3',
            '4',
            '5',
            '6',
            'B',
            '5'
        ],
        [
            'Planet terdekat dengan matahari adalah?',
            'Venus',
            'Merkurius',
            'Bumi',
            'Mars',
            'B',
            '5'
        ]
    ];
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    sampleData.forEach(row => {
        const escapedRow = row.map(field => {
            // Escape fields containing commas or quotes
            if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                return '"' + field.replace(/"/g, '""') + '"';
            }
            return field;
        });
        csvContent += escapedRow.join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_soal_ujian.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Template CSV berhasil diunduh', 'success');
}

function downloadExcelTemplate() {
    // Check if XLSX library is available
    if (typeof XLSX === 'undefined') {
        showNotification('Library Excel tidak tersedia. Silakan gunakan template CSV.', 'error');
        return;
    }
    
    const headers = ['Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Jawaban Benar', 'Poin'];
    const sampleData = [
        [
            'Apa ibukota Indonesia?',
            'Jakarta',
            'Surabaya',
            'Bandung',
            'Medan',
            'A',
            5
        ],
        [
            'Berapa hasil dari 2 + 2?',
            '3',
            '4',
            '5',
            '6',
            'B',
            5
        ],
        [
            'Planet terdekat dengan matahari adalah?',
            'Venus',
            'Merkurius',
            'Bumi',
            'Mars',
            'B',
            5
        ]
    ];
    
    // Create worksheet data
    const wsData = [headers, ...sampleData];
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    const colWidths = [
        { wch: 50 }, // Pertanyaan
        { wch: 20 }, // Opsi A
        { wch: 20 }, // Opsi B
        { wch: 20 }, // Opsi C
        { wch: 20 }, // Opsi D
        { wch: 15 }, // Jawaban Benar
        { wch: 10 }  // Poin
    ];
    ws['!cols'] = colWidths;
    
    // Style the header row
    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center", vertical: "center" }
    };
    
    // Apply header style
    headers.forEach((header, index) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
        if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: header };
        ws[cellAddress].s = headerStyle;
    });
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
    
    // Add instructions sheet
    const instructionsData = [
        ['PETUNJUK PENGGUNAAN TEMPLATE'],
        [''],
        ['1. Format File:'],
        ['   - Gunakan format Excel (.xlsx) atau CSV (.csv)'],
        ['   - Jangan mengubah urutan kolom'],
        ['   - Pastikan tidak ada baris kosong di tengah data'],
        [''],
        ['2. Kolom yang Tersedia:'],
        ['   Pertanyaan: Teks pertanyaan ujian'],
        ['   Opsi A: Pilihan jawaban A'],
        ['   Opsi B: Pilihan jawaban B'],
        ['   Opsi C: Pilihan jawaban C (opsional)'],
        ['   Opsi D: Pilihan jawaban D (opsional)'],
        ['   Jawaban Benar: Huruf jawaban yang benar (A, B, C, atau D)'],
        ['   Poin: Nilai untuk setiap soal (angka)'],
        [''],
        ['3. Aturan Pengisian:'],
        ['   - Pertanyaan, Opsi A, Opsi B, dan Jawaban Benar WAJIB diisi'],
        ['   - Opsi C dan D bersifat opsional'],
        ['   - Jawaban Benar harus berupa huruf A, B, C, atau D'],
        ['   - Poin harus berupa angka positif'],
        ['   - Maksimal ukuran file 5MB'],
        [''],
        ['4. Tips:'],
        ['   - Periksa kembali jawaban benar sebelum mengimpor'],
        ['   - Gunakan bahasa yang jelas dan mudah dipahami'],
        ['   - Hindari karakter khusus yang dapat mengganggu format'],
        [''],
        ['5. Contoh Pengisian:'],
        ['   Lihat sheet "Template Soal" untuk contoh yang benar']
    ];
    
    const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
    
    // Set column width for instructions
    instructionsWs['!cols'] = [{ wch: 60 }];
    
    // Style the title
    const titleStyle = {
        font: { bold: true, size: 14, color: { rgb: "366092" } },
        alignment: { horizontal: "center" }
    };
    
    if (instructionsWs['A1']) {
        instructionsWs['A1'].s = titleStyle;
    }
    
    // Add instructions sheet to workbook
    XLSX.utils.book_append_sheet(wb, instructionsWs, 'Petunjuk');
    
    // Download the file
    XLSX.writeFile(wb, 'template_soal_ujian.xlsx');
    
    showNotification('Template Excel berhasil diunduh', 'success');
}

// Perbaiki fungsi loadClassesForImport dengan error handling yang lebih baik
async function loadClassesForImport() {
    const container = document.getElementById('import-class-checkboxes');
    if (!container) {
        console.error('Container import-class-checkboxes tidak ditemukan');
        return;
    }
    
    // Show loading state
    container.innerHTML = '<tr><td colspan="3" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Memuat kelas...</td></tr>';
    
    try {
        // Check if supabase is available
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase client tidak tersedia');
        }
        
        const { data: classes, error } = await supabase
            .from('classes')
            .select('*')
            .order('name', { ascending: true });
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        container.innerHTML = '';
        
        if (!classes || classes.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="3" class="no-classes" style="text-align: center; padding: 20px;">
                        <i class="fas fa-info-circle"></i>
                        Belum ada kelas yang tersedia
                        <br><br>
                        <button class="btn primary" onclick="showAddClassModal()" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Tambah Kelas
                        </button>
                    </td>
                </tr>
            `;
            return;
        }
        
        classes.forEach(cls => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="exam-class" value="${cls.name}">
                </td>
                <td>${cls.name}</td>
                <td>
                    <button class="btn-icon delete-class-btn" data-class-name="${cls.name}" style="background: none; border: none; color: #dc3545; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            container.appendChild(row);
            
            // Add delete class event listener
            const deleteBtn = row.querySelector('.delete-class-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (confirm(`Apakah Anda yakin ingin menghapus kelas "${cls.name}"?`)) {
                        try {
                            const { error } = await supabase
                                .from('classes')
                                .delete()
                                .eq('name', cls.name);
                            
                            if (error) throw error;
                            
                            showNotification('Kelas berhasil dihapus', 'success');
                            loadClassesForImport(); // Refresh class list
                            
                            // Refresh other class lists if they exist
                            if (typeof loadClassesForExam === 'function') {
                                loadClassesForExam();
                            }
                        } catch (err) {
                            console.error('Error deleting class:', err);
                            showNotification('Gagal menghapus kelas: ' + err.message, 'error');
                        }
                    }
                });
            }
        });
        
        // Set up "select all" checkbox
        const selectAll = document.getElementById('select-all-classes');
        if (selectAll) {
            // Remove existing listeners
            const newSelectAll = selectAll.cloneNode(true);
            selectAll.parentNode.replaceChild(newSelectAll, selectAll);
            
            newSelectAll.addEventListener('change', function() {
                const checkboxes = container.querySelectorAll('.exam-class');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
            });
        }
        
    } catch (error) {
        console.error('Error loading classes:', error);
        showNotification('Gagal memuat daftar kelas: ' + error.message, 'error');
        
        // Fallback to show default class option
        container.innerHTML = `
            <tr>
                <td colspan="3" class="error-state" style="text-align: center; padding: 20px; color: #dc3545;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Gagal memuat kelas
                    <br><br>
                    <button class="btn secondary" onclick="loadClassesForImport()" style="margin-top: 10px;">
                        <i class="fas fa-refresh"></i> Coba Lagi
                    </button>
                </td>
            </tr>
        `;
    }
}

let importedQuestions = [];
let currentFileData = [];

function handleFileSelect(event) {
    const fileInput = event.target;
    const files = fileInput.files;
    
    console.log('handleFileSelect called with files:', files);
    
    if (!files || files.length === 0) {
        console.log('No files selected');
        return;
    }
    
    const file = files[0];
    console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    const fileType = document.getElementById('import-file-type');
    const errorElement = document.getElementById('import-error');
    
    if (!fileType || !errorElement) {
        console.error('Required elements not found - fileType:', !!fileType, 'errorElement:', !!errorElement);
        return;
    }
    
    // Clear previous error and preview
    errorElement.textContent = '';
    const columnMapping = document.getElementById('column-mapping-section');
    const preview = document.getElementById('import-preview');
    
    if (columnMapping) columnMapping.style.display = 'none';
    if (preview) preview.style.display = 'none';
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        errorElement.textContent = 'Ukuran file maksimal 5MB';
        return;
    }
    
    // Validate file extension - DIPERBAIKI: Auto detect file type
    const fileName = file.name.toLowerCase();
    let detectedFileType = '';
    
    if (fileName.endsWith('.csv')) {
        detectedFileType = 'csv';
    } else if (fileName.match(/\.(xlsx|xls)$/)) {
        detectedFileType = 'excel';
    } else {
        errorElement.textContent = 'Format file tidak didukung. Gunakan file CSV (.csv) atau Excel (.xlsx, .xls)';
        return;
    }
    
    // Update file type selector
    fileType.value = detectedFileType;
    
    console.log('File type detected:', detectedFileType);
    
    // Show processing message
    showProcessingMessage();
    
    const reader = new FileReader();
    
    if (detectedFileType === 'csv') {
        reader.onload = function(e) {
            try {
                console.log('Processing CSV file...');
                const csvData = e.target.result;
                const results = parseCSV(csvData);
                currentFileData = results.data;
                console.log('CSV parsed successfully, rows:', currentFileData.length);
                setupColumnMapping(results.meta.fields);
                hideProcessingMessage();
            } catch (err) {
                console.error('CSV processing error:', err);
                errorElement.textContent = 'Gagal memproses file CSV: ' + err.message;
                hideProcessingMessage();
            }
        };
        reader.readAsText(file, 'UTF-8');
    } else {
        reader.onload = function(e) {
            try {
                console.log('Processing Excel file...');
                if (typeof XLSX === 'undefined') {
                    throw new Error('Library Excel tidak tersedia');
                }
                
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                
                if (jsonData.length < 2) {
                    throw new Error('File Excel tidak memiliki data yang cukup (minimal 2 baris: header + 1 data)');
                }
                
                const headers = jsonData[0].map(h => h ? h.toString().trim() : '');
                const rows = jsonData.slice(1);
                
                const validRows = rows.filter(row => 
                    row.some(cell => cell !== undefined && cell !== null && cell.toString().trim() !== '')
                );
                
                if (validRows.length === 0) {
                    throw new Error('Tidak ada data valid ditemukan dalam file Excel');
                }
                
                currentFileData = validRows.map(row => {
                    const obj = {};
                    headers.forEach((header, i) => {
                        const cellValue = row[i];
                        obj[header] = cellValue !== undefined && cellValue !== null 
                            ? cellValue.toString().trim() 
                            : '';
                    });
                    return obj;
                });
                
                console.log('Excel parsed successfully, rows:', currentFileData.length);
                setupColumnMapping(headers.filter(h => h !== ''));
                hideProcessingMessage();
            } catch (err) {
                console.error('Excel processing error:', err);
                errorElement.textContent = 'Gagal memproses file Excel: ' + err.message;
                hideProcessingMessage();
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function showProcessingMessage() {
    hideProcessingMessage(); // Remove any existing message
    
    const previewDiv = document.getElementById('import-preview');
    if (!previewDiv) return;
    
    const processingMsg = document.createElement('div');
    processingMsg.id = 'processing-message';
    processingMsg.className = 'processing-message';
    processingMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses file...';
    processingMsg.style.textAlign = 'center';
    processingMsg.style.padding = '20px';
    
    previewDiv.appendChild(processingMsg);
    previewDiv.style.display = 'block';
}

function hideProcessingMessage() {
    const processingElement = document.getElementById('processing-message');
    if (processingElement) {
        processingElement.remove();
    }
}

function parseCSV(csv) {
    const lines = csv.split('\n').map(line => line.trim()).filter(line => line !== '');
    const result = {
        data: [],
        meta: { fields: [] }
    };
    
    if (lines.length === 0) {
        throw new Error('File CSV kosong');
    }
    
    // Parse CSV properly handling quotes and commas
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add final field
        result.push(current.trim());
        return result;
    }
    
    // Parse header
    const headers = parseCSVLine(lines[0]);
    result.meta.fields = headers;
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentline = parseCSVLine(lines[i]);
        
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j] || '';
        }
        
        result.data.push(obj);
    }
    
    if (result.data.length === 0) {
        throw new Error('Tidak ada data ditemukan dalam file CSV');
    }
    
    return result;
}

function setupColumnMapping(headers) {
    const mappingSection = document.getElementById('column-mapping-section');
    if (!mappingSection) return;
    
    mappingSection.style.display = 'block';
    
    // Reset all selects
    const mappingSelects = [
        'map-question', 'map-type', 'map-option-a', 'map-option-b',
        'map-option-c', 'map-option-d', 'map-correct-answer', 'map-points'
    ];
    
    // Remove existing event listeners
    mappingSelects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const newSelect = select.cloneNode(false);
            select.parentNode.replaceChild(newSelect, select);
        }
    });
    
    mappingSelects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        
        select.innerHTML = '';
        
        if (id === 'map-type' || id === 'map-points') {
            // These have fixed options
            if (id === 'map-type') {
                select.innerHTML = `
                    <option value="fixed" selected>Tetap: Pilihan Ganda</option>
                `;
            } else {
                select.innerHTML = `
                    <option value="">-- Pilih Kolom --</option>
                    <option value="fixed" selected>Tetap: 5</option>
                `;
            }
            
            // Tambah header options
            headers.forEach(header => {
                const option = document.createElement('option');
                option.value = header;
                option.textContent = header;
                select.appendChild(option);
            });
        } else {
            // Regular select dengan headers
            select.innerHTML = '<option value="">-- Pilih Kolom --</option>';
            headers.forEach(header => {
                const option = document.createElement('option');
                option.value = header;
                option.textContent = header;
                select.appendChild(option);
            });
            
            // Auto-select based on common column names - DIPERBAIKI
            const commonMappings = {
                'map-question': ['pertanyaan', 'question', 'soal', 'teks'],
                'map-option-a': ['opsi a', 'option a', 'pilihan a', 'a\\)', 'a\\.', '^a$', 'a\\s'],
                'map-option-b': ['opsi b', 'option b', 'pilihan b', 'b\\)', 'b\\.', '^b$', 'b\\s'],
                'map-option-c': ['opsi c', 'option c', 'pilihan c', 'c\\)', 'c\\.', '^c$', 'c\\s'],
                'map-option-d': ['opsi d', 'option d', 'pilihan d', 'd\\)', 'd\\.', '^d$', 'd\\s'],
                'map-correct-answer': ['jawaban benar', 'correct answer', 'jawaban', 'answer', 'kunci', 'kunci jawaban'],
                'map-points': ['poin', 'points', 'nilai', 'score', 'bobot']
            };
            
            const mapping = commonMappings[id];
            if (mapping) {
                // Cari header yang paling cocok dengan pola regex
                let bestMatch = null;
                let bestScore = 0;
                
                headers.forEach(header => {
                    const headerLower = header.toLowerCase();
                    mapping.forEach(pattern => {
                        // Gunakan regex untuk pencocokan yang lebih akurat
                        const regex = new RegExp(pattern, 'i');
                        if (regex.test(headerLower)) {
                            const score = pattern.length; // Skor berdasarkan panjang pola
                            if (score > bestScore) {
                                bestScore = score;
                                bestMatch = header;
                            }
                        }
                    });
                });
                
                if (bestMatch) {
                    select.value = bestMatch;
                }
            }
        }
        
        // Add change listener
        select.addEventListener('change', updateImportPreview);
    });
    
    // Trigger initial preview
    updateImportPreview();
}

function updateImportPreview() {
    const questionCol = document.getElementById('map-question').value;
    const optionACol = document.getElementById('map-option-a').value;
    const optionBCol = document.getElementById('map-option-b').value;
    const optionCCol = document.getElementById('map-option-c').value;
    const optionDCol = document.getElementById('map-option-d').value;
    const answerCol = document.getElementById('map-correct-answer').value;
    const pointsCol = document.getElementById('map-points').value;
    
    if (!questionCol || !optionACol || !optionBCol || !answerCol) {
        // Minimum required columns not selected
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('confirm-import-btn').disabled = true;
        return;
    }
    
    // Process data
    importedQuestions = [];
    const previewTbody = document.getElementById('import-preview-table').querySelector('tbody');
    previewTbody.innerHTML = '';
    
    let hasErrors = false;
    const validationErrors = [];
    
    currentFileData.forEach((row, index) => {
        // Skip completely empty rows
        const hasAnyData = Object.values(row).some(value => 
            value !== undefined && value !== null && value.toString().trim() !== ''
        );
        
        if (!hasAnyData) {
            return;
        }
        
        let rowHasErrors = false;
        
        // Validate required fields
        if (!row[questionCol] || row[questionCol].toString().trim() === '') {
            validationErrors.push(`Baris ${index + 2}: Pertanyaan kosong`);
            rowHasErrors = true;
        }
        
        if (!row[optionACol] || row[optionACol].toString().trim() === '' || 
            !row[optionBCol] || row[optionBCol].toString().trim() === '') {
            validationErrors.push(`Baris ${index + 2}: Minimal harus ada opsi A dan B`);
            rowHasErrors = true;
        }
        
        if (!row[answerCol] || row[answerCol].toString().trim() === '') {
            validationErrors.push(`Baris ${index + 2}: Jawaban benar tidak ditentukan`);
            rowHasErrors = true;
        }
        
        // Validate answer format
        const answerValue = row[answerCol] ? row[answerCol].toString().toUpperCase().replace(/[^A-D]/g, '') : '';
        if (!answerValue || answerValue.length === 0) {
            validationErrors.push(`Baris ${index + 2}: Jawaban benar harus A, B, C, atau D`);
            rowHasErrors = true;
        }
        
        // Determine points
        let points = 5; // default
        if (pointsCol && pointsCol !== 'fixed') {
            const pointsValue = parseInt(row[pointsCol]);
            if (isNaN(pointsValue) || pointsValue <= 0) {
                validationErrors.push(`Baris ${index + 2}: Poin harus berupa angka positif`);
                rowHasErrors = true;
            } else {
                points = pointsValue;
            }
        }
        
        // Skip this row if it has errors but continue processing others
        if (rowHasErrors) {
            hasErrors = true;
            return;
        }
        
        // Create question object
        const question = {
            type: 'multiple-choice',
            question: row[questionCol].toString().trim(),
            options: JSON.stringify([
                row[optionACol] ? row[optionACol].toString().trim() : '',
                row[optionBCol] ? row[optionBCol].toString().trim() : '',
                row[optionCCol] ? row[optionCCol].toString().trim() : '',
                row[optionDCol] ? row[optionDCol].toString().trim() : ''
            ]),
            correct_answer: answerValue[0] ? (answerValue.charCodeAt(0) - 65).toString() : '0',
            points: points
        };
        
        importedQuestions.push(question);
        
        // Add to preview table
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${importedQuestions.length}</td>
            <td class="question-preview">${question.question}</td>
            <td>${JSON.parse(question.options)[0]}</td>
            <td>${JSON.parse(question.options)[1]}</td>
            <td>${JSON.parse(question.options)[2] || '-'}</td>
            <td>${JSON.parse(question.options)[3] || '-'}</td>
            <td class="answer-preview">${String.fromCharCode(65 + parseInt(question.correct_answer))}</td>
            <td>${question.points}</td>
        `;
        previewTbody.appendChild(tr);
    });
    
    // Show validation results
    const validationDiv = document.getElementById('import-validation');
    if (hasErrors) {
        validationDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Masalah ditemukan:</strong>
                <ul>
                    ${validationErrors.slice(0, 10).map(err => `<li>${err}</li>`).join('')}
                    ${validationErrors.length > 10 ? `<li>... dan ${validationErrors.length - 10} masalah lainnya</li>` : ''}
                </ul>
            </div>
        `;
        
        if (importedQuestions.length > 0) {
            validationDiv.innerHTML += `
                <div class="warning-message">
                    <i class="fas fa-info-circle"></i>
                    <strong>${importedQuestions.length} soal valid ditemukan</strong> - Hanya soal valid yang akan diimpor
                </div>
            `;
            document.getElementById('confirm-import-btn').disabled = false;
        } else {
            document.getElementById('confirm-import-btn').disabled = true;
        }
    } else {
        validationDiv.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle"></i>
                <strong>${importedQuestions.length} soal berhasil dibaca</strong>
            </div>
        `;
        document.getElementById('confirm-import-btn').disabled = importedQuestions.length === 0;
    }
    
    document.getElementById('import-preview').style.display = 'block';
}

async function confirmImport() {
    // Get selected classes from checkboxes
    const selectedClasses = Array.from(document.querySelectorAll('#import-class-checkboxes .exam-class:checked'))
        .map(cb => cb.value);
    
    // Get exam title
    const examTitleInput = document.getElementById('import-exam-title');
    const examTitle = examTitleInput.value.trim();
    
    if (selectedClasses.length === 0) {
        showNotification('Pilih minimal satu kelas', 'error');
        return;
    }
    
    if (!examTitle) {
        showNotification('Masukkan judul ujian', 'error');
        examTitleInput.focus();
        return;
    }

    // Get other import values
    const description = document.getElementById('import-exam-description').value.trim();
    const duration = parseInt(document.getElementById('import-exam-duration').value) || 60;

    // Disable button to prevent double click
    const confirmBtn = document.getElementById('confirm-import-btn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengimpor...';
    
    try {
        // Check for duplicate questions
        const uniqueQuestions = [];
        const questionMap = new Map();
        
        importedQuestions.forEach(question => {
            const key = `${question.question}_${question.correct_answer}`;
            if (!questionMap.has(key)) {
                questionMap.set(key, true);
                uniqueQuestions.push(question);
            }
        });
        
        if (uniqueQuestions.length < importedQuestions.length) {
            showNotification(`Ditemukan ${importedQuestions.length - uniqueQuestions.length} soal duplikat. Hanya soal unik yang akan diimpor.`, 'warning');
        }
        
        // Create a new exam
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert([{
                title: examTitle,
                description: description || `Ujian diimpor dari file pada ${new Date().toLocaleDateString('id-ID')}`,
                duration: duration,
                date: new Date().toISOString().split('T')[0],
                classes: selectedClasses, // Use the selected classes array
                published: true,
                question_count: uniqueQuestions.length,
                created_at: new Date().toISOString(),
                published_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (examError) throw examError;
        
        // Add exam_id to all questions
        const questionsToImport = uniqueQuestions.map(q => ({
            ...q,
            exam_id: exam.id,
            created_at: new Date().toISOString()
        }));
        
        // Insert questions in batches
        const batchSize = 100;
        for (let i = 0; i < questionsToImport.length; i += batchSize) {
            const batch = questionsToImport.slice(i, i + batchSize);
            const { error: questionsError } = await supabase
                .from('questions')
                .insert(batch);
            
            if (questionsError) throw questionsError;
        }
        
        showNotification(`${uniqueQuestions.length} soal berhasil diimpor ke ujian "${examTitle}" untuk ${selectedClasses.length} kelas`, 'success');
        document.getElementById('import-exam-modal').style.display = 'none';
        
        // Refresh exam list
        if (typeof loadTeacherExams === 'function') {
            loadTeacherExams();
        }
        
    } catch (error) {
        console.error('Error importing questions:', error);
        showNotification('Gagal mengimpor soal: ' + error.message, 'error');
    } finally {
        // Re-enable button
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
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