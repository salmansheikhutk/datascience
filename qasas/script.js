// Global variables
let pdfDoc = null;
let pageNum = 1;
let pageIsRendering = false;
let pageNumIsPending = null;
let scale = 1.5;
let canvas = null;
let ctx = null;
let openAIApiKey = '';

// DOM elements
const pdfCanvas = document.getElementById('pdf-canvas');
const pageInfo = document.getElementById('page-info');
const pageInput = document.getElementById('page-input');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const definitionPanel = document.getElementById('definition-panel');
const panelContent = document.getElementById('panel-content');
const closePanel = document.getElementById('close-panel');
const apiKeySection = document.getElementById('api-key-section');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Load API key from config file
    loadApiKeyFromConfig();
    
    // Initialize canvas
    canvas = pdfCanvas;
    ctx = canvas.getContext('2d');
    
    // Event listeners
    prevBtn.addEventListener('click', showPrevPage);
    nextBtn.addEventListener('click', showNextPage);
    zoomInBtn.addEventListener('click', () => changeZoom(0.25));
    zoomOutBtn.addEventListener('click', () => changeZoom(-0.25));
    closePanel.addEventListener('click', hideDefinitionPanel);
    
    pageInput.addEventListener('change', function() {
        const page = parseInt(this.value);
        if (page >= 1 && pdfDoc && page <= pdfDoc.numPages) {
            queueRenderPage(page);
        }
    });

    // Load PDF after API key is loaded
    if (openAIApiKey) {
        console.log('API key loaded successfully');
        loadPDF();
    } else {
        console.error('Could not load OpenAI API key from config file');
        alert('Error: Could not load API key. Please check your config.js file.');
    }
}

function loadApiKeyFromConfig() {
    try {
        if (typeof CONFIG !== 'undefined' && CONFIG.OPENAI_API_KEY) {
            openAIApiKey = CONFIG.OPENAI_API_KEY;
            console.log('API key loaded from config file');
        } else {
            console.error('CONFIG object or OPENAI_API_KEY not found');
        }
    } catch (error) {
        console.error('Error loading API key from config:', error);
    }
}

async function loadPDF() {
    try {
        console.log('Starting PDF load...');
        
        // Load the PDF file
        const loadingTask = pdfjsLib.getDocument('./Qasas-ul-Anbiya-Part-1.pdf');
        
        loadingTask.onProgress = function(progress) {
            console.log('Loading progress:', progress.loaded / progress.total * 100, '%');
        };
        
        pdfDoc = await loadingTask.promise;
        
        console.log('PDF loaded successfully:', pdfDoc.numPages, 'pages');
        
        // Render the first page
        renderPage(pageNum);
        
        // Update UI
        updatePageInfo();
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        console.log('Trying alternative path...');
        
        // Try alternative path
        try {
            const altLoadingTask = pdfjsLib.getDocument('./qasas/Qasas-ul-Anbiya-Part-1.pdf');
            pdfDoc = await altLoadingTask.promise;
            console.log('PDF loaded from alternative path:', pdfDoc.numPages, 'pages');
            renderPage(pageNum);
            updatePageInfo();
        } catch (altError) {
            console.error('Alternative path also failed:', altError);
            alert('Error loading PDF. Please check if the file exists and is accessible.');
        }
    }
}

