let currentStepIndex = 0;
let totalSteps = 0;
let roadmapData = null;
let currentQuiz = null;
let currentFlashcards = [];
let currentFlashcardIndex = 0;

// DOM Elements
const startScreen = document.getElementById('start-screen');
const learningScreen = document.getElementById('learning-screen');
const loading = document.getElementById('loading');
const completionModal = document.getElementById('completion-modal');
const quizResultsModal = document.getElementById('quiz-results-modal');

const topicInput = document.getElementById('topic-input');
const personaSelect = document.getElementById('persona-select');
const difficultySelect = document.getElementById('difficulty-select');
const startBtn = document.getElementById('start-btn');
const exampleBtns = document.querySelectorAll('.example-btn');

const backHomeBtn = document.getElementById('back-home-btn');
const sidebarTopic = document.getElementById('sidebar-topic');
const sidebarProgressFill = document.getElementById('sidebar-progress-fill');
const sidebarProgressText = document.getElementById('sidebar-progress-text');
const sidebarProgressPercent = document.getElementById('sidebar-progress-percent');

const stepBadge = document.getElementById('step-badge');
const stepTitle = document.getElementById('step-title');
const stepDetails = document.getElementById('step-details');
const guideContent = document.getElementById('guide-content');
const personaTag = document.getElementById('step-persona-tag');
const difficultyTag = document.getElementById('step-difficulty-tag');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const newTopicBtn = document.getElementById('new-topic-btn');
const exportBtn = document.getElementById('export-btn');

// Stats Elements
const statTotalTopics = document.getElementById('stat-total-topics');
const statCompletedTopics = document.getElementById('stat-completed-topics');
const statTotalProgress = document.getElementById('stat-total-progress');

// Tab system
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Notes
const notesTextarea = document.getElementById('notes-textarea');
const saveNoteBtn = document.getElementById('save-note-btn');

// Chat
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');

// Quiz
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const quizContent = document.getElementById('quiz-content');
const quizResultsContent = document.getElementById('quiz-results-content');
const closeQuizResultsBtn = document.getElementById('close-quiz-results-btn');

// Right Sidebar Elements
const flashcard = document.getElementById('flashcard');
const flashcardFront = document.getElementById('flashcard-front-text');
const flashcardBack = document.getElementById('flashcard-back-text');
const flashcardCount = document.getElementById('flashcard-count');
const prevCardBtn = document.getElementById('prev-card-btn');
const nextCardBtn = document.getElementById('next-card-btn');
const resourcesList = document.getElementById('resources-list');
const roadmapMinimap = document.getElementById('roadmap-minimap');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStats();

    // Intro Splash Sequence
    const introSplash = document.getElementById('intro-splash');
    if (introSplash) {
        setTimeout(() => {
            introSplash.classList.add('reveal');
            setTimeout(() => {
                introSplash.style.display = 'none';
            }, 1000); // Wait for the split animation to finish
        }, 3000); // Show splash for 3 seconds
    }
});

// Event Listeners
if (startBtn) startBtn.addEventListener('click', startLearning);
if (topicInput) topicInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startLearning();
});

exampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        topicInput.value = btn.dataset.topic;
        startLearning();
    });
});

if (backHomeBtn) backHomeBtn.addEventListener('click', resetToStart);
if (prevBtn) prevBtn.addEventListener('click', previousStep);
if (nextBtn) nextBtn.addEventListener('click', nextStep);
if (newTopicBtn) newTopicBtn.addEventListener('click', resetToStart);
if (exportBtn) exportBtn.addEventListener('click', exportHandbook);

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchTab(tabName);
    });
});

// Notes
if (saveNoteBtn) saveNoteBtn.addEventListener('click', saveNote);

// Chat
if (sendChatBtn) sendChatBtn.addEventListener('click', sendChat);
if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});
if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);

// Quiz
if (generateQuizBtn) generateQuizBtn.addEventListener('click', generateQuiz);
if (closeQuizResultsBtn) closeQuizResultsBtn.addEventListener('click', () => {
    quizResultsModal.classList.add('hidden');
});

// Flashcard Listeners
if (flashcard) flashcard.addEventListener('click', () => {
    flashcard.classList.toggle('flipped');
});
if (prevCardBtn) prevCardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    previousFlashcard();
});
if (nextCardBtn) nextCardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    nextFlashcard();
});

// Mobile Sidebar Toggles
const toggleSidebarLeft = document.getElementById('toggle-sidebar-left');
const toggleSidebarRight = document.getElementById('toggle-sidebar-right');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const leftSidebar = document.querySelector('.sidebar');
const rightSidebar = document.querySelector('.right-sidebar');

