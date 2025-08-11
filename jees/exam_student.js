// Student Exam Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Check if we have exam ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    
    if (examId) {
        // Check if student info exists and is valid
        const studentInfo = getStudentInfo();
        if (!studentInfo) {
            showNotification('Harap masukkan data diri Anda terlebih dahulu', 'error');
            setTimeout(() => {
                window.location.href = 'index_murid.html';
            }, 2000);
        } else {
            startExam(examId);
        }
    } else {
        // No exam ID, redirect back to exams list
        window.location.href = 'index_murid.html';
    }
});

let currentExam = null;
let currentQuestions = [];
let currentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval = null;
let timeRemaining = 0;

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

async function startExam(examId) {
    try {
        // Show loading state
        const container = document.getElementById('exam-questions');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Memuat ujian...</p>
                </div>
            `;
        }

        // Load student info
        const studentInfo = getStudentInfo();
        if (!studentInfo) {
            throw new Error('Data siswa tidak ditemukan');
        }
        
        // Load exam data
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('*')
            .eq('id', examId)
            .single();
        
        if (examError || !exam) {
            throw new Error('Ujian tidak ditemukan');
        }
        
        currentExam = exam;
        
        // Load questions
        const { data: questions, error: questionsError } = await supabase
            .from('questions')
            .select('*')
            .eq('exam_id', examId)
            .order('id', { ascending: true });
        
        if (questionsError) throw questionsError;
        
        currentQuestions = questions || [];
        
        if (currentQuestions.length === 0) {
            throw new Error('Tidak ada soal dalam ujian ini');
        }
        
        // Initialize answers object
        currentQuestions.forEach(question => {
            currentAnswers[question.id] = {
                answer: '',
                question_type: question.type,
                points: 0
            };
        });
        
        // Display student info and initialize exam
        displayStudentInfo(studentInfo);
        initializeExam();
        
    } catch (error) {
        console.error('Error starting exam:', error);
        const container = document.getElementById('exam-questions');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Gagal memuat ujian</p>
                    <p class="error-detail">${error.message}</p>
                    <button class="btn primary" onclick="window.location.href='index_murid.html'">
                        <i class="fas fa-arrow-left"></i> Kembali ke Daftar Ujian
                    </button>
                </div>
            `;
        }
        showNotification('Gagal memulai ujian: ' + error.message, 'error');
    }
}

function displayStudentInfo(studentInfo) {
    const studentInfoDisplay = document.getElementById('student-info-display');
    const examTitle = document.getElementById('exam-title');
    
    if (studentInfoDisplay) {
        studentInfoDisplay.textContent = `Nama: ${studentInfo.name} | Kelas: ${studentInfo.class}`;
    }
    
    if (examTitle && currentExam) {
        examTitle.textContent = currentExam.title;
    }
}

function initializeExam() {
    // Set up timer
    timeRemaining = currentExam.duration * 60; // Convert minutes to seconds
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitExam();
        }
    }, 1000);
    
    // Display first question
    displayQuestion(currentQuestionIndex);
    
    // Set up navigation buttons
    document.getElementById('prev-question-btn').addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            saveCurrentAnswer();
            currentQuestionIndex--;
            displayQuestion(currentQuestionIndex);
        }
    });

    // Tambahkan event listener untuk mencegah copy
    document.addEventListener('copy', function(e) {
        if (e.target.closest('.exam-question')) {
            e.preventDefault();
            showCopyWarning();
        }
    });
    
    // Fungsi untuk menampilkan peringatan copy
    function showCopyWarning() {
        const warning = document.createElement('div');
        warning.className = 'copy-warning';
        warning.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ups! No copy–copy soal, yaa 😜';
        document.body.appendChild(warning);
        
        // Animasi dan hapus setelah selesai
        setTimeout(() => {
            warning.style.opacity = '0';
            setTimeout(() => warning.remove(), 500);
        }, 1500);
    }
    
    document.getElementById('next-question-btn').addEventListener('click', () => {
        if (currentQuestionIndex < currentQuestions.length - 1) {
            saveCurrentAnswer();
            currentQuestionIndex++;
            displayQuestion(currentQuestionIndex);
        }
    });
    
    // Set up submit button
    document.getElementById('submit-exam-btn').addEventListener('click', () => {
        showSubmitConfirmation();
    });
}