function renderPage(num) {
    pageIsRendering = true;
    
    // Update UI state
    updateNavigationButtons();
    
    pdfDoc.getPage(num).then(function(page) {
        console.log('Rendering page:', num);
        
        const viewport = page.getViewport({ scale: scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        
        renderTask.promise.then(function() {
            pageIsRendering = false;
            
            if (pageNumIsPending !== null) {
                renderPage(pageNumIsPending);
                pageNumIsPending = null;
            }
            
            // Render text layer for clickable words
            renderTextLayer(page, viewport);
        });
    });
}

async function renderTextLayer(page, viewport) {
    try {
        // Remove existing text layer
        const existingLayer = document.querySelector('.text-layer');
        if (existingLayer) {
            existingLayer.remove();
        }
        
        // Get text content
        const textContent = await page.getTextContent();
        
        // Create text layer container
        const textLayer = document.createElement('div');
        textLayer.className = 'text-layer';
        
        // Position the text layer over the canvas
        const canvasContainer = canvas.parentElement;
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = canvasContainer.getBoundingClientRect();
        
        textLayer.style.left = (canvasRect.left - containerRect.left) + 'px';
        textLayer.style.top = (canvasRect.top - containerRect.top) + 'px';
        textLayer.style.width = canvas.width / window.devicePixelRatio + 'px';
        textLayer.style.height = canvas.height / window.devicePixelRatio + 'px';
        
        // Add text spans
        textContent.items.forEach(function(textItem) {
            if (textItem.str.trim() === '') return;
            
            const span = document.createElement('span');
            span.textContent = textItem.str;
            span.style.left = (textItem.transform[4] * scale) + 'px';
            span.style.top = (viewport.height - textItem.transform[5] * scale) + 'px';
            span.style.fontSize = (textItem.transform[0] * scale) + 'px';
            span.style.fontFamily = textItem.fontName || 'Arial';
            
            // Add click handler for word lookup
            span.addEventListener('click', function(e) {
                e.preventDefault();
                const word = textItem.str.trim();
                if (word) {
                    lookupWord(word);
                }
            });
            
            textLayer.appendChild(span);
        });
        
        canvasContainer.appendChild(textLayer);
        
    } catch (error) {
        console.error('Error rendering text layer:', error);
    }
}

function queueRenderPage(num) {
    if (pageIsRendering) {
        pageNumIsPending = num;
    } else {
        renderPage(num);
    }
    pageNum = num;
    updatePageInfo();
}

function showPrevPage() {
    if (pageNum <= 1) return;
    queueRenderPage(pageNum - 1);
}

function showNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    queueRenderPage(pageNum + 1);
}

function changeZoom(delta) {
    scale += delta;
    if (scale < 0.5) scale = 0.5;
    if (scale > 3) scale = 3;
    queueRenderPage(pageNum);
}

function updatePageInfo() {
    if (pdfDoc) {
        pageInfo.textContent = `صفحة ${pageNum} من ${pdfDoc.numPages}`;
        pageInput.value = pageNum;
    }
}

function updateNavigationButtons() {
    if (pdfDoc) {
        prevBtn.disabled = pageNum <= 1;
        nextBtn.disabled = pageNum >= pdfDoc.numPages;
    }
}

async function lookupWord(word) {
    console.log('Looking up word:', word);
    
    // Show definition panel
    showDefinitionPanel();
    
    // Show loading state
    showLoadingState();
    
    try {
        // Call OpenAI API for word definition
        const definition = await getWordDefinition(word);
        
        // Display the definition
        displayDefinition(word, definition);
        
    } catch (error) {
        console.error('Error looking up word:', error);
        displayError('حدث خطأ في البحث عن الكلمة. تأكد من صحة مفتاح API.');
    }
}

async function getWordDefinition(word) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAIApiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `أنت مساعد متخصص في اللغة العربية. عندما يُعطى لك كلمة عربية، قدم معلومات شاملة عنها بالعربية تتضمن:
1. المعنى الأساسي
2. الجذر اللغوي إن أمكن
3. أمثلة على الاستخدام
4. معلومات نحوية إضافية إن لزم الأمر

اجعل الإجابة واضحة ومفيدة للمتعلمين.`
                },
                {
                    role: 'user',
                    content: `اشرح لي هذه الكلمة العربية: ${word}`
                }
            ],
            max_tokens: 500,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function showDefinitionPanel() {
    definitionPanel.classList.remove('hidden');
}

function hideDefinitionPanel() {
    definitionPanel.classList.add('hidden');
}

function showLoadingState() {
    panelContent.innerHTML = `
        <div class="panel-loading">
            <div class="spinner"></div>
            <p>جاري البحث عن معنى الكلمة...</p>
        </div>
    `;
}

function displayDefinition(word, definition) {
    panelContent.innerHTML = `
        <div class="word-definition">
            <div class="arabic-word">${word}</div>
            <div class="definition-item">
                <div style="white-space: pre-line; direction: rtl; text-align: right;">${definition}</div>
            </div>
        </div>
    `;
}

function displayError(message) {
    panelContent.innerHTML = `
        <div class="definition-item" style="border-left-color: #e74c3c; background: #fdf2f2;">
            <div style="color: #e74c3c; direction: rtl; text-align: right;">${message}</div>
        </div>
    `;
}

// Handle keyboard shortcuts
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
            changeZoom(0.25);
            break;
        case '-':
            e.preventDefault();
            changeZoom(-0.25);
            break;
        case 'Escape':
            hideDefinitionPanel();
            break;
    }
});

console.log('Qasas PDF Reader initialized');