if (toggleSidebarLeft) {
    toggleSidebarLeft.addEventListener('click', () => {
        leftSidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
        rightSidebar.classList.remove('open');
    });
}

if (toggleSidebarRight) {
    toggleSidebarRight.addEventListener('click', () => {
        rightSidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
        leftSidebar.classList.remove('open');
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        leftSidebar.classList.remove('open');
        rightSidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

// Swipe Gestures for Mobile
let touchStartX = 0;
let touchEndX = 0;

function handleGesture(sidebar, direction) {
    const swipeDistance = touchEndX - touchStartX;
    if (direction === 'rtl' && swipeDistance < -50) {
        // Swipe Right to Left -> Close Left Sidebar
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    } else if (direction === 'ltr' && swipeDistance > 50) {
        // Swipe Left to Right -> Close Right Sidebar
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }
}

if (leftSidebar) {
    leftSidebar.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    leftSidebar.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleGesture(leftSidebar, 'rtl');
    });
}

if (rightSidebar) {
    rightSidebar.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    rightSidebar.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleGesture(rightSidebar, 'ltr');
    });
}

function switchTab(tabName) {
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        if (data.success) {
            statTotalTopics.textContent = data.totalTopics;
            statCompletedTopics.textContent = data.completedTopics;
            statTotalProgress.textContent = `${data.progress}%`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function startLearning() {
    const topic = topicInput.value.trim();
    const persona = personaSelect.value;
    const difficulty = difficultySelect.value;

    if (!topic) {
        topicInput.focus();
        topicInput.style.borderColor = '#ef4444';
        setTimeout(() => {
            topicInput.style.borderColor = '';
        }, 1000);
        return;
    }

    showLoading();

    try {
        const response = await fetch('/api/start-topic', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic, persona, difficulty }),
        });

        const data = await response.json();

        if (data.success) {
            roadmapData = data;
            roadmapData.persona = persona;
            roadmapData.difficulty = difficulty;
            totalSteps = data.steps.length;
            currentStepIndex = 0;
            sidebarTopic.textContent = data.topic;

            personaTag.textContent = persona;
            difficultyTag.textContent = difficulty;

            showScreen('learning-screen');
            await updateLearningScreen();
        } else {
            alert('Error: ' + (data.error || 'Failed to generate roadmap'));
            showScreen('start-screen');
        }
    } catch (error) {
        alert('Error: ' + error.message);
        showScreen('start-screen');
    }
}

async function updateLearningScreen() {
    if (!roadmapData || currentStepIndex >= totalSteps) return;

    const step = roadmapData.steps[currentStepIndex];

    stepBadge.textContent = `Step ${step.number}`;
    stepTitle.textContent = step.title;

    if (step.details.length > 0) {
        stepDetails.innerHTML = `<ul>${step.details.map(d => `<li>${d}</li>`).join('')}</ul>`;
    } else {
        stepDetails.innerHTML = '<p>Loading detailed information...</p>';
    }

    updateProgress();
    prevBtn.disabled = currentStepIndex === 0;
    nextBtn.disabled = currentStepIndex >= totalSteps - 1;

    await loadGuide();
    await loadNote();
    updateRightSidebar();
    chatMessages.innerHTML = '';
}

function updateRightSidebar() {
    updateRoadmapMinimap();
    generateFlashcards();
    fetchRelatedResources();
}