function displayQuestion(index) {
    const question = currentQuestions[index];
    const container = document.getElementById('exam-questions');
    const counter = document.getElementById('question-counter');
    
    // Update counter
    if (counter) {
        counter.textContent = `Soal ${index + 1} dari ${currentQuestions.length}`;
    }
    
    // Clear previous question
    if (container) {
        container.innerHTML = '';
    } else {
        return;
    }
    
    // Create question element
    const questionElement = document.createElement('div');
    questionElement.className = 'exam-question';
    questionElement.dataset.questionId = question.id;
    
    if (question.type === 'multiple-choice') {
        // Multiple choice question
        questionElement.innerHTML = `
            <div class="question-text">
                <h4>${index + 1}. ${question.question}</h4>
                <p class="question-points">Poin: ${question.points}</p>
            </div>
            <div class="question-options">
                ${JSON.parse(question.options).map((option, i) => `
                    <div class="option">
                        <input type="radio" name="answer" id="option-${i}" value="${i}" 
                            ${currentAnswers[question.id].answer === i.toString() ? 'checked' : ''}>
                        <label for="option-${i}">${option}</label>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // Essay question
        questionElement.innerHTML = `
            <div class="question-text">
                <h4>${index + 1}. ${question.question}</h4>
                <p class="question-points">Poin: ${question.points}</p>
            </div>
            <div class="essay-answer">
                <textarea id="essay-answer" placeholder="Tulis jawaban Anda di sini...">${currentAnswers[question.id].answer || ''}</textarea>
            </div>
        `;
    }
    
    container.appendChild(questionElement);
}

function saveCurrentAnswer() {
    const currentQuestion = currentQuestions[currentQuestionIndex];
    const questionId = currentQuestion.id;
    
    if (currentQuestion.type === 'multiple-choice') {
        const selectedOption = document.querySelector(`.exam-question[data-question-id="${questionId}"] input[name="answer"]:checked`);
        currentAnswers[questionId].answer = selectedOption ? selectedOption.value : '';
    } else {
        const answerText = document.querySelector(`.exam-question[data-question-id="${questionId}"] #essay-answer`)?.value;
        currentAnswers[questionId].answer = answerText || '';
    }
}

function showSubmitConfirmation() {
    saveCurrentAnswer();
    
    // Count unanswered questions
    const unanswered = Object.values(currentAnswers).filter(a => !a.answer).length;
    const unansweredElement = document.getElementById('unanswered-count');
    
    if (unansweredElement) {
        if (unanswered > 0) {
            unansweredElement.textContent = `Peringatan: Ada ${unanswered} soal yang belum terjawab!`;
        } else {
            unansweredElement.textContent = '';
        }
    }
    
    // Show modal
    const modal = document.getElementById('submit-confirm-modal');
    if (modal) {
        modal.style.display = 'block';
        
        // Set up modal buttons
        document.getElementById('cancel-submit-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        document.getElementById('confirm-submit-btn').addEventListener('click', () => {
            modal.style.display = 'none';
            submitExam();
        });
    }
}

async function submitExam() {
    try {
        // Stop timer
        clearInterval(timerInterval);
        
        // Calculate time used
        const timeUsed = (currentExam.duration * 60) - timeRemaining;
        
        // Get student info
        const studentInfo = getStudentInfo();
        if (!studentInfo) {
            throw new Error('Data siswa tidak ditemukan');
        }
        
        // Prepare answers for submission
        const answers = Object.keys(currentAnswers).map(questionId => ({
            question_id: parseInt(questionId),
            answer: currentAnswers[questionId].answer,
            student_name: studentInfo.name,
            student_class: studentInfo.class,
            exam_id: currentExam.id,
            submitted_at: new Date().toISOString(),
            time_used: timeUsed
        }));
        
        // Insert answers into database
        const { error } = await supabase
            .from('answers')
            .insert(answers);
        
        if (error) throw error;
        
        // Show completion modal
        const modal = document.getElementById('exam-complete-modal');
        if (modal) {
            modal.style.display = 'block';
            
            document.getElementById('back-to-exams-btn').addEventListener('click', () => {
                window.location.href = 'index_murid.html';
            });
        }
        
    } catch (error) {
        console.error('Error submitting exam:', error);
        showNotification('Gagal mengirim jawaban: ' + error.message, 'error');
    }
}

function updateTimerDisplay() {
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = timeRemaining % 60;
    
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = 
            `Waktu: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is running out
        if (timeRemaining <= 300) { // 5 minutes left
            timerElement.style.color = 'var(--danger)';
        }
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