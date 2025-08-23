// Global variables
let currentPage = 1;
let totalPages = 0;
let isLoading = false;

// DOM elements
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageInput = document.getElementById('page-input');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const testApiBtn = document.getElementById('test-api');
const pageInfo = document.getElementById('page-info');
const pdfImage = document.getElementById('pdf-image');
const loadingMessage = document.getElementById('loading-message');
const definitionPanel = document.getElementById('definition-panel');
const panelContent = document.getElementById('panel-content');
const closePanel = document.getElementById('close-panel');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing Qasas Flask App...');
    
    // Event listeners
    prevBtn.addEventListener('click', showPrevPage);
    nextBtn.addEventListener('click', showNextPage);
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    testApiBtn.addEventListener('click', testApiConnection);
    closePanel.addEventListener('click', hideDefinitionPanel);
    
    pageInput.addEventListener('change', function() {
        const page = parseInt(this.value);
        if (page >= 1 && page <= totalPages) {
            goToPage(page);
        }
    });
    
    // Add click handler to PDF image
    pdfImage.addEventListener('click', handleImageClick);
    
    // Load PDF
    await loadPDF();
}

async function loadPDF() {
    console.log('Loading PDF...');
    showStatus('Loading PDF...', 'info');
    
    try {
        const response = await fetch('/load_pdf');
        const data = await response.json();
        
        if (data.success) {
            totalPages = data.total_pages;
            console.log(`PDF loaded: ${totalPages} pages`);
            showStatus(`PDF loaded successfully: ${totalPages} pages`, 'success');
            
            // Load first page
            await loadPage(1);
            updateUI();
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        showStatus('Failed to load PDF: ' + error.message, 'error');
    }
}

async function loadPage(pageNum) {
    if (isLoading || pageNum < 1 || pageNum > totalPages) return;
    
    isLoading = true;
    loadingMessage.style.display = 'block';
    pdfImage.style.display = 'none';
    
    try {
        console.log(`Loading page ${pageNum}...`);
        
        const response = await fetch(`/get_page/${pageNum}`);
        const data = await response.json();
        
        if (data.success) {
            pdfImage.src = data.image;
            pdfImage.style.display = 'block';
            currentPage = pageNum;
            
            // Update page input
            pageInput.value = currentPage;
            
            console.log(`Page ${pageNum} loaded successfully`);
            showStatus(`Page ${pageNum} loaded`, 'success', 2000);
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('Error loading page:', error);
        showStatus('Failed to load page: ' + error.message, 'error');
    } finally {
        isLoading = false;
        loadingMessage.style.display = 'none';
        updateUI();
    }
}

async function handleImageClick(event) {
    // Get click coordinates relative to image
    const rect = pdfImage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert to image coordinates
    const imageX = (x / rect.width) * pdfImage.naturalWidth;
    const imageY = (y / rect.height) * pdfImage.naturalHeight;
    
    console.log(`Image clicked at: (${Math.round(imageX)}, ${Math.round(imageY)})`);
    
    // Show visual feedback
    showClickFeedback(event.clientX, event.clientY);
    
    // Analyze word with AI
    await analyzeWordAtCoordinates(currentPage, Math.round(imageX), Math.round(imageY));
}

function showClickFeedback(x, y) {
    const feedback = document.createElement('div');
    feedback.className = 'click-feedback';
    feedback.style.left = (x - 6) + 'px';
    feedback.style.top = (y - 6) + 'px';
    
    document.body.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 600);
}

async function analyzeWordAtCoordinates(pageNum, x, y) {
    console.log(`Analyzing word at (${x}, ${y}) on page ${pageNum}`);
    
    // Show definition panel with loading
    showDefinitionPanel();
    showLoadingInPanel();
    
    try {
        const response = await fetch('/analyze_word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                page_num: pageNum,
                x: x,
                y: y
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayAnalysis(data.analysis);
            console.log('AI analysis completed');
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('Error analyzing word:', error);
        displayError('Failed to analyze word: ' + error.message);
    }
}

function showLoadingInPanel() {
    panelContent.innerHTML = `
        <div class="loading-message">
            <div class="spinner"></div>
            <p>AI is analyzing the text...</p>
        </div>
    `;
}

function displayAnalysis(analysis) {
    panelContent.innerHTML = `
        <div class="word-definition">
            <div class="definition-item">
                <div style="white-space: pre-line; line-height: 1.8; font-size: 16px;">${analysis}</div>
            </div>
        </div>
    `;
}

function displayError(message) {
    panelContent.innerHTML = `
        <div class="definition-item" style="border-left-color: #e74c3c; background: #fdf2f2;">
            <div style="color: #e74c3c;">${message}</div>
        </div>
    `;
}

async function testApiConnection() {
    console.log('Testing API connection...');
    testApiBtn.disabled = true;
    testApiBtn.textContent = 'Testing...';
    
    try {
        const response = await fetch('/test_api');
        const data = await response.json();
        
        if (data.success) {
            testApiBtn.textContent = 'API Works ✓';
            testApiBtn.style.background = '#27ae60';
            showStatus('OpenAI API connection successful', 'success');
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('API test failed:', error);
        testApiBtn.textContent = 'API Failed ✗';
        testApiBtn.style.background = '#e74c3c';
        showStatus('API test failed: ' + error.message, 'error');
    } finally {
        setTimeout(() => {
            testApiBtn.textContent = 'Test API';
            testApiBtn.style.background = '#27ae60';
            testApiBtn.disabled = false;
        }, 3000);
    }
}

function showPrevPage() {
    if (currentPage > 1) {
        loadPage(currentPage - 1);
    }
}

function showNextPage() {
    if (currentPage < totalPages) {
        loadPage(currentPage + 1);
    }
}

function goToPage(pageNum) {
    if (pageNum >= 1 && pageNum <= totalPages) {
        loadPage(pageNum);
    }
}

function zoomIn() {
    const currentWidth = pdfImage.style.width || '100%';
    const currentScale = parseFloat(currentWidth) || 100;
    const newScale = Math.min(currentScale + 25, 200);
    pdfImage.style.width = newScale + '%';
    showStatus(`Zoom: ${newScale}%`, 'info', 1500);
}

function zoomOut() {
    const currentWidth = pdfImage.style.width || '100%';
    const currentScale = parseFloat(currentWidth) || 100;
    const newScale = Math.max(currentScale - 25, 50);
    pdfImage.style.width = newScale + '%';
    showStatus(`Zoom: ${newScale}%`, 'info', 1500);
}

function updateUI() {
    // Update page info
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Update navigation buttons
    prevBtn.disabled = currentPage <= 1 || isLoading;
    nextBtn.disabled = currentPage >= totalPages || isLoading;
    
    // Update page input
    pageInput.max = totalPages;
}

function showDefinitionPanel() {
    definitionPanel.classList.remove('hidden');
}

function hideDefinitionPanel() {
    definitionPanel.classList.add('hidden');
}

function showStatus(message, type = 'info', duration = 5000) {
    // Remove existing status messages
    const existingMessages = document.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new status message
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    
    document.body.appendChild(statusDiv);
    
    // Auto-hide after duration
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.style.opacity = '0';
            statusDiv.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.parentNode.removeChild(statusDiv);
                }
            }, 500);
        }
    }, duration);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            showNextPage();
            break;
        case 'ArrowRight':
            e.preventDefault();
            showPrevPage();
            break;
        case '+':
        case '=':
            e.preventDefault();
            zoomIn();
            break;
        case '-':
            e.preventDefault();
            zoomOut();
            break;
        case 'Escape':
            hideDefinitionPanel();
            break;
    }
});

console.log('Qasas Flask App JavaScript loaded');