function updateRoadmapMinimap() {
    if (!roadmapData) return;

    roadmapMinimap.innerHTML = '';
    roadmapData.steps.forEach((step, index) => {
        const item = document.createElement('div');
        item.className = `minimap-item ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : ''}`;

        let icon = 'fa-circle';
        if (index < currentStepIndex) icon = 'fa-check-circle';
        else if (index === currentStepIndex) icon = 'fa-arrow-circle-right';

        item.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${step.title}</span>
        `;

        item.onclick = () => {
            currentStepIndex = index;
            updateLearningScreen();
        };

        roadmapMinimap.appendChild(item);
    });
}

function generateFlashcards() {
    if (!roadmapData || !roadmapData.steps[currentStepIndex]) return;

    const step = roadmapData.steps[currentStepIndex];
    currentFlashcards = [];

    // Extract flashcards from step details (simple logic)
    step.details.forEach(detail => {
        if (detail.includes(':')) {
            const [term, definition] = detail.split(':');
            currentFlashcards.push({
                front: term.trim(),
                back: definition.trim()
            });
        } else if (detail.length > 20) {
            // Create a general knowledge card
            currentFlashcards.push({
                front: "Key Concept",
                back: detail.trim()
            });
        }
    });

    currentFlashcardIndex = 0;
    displayFlashcard();
}

function displayFlashcard() {
    flashcard.classList.remove('flipped');

    if (currentFlashcards.length === 0) {
        flashcardFront.textContent = "No flashcards for this step yet.";
        flashcardBack.textContent = "";
        flashcardCount.textContent = "0/0";
        return;
    }

    const card = currentFlashcards[currentFlashcardIndex];
    flashcardFront.textContent = card.front;
    flashcardBack.textContent = card.back;
    flashcardCount.textContent = `${currentFlashcardIndex + 1}/${currentFlashcards.length}`;
}

function nextFlashcard() {
    if (currentFlashcards.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex + 1) % currentFlashcards.length;
    displayFlashcard();
}

function previousFlashcard() {
    if (currentFlashcards.length === 0) return;
    currentFlashcardIndex = (currentFlashcardIndex - 1 + currentFlashcards.length) % currentFlashcards.length;
    displayFlashcard();
}

async function fetchRelatedResources() {
    if (!roadmapData) return;

    const topic = roadmapData.topic;
    const stepTitle = roadmapData.steps[currentStepIndex].title;

    resourcesList.innerHTML = '<div class="guide-loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        // We'll use the search API if available, or just mock some relevant links for now
        // For a real app, you'd call a Perplexity-powered endpoint here
        const response = await fetch('/api/get-resources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, step: stepTitle })
        });

        const data = await response.json();

        if (data.success && data.resources) {
            displayResources(data.resources);
        } else {
            // Fallback mock resources
            const mocks = [
                { title: `Introduction to ${stepTitle}`, type: 'Article', url: `https://www.google.com/search?q=${encodeURIComponent(stepTitle)}` },
                { title: `Deep dive into ${topic}`, type: 'Video', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}` }
            ];
            displayResources(mocks);
        }
    } catch (error) {
        resourcesList.innerHTML = '<p class="empty-state">Error loading resources.</p>';
    }
}

function displayResources(resources) {
    resourcesList.innerHTML = '';
    if (resources.length === 0) {
        resourcesList.innerHTML = '<p class="empty-state">No resources found.</p>';
        return;
    }

    resources.forEach(res => {
        const item = document.createElement('a');
        item.href = res.url;
        item.target = '_blank';
        item.className = 'resource-item';

        let icon = 'fa-file-alt';
        if (res.type === 'Video') icon = 'fa-play-circle';
        if (res.type === 'Course') icon = 'fa-graduation-cap';

        item.innerHTML = `
            <i class="fas ${icon}"></i>
            <div class="resource-info">
                <span class="resource-title">${res.title}</span>
                <span class="resource-type">${res.type}</span>
            </div>
        `;
        resourcesList.appendChild(item);
    });
}

function updateProgress() {
    const progress = ((currentStepIndex + 1) / totalSteps) * 100;
    sidebarProgressFill.style.width = `${progress}%`;
    sidebarProgressText.textContent = `Step ${currentStepIndex + 1} of ${totalSteps}`;
    sidebarProgressPercent.textContent = `${Math.round(progress)}%`;
}

async function loadGuide() {
    guideContent.innerHTML = `
        <div class="guide-loading">
            <div class="scanner-container">
                <div class="scanner-grid"></div>
                <div class="scanner-line"></div>
            </div>
            <p>Analyzing Knowledge Base...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/get-guide', {
            method: 'POST',
        });

        const data = await response.json();

        if (data.success) {
            guideContent.textContent = data.guide;
        } else {
            guideContent.innerHTML = `<p style="color: #ef4444;">Failed to load guide.</p>`;
        }
    } catch (error) {
        guideContent.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
    }
}

async function nextStep() {
    if (currentStepIndex >= totalSteps - 1) {
        showCompletionModal();
        return;
    }

    try {
        const response = await fetch('/api/next-step', {
            method: 'POST',
        });

        const data = await response.json();

        if (data.success) {
            if (data.completed) {
                showCompletionModal();
            } else {
                currentStepIndex = data.currentStepIndex;
                await updateLearningScreen();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function previousStep() {
    if (currentStepIndex === 0) return;
    currentStepIndex--;
    updateLearningScreen();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveNote() {
    const content = notesTextarea.value.trim();
    if (!content) return;

    try {
        const response = await fetch('/api/save-note', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });

        const data = await response.json();

        if (data.success) {
            saveNoteBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            setTimeout(() => {
                saveNoteBtn.innerHTML = '<i class="fas fa-save"></i> Save Note';
            }, 2000);
        }
    } catch (error) {
        alert('Error saving note: ' + error.message);
    }
}

async function loadNote() {
    try {
        const response = await fetch('/api/get-note');
        const data = await response.json();

        if (data.success && data.note) {
            notesTextarea.value = data.note;
        } else {
            notesTextarea.value = '';
        }
    } catch (error) {
        console.error('Error loading note:', error);
    }
}

async function sendChat() {
    const message = chatInput.value.trim();
    if (!message) return;

    addChatMessage('user', message);
    chatInput.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        const data = await response.json();

        if (data.success) {
            addChatMessage('assistant', data.response);
        } else {
            addChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        }
    } catch (error) {
        addChatMessage('assistant', 'Error: ' + error.message);
    }
}

function addChatMessage(role, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    // Clean text by removing markdown characters (* and #)
    const cleanedMessage = message
        .replace(/[*#]/g, '') // Remove all * and #
        .replace(/\n\s*\n/g, '\n') // Remove extra empty lines
        .trim();

    messageDiv.textContent = cleanedMessage;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    if (confirm('Are you sure you want to clear the chat history for this step?')) {
        fetch('/api/clear-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    chatMessages.innerHTML = '';
                    addChatMessage('assistant', 'Chat history cleared.');
                } else {
                    alert('Error clearing chat history: ' + data.error);
                }
            })
            .catch(error => console.error('Error:', error));
    }
}

function exportHandbook() {
    window.location.href = '/api/export';
}

async function generateQuiz() {
    generateQuizBtn.disabled = true;
    generateQuizBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    try {
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
        });

        const data = await response.json();

        if (data.success) {
            currentQuiz = data.questions;
            displayQuiz(data.questions);
        } else {
            alert('Error generating quiz: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        generateQuizBtn.disabled = false;
        generateQuizBtn.innerHTML = '<i class="fas fa-brain"></i> Generate Quiz';
    }
}

function displayQuiz(questions) {
    quizContent.innerHTML = '';
    quizContent.classList.remove('hidden');

    questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-question';
        questionDiv.innerHTML = `
            <h4>Q${index + 1}: ${q.question}</h4>
            ${Object.entries(q.options).map(([key, value]) => `
                <div class="quiz-option" data-question="${index}" data-answer="${key}">
                    ${key}) ${value}
                </div>
            `).join('')}
        `;
        quizContent.appendChild(questionDiv);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-primary';
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit Quiz';
    submitBtn.onclick = submitQuiz;
    quizContent.appendChild(submitBtn);

    // Add click handlers to options
    document.querySelectorAll('.quiz-option').forEach(option => {
        option.addEventListener('click', function () {
            const questionIndex = this.dataset.question;
            document.querySelectorAll(`[data-question="${questionIndex}"]`).forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        });
    });
}

async function submitQuiz() {
    const answers = {};
    document.querySelectorAll('.quiz-option.selected').forEach(option => {
        answers[option.dataset.question] = option.dataset.answer;
    });

    try {
        const response = await fetch('/api/submit-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ answers, questions: currentQuiz }),
        });

        const data = await response.json();

        if (data.success) {
            displayQuizResults(data);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function displayQuizResults(data) {
    quizResultsContent.innerHTML = `
        <div class="completion-icon">
            <i class="fas fa-${data.percentage >= 70 ? 'trophy' : 'chart-line'}"></i>
        </div>
        <h3>Score: ${data.score}/${data.total} (${data.percentage}%)</h3>
        <p>${data.percentage >= 70 ? 'Great job!' : 'Keep practicing!'}</p>
    `;
    quizResultsModal.classList.remove('hidden');
}

function showCompletionModal() {
    completionModal.classList.remove('hidden');
}

function resetToStart() {
    showScreen('start-screen');
    topicInput.value = '';
    currentStepIndex = 0;
    roadmapData = null;
    completionModal.classList.add('hidden');
    notesTextarea.value = '';
    chatMessages.innerHTML = '';
    quizContent.innerHTML = '';
    loadStats(); // Reload stats when going back home
}

function showScreen(screenId) {
    startScreen.classList.remove('active');
    learningScreen.classList.remove('active');
    loading.classList.add('hidden');

    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');

        // Trigger animations
        const animatedElements = activeScreen.querySelectorAll('[class*="animated-"]');
        animatedElements.forEach(el => {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = null;
        });
    }
}

function showLoading() {
    startScreen.classList.remove('active');
    learningScreen.classList.remove('active');
    loading.classList.remove('hidden');
}
