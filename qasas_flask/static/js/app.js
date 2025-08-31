// Global variables
let currentPage = 1;
let totalPages = 0;
let isLoading = false;
let debugMode = false;
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;

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
const debugBtn = document.getElementById('debug-mode');

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
    debugBtn.addEventListener('click', toggleDebugMode);
    
    pageInput.addEventListener('change', function() {
        const page = parseInt(this.value);
        if (page >= 1 && page <= totalPages) {
            goToPage(page);
        }
    });
    
    // Add click handler to PDF image - now supports box selection
    pdfImage.addEventListener('mousedown', handleMouseDown);
    pdfImage.addEventListener('mousemove', handleMouseMove);
    pdfImage.addEventListener('mouseup', handleMouseUp);
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

function handleMouseDown(event) {
    if (event.button !== 0) return; // Only left mouse button
    
    // Get correct coordinates accounting for image position in container
    const container = document.querySelector('.pdf-container');
    const imgRect = pdfImage.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    
    // Calculate image position within container
    const imgLeft = imgRect.left - contRect.left;
    const imgTop = imgRect.top - contRect.top;
    
    // Mouse position relative to container
    const containerX = event.clientX - contRect.left;
    const containerY = event.clientY - contRect.top;
    
    // Mouse position relative to image
    selectionStart.x = containerX - imgLeft;
    selectionStart.y = containerY - imgTop;
    isSelecting = true;
    
    // Debug coordinate verification
    if (debugMode) {
        console.log('🎯 Fixed Mouse Down Coordinates:', {
            screen: { x: event.clientX, y: event.clientY },
            container: { x: containerX, y: containerY },
            imageOffset: { x: imgLeft, y: imgTop },
            relativeToImage: { x: selectionStart.x, y: selectionStart.y },
            imageSize: { w: pdfImage.naturalWidth, h: pdfImage.naturalHeight },
            displaySize: { w: imgRect.width, h: imgRect.height }
        });
    }
    
    // Prevent image dragging
    event.preventDefault();
    
    // Create selection box
    if (selectionBox) {
        selectionBox.remove();
    }
    
    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.cssText = `
        position: absolute;
        border: 2px solid #007acc;
        background: rgba(0, 122, 204, 0.1);
        pointer-events: none;
        z-index: 1000;
        left: ${containerX}px;
        top: ${containerY}px;
        width: 0px;
        height: 0px;
    `;
    
    container.style.position = 'relative';
    container.appendChild(selectionBox);
}

function handleMouseMove(event) {
    if (!isSelecting || !selectionBox) return;
    
    const rect = pdfImage.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    
    // Update selection box
    const left = Math.min(selectionStart.x, currentX);
    const top = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
}

function handleMouseUp(event) {
    if (!isSelecting || !selectionBox) return;
    
    const rect = pdfImage.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;
    
    // Calculate box dimensions
    const left = Math.min(selectionStart.x, endX);
    const top = Math.min(selectionStart.y, endY);
    const width = Math.abs(endX - selectionStart.x);
    const height = Math.abs(endY - selectionStart.y);
    
    isSelecting = false;
    
    // Debug coordinate transformation
    if (debugMode) {
        const scaleX = pdfImage.naturalWidth / rect.width;
        const scaleY = pdfImage.naturalHeight / rect.height;
        
        console.log('🎯 Coordinate Transformation Verification:', {
            selection: {
                display: { left, top, width, height },
                start: selectionStart,
                end: { x: endX, y: endY }
            },
            scaling: {
                factors: { x: scaleX, y: scaleY },
                imageToDisplay: `${scaleX.toFixed(2)}:1`,
                displayToImage: `1:${(1/scaleX).toFixed(2)}`
            },
            finalCoords: {
                x1: Math.round(left * scaleX),
                y1: Math.round(top * scaleY),
                x2: Math.round((left + width) * scaleX),
                y2: Math.round((top + height) * scaleY)
            }
        });
    }
    
    // Only analyze if box is big enough (minimum 5x5 pixels)
    if (width > 5 && height > 5) {
        // Convert to image coordinates
        const scaleX = pdfImage.naturalWidth / rect.width;
        const scaleY = pdfImage.naturalHeight / rect.height;
        
        const box = {
            x1: Math.round(left * scaleX),
            y1: Math.round(top * scaleY),
            x2: Math.round((left + width) * scaleX),
            y2: Math.round((top + height) * scaleY)
        };
        
        console.log('📦 Final Box Coordinates:', box);
        showStatus(`Analyzing selected area (${width}×${height}px → ${box.x2-box.x1}×${box.y2-box.y1}px)`, 'info', 2000);
        
        // Analyze the selected box
        analyzeWordInBox(currentPage, box);
        
        // Keep selection box visible for a moment
        setTimeout(() => {
            if (selectionBox) {
                selectionBox.remove();
                selectionBox = null;
            }
        }, 2000);
    } else {
        // Remove box if too small
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
    }
}

async function analyzeWordInBox(pageNum, box) {
    console.log(`Analyzing Arabic text in box:`, box);
    
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
                box: box
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayBoxAnalysis(data.analysis, box);
            showStatus('Word found in selection!', 'success', 1500);
            console.log('Box analysis completed:', box);
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('Error analyzing selected area:', error);
        displayError('Failed to analyze selection: ' + error.message);
        showStatus('Analysis failed', 'error');
    }
}

function displayBoxAnalysis(analysis, box) {
    const width = box.x2 - box.x1;
    const height = box.y2 - box.y1;
    
    panelContent.innerHTML = `
        <div class="word-definition">
            <div class="coordinate-info" style="background: #e8f4fd; padding: 8px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; color: #666;">
                📦 Selected area: ${width}×${height}px<br>
                📍 Box: (${box.x1},${box.y1}) to (${box.x2},${box.y2})
            </div>
            <div class="definition-item">
                <div style="white-space: pre-line; line-height: 1.6; font-size: 15px;">${analysis}</div>
            </div>
        </div>
    `;
}

async function handleImageClick(event) {
    // Prevent default behavior
    event.preventDefault();
    
    // Remove any existing highlight boxes
    document.querySelectorAll('.word-highlight').forEach(el => el.remove());
    
    // Get click coordinates relative to image
    const rect = pdfImage.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Convert to image coordinates (actual image pixels)
    const scaleX = pdfImage.naturalWidth / rect.width;
    const scaleY = pdfImage.naturalHeight / rect.height;
    const imageX = Math.round(clickX * scaleX);
    const imageY = Math.round(clickY * scaleY);
    
    console.log(`Click at display (${Math.round(clickX)}, ${Math.round(clickY)}) -> image (${imageX}, ${imageY})`);
    
    // Show a soft highlight box around the clicked area
    showWordHighlight(clickX, clickY);
    
    // Show status
    showStatus(`Looking up word at (${imageX}, ${imageY})...`, 'info', 2000);
    
    // Analyze word with AI
    try {
        const response = await fetch('/analyze_word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                page: currentPage,
                x: imageX,
                y: imageY,
                method: 'click'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            displaySimpleDefinition(data.word_info);
        } else {
            showDefinitionError('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        showDefinitionError('Error analyzing word: ' + error.message);
    }
}

function showWordHighlight(x, y) {
    const container = document.querySelector('.pdf-container');
    const highlight = document.createElement('div');
    highlight.className = 'word-highlight';
    
    // Create a soft box around the clicked area (approximately word-sized)
    const boxSize = 60; // Adjust this size as needed
    highlight.style.cssText = `
        position: absolute;
        left: ${x - boxSize/2}px;
        top: ${y - boxSize/2}px;
        width: ${boxSize}px;
        height: ${boxSize}px;
        background: rgba(255, 255, 0, 0.3);
        border: 2px solid rgba(255, 255, 0, 0.7);
        border-radius: 8px;
        z-index: 1000;
        pointer-events: none;
        animation: pulse 1s ease-in-out;
    `;
    
    container.appendChild(highlight);
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
        if (highlight.parentNode) {
            highlight.remove();
        }
    }, 3000);
}

function displaySimpleDefinition(wordInfo) {
    // Remove existing definition display
    const existingDef = document.getElementById('simple-definition');
    if (existingDef) {
        existingDef.remove();
    }
    
    // Create simple definition display below the PDF
    const definitionDiv = document.createElement('div');
    definitionDiv.id = 'simple-definition';
    definitionDiv.style.cssText = `
        margin: 20px auto;
        max-width: 800px;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        font-family: Arial, sans-serif;
        border: 2px solid rgba(255, 255, 255, 0.2);
    `;
    
    let content = `<h3 style="margin: 0 0 15px 0; color: #fff; text-align: center;">📖 Word Lookup Result</h3>`;
    
    if (wordInfo.arabic_text) {
        content += `<div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <strong>Arabic Word:</strong> <span style="font-size: 20px; color: #ffd700;">${wordInfo.arabic_text}</span>
        </div>`;
    }
    
    if (wordInfo.english_meaning) {
        content += `<div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <strong>English Definition:</strong><br>
            <span style="font-size: 16px; line-height: 1.4;">${wordInfo.english_meaning}</span>
        </div>`;
    }
    
    if (wordInfo.confidence) {
        content += `<div style="text-align: center; opacity: 0.8; font-size: 14px;">
            Confidence: ${wordInfo.confidence}
        </div>`;
    }
    
    definitionDiv.innerHTML = content;
    
    // Insert after the PDF container
    const pdfContainer = document.querySelector('.pdf-container');
    pdfContainer.insertAdjacentElement('afterend', definitionDiv);
    
    // Scroll to definition
    definitionDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showDefinitionError(message) {
    const existingDef = document.getElementById('simple-definition');
    if (existingDef) {
        existingDef.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.id = 'simple-definition';
    errorDiv.style.cssText = `
        margin: 20px auto;
        max-width: 800px;
        padding: 20px;
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        font-family: Arial, sans-serif;
        text-align: center;
    `;
    
    errorDiv.innerHTML = `<h3 style="margin: 0 0 10px 0;">❌ Error</h3><p style="margin: 0;">${message}</p>`;
    
    const pdfContainer = document.querySelector('.pdf-container');
    pdfContainer.insertAdjacentElement('afterend', errorDiv);
}
function toggleDebugMode() {
    debugMode = !debugMode;
    debugBtn.textContent = debugMode ? '🔍 Debug Mode: ON' : '🔍 Debug Mode: OFF';
    debugBtn.style.background = debugMode ? '#e74c3c' : '#7f8c8d';
    
    if (debugMode) {
        showStatus('Debug mode enabled - coordinate verification active', 'info', 3000);
        addCoordinateGrid();
        addCoordinateDisplay();
        addCornerMarkers();
    } else {
        showStatus('Debug mode disabled', 'info', 1500);
        removeCoordinateGrid();
        removeCoordinateDisplay();
    }
}

function addCoordinateGrid() {
    // Remove existing grid
    removeCoordinateGrid();
    
    const container = document.querySelector('.pdf-container');
    const rect = pdfImage.getBoundingClientRect();
    
    // Create grid overlay
    const grid = document.createElement('div');
    grid.id = 'coordinate-grid';
    grid.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 500;
        background-image: 
            linear-gradient(rgba(255,0,0,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,0,0,0.3) 1px, transparent 1px);
        background-size: 50px 50px;
    `;
    
    container.style.position = 'relative';
    container.appendChild(grid);
    
    // Add corner markers
    addCornerMarkers();
}

function addCornerMarkers() {
    const container = document.querySelector('.pdf-container');
    const imgRect = pdfImage.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    
    // Image position relative to container
    const imgLeft = imgRect.left - contRect.left;
    const imgTop = imgRect.top - contRect.top;
    const imgWidth = imgRect.width;
    const imgHeight = imgRect.height;
    
    console.log('🎯 Image positioning debug:', {
        imageRect: imgRect,
        containerRect: contRect,
        calculatedPosition: { left: imgLeft, top: imgTop, width: imgWidth, height: imgHeight }
    });
    
    // Adjust marker positions to be EXACTLY at image corners
    const corners = [
        { x: imgLeft, y: imgTop, label: '(0,0)', color: '#ff0000', labelPos: 'top-left' },
        { x: imgLeft + imgWidth - 1, y: imgTop, label: `(${pdfImage.naturalWidth},0)`, color: '#00ff00', labelPos: 'top-right' },
        { x: imgLeft, y: imgTop + imgHeight - 1, label: `(0,${pdfImage.naturalHeight})`, color: '#0000ff', labelPos: 'bottom-left' },
        { x: imgLeft + imgWidth - 1, y: imgTop + imgHeight - 1, label: `(${pdfImage.naturalWidth},${pdfImage.naturalHeight})`, color: '#ff00ff', labelPos: 'bottom-right' }
    ];
    
    corners.forEach((corner, i) => {
        // Create marker - center it exactly on the corner pixel
        const marker = document.createElement('div');
        marker.className = 'corner-marker';
        marker.style.cssText = `
            position: absolute;
            left: ${corner.x - 5}px;
            top: ${corner.y - 5}px;
            width: 10px;
            height: 10px;
            background: ${corner.color};
            border: 2px solid #ffffff;
            border-radius: 50%;
            z-index: 1500;
            pointer-events: none;
            box-shadow: 0 3px 6px rgba(0,0,0,0.7);
        `;
        
        // Calculate label position to keep it visible
        let labelLeft, labelTop;
        switch(corner.labelPos) {
            case 'top-left':
                labelLeft = corner.x + 15;
                labelTop = corner.y - 5;
                break;
            case 'top-right':
                labelLeft = corner.x - 120;
                labelTop = corner.y - 5;
                break;
            case 'bottom-left':
                labelLeft = corner.x + 15;
                labelTop = corner.y - 25;
                break;
            case 'bottom-right':
                labelLeft = corner.x - 120;
                labelTop = corner.y - 25;
                break;
        }
        
        // Create label
        const label = document.createElement('div');
        label.className = 'corner-label';
        label.style.cssText = `
            position: absolute;
            left: ${labelLeft}px;
            top: ${labelTop}px;
            background: ${corner.color};
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            z-index: 1600;
            pointer-events: none;
            box-shadow: 0 3px 6px rgba(0,0,0,0.7);
            white-space: nowrap;
            border: 2px solid white;
            font-family: monospace;
        `;
        label.textContent = corner.label;
        
        console.log(`Fixed Corner ${i}:`, {
            marker: { x: corner.x, y: corner.y },
            label: { x: labelLeft, y: labelTop, text: corner.label }
        });
        
        container.appendChild(marker);
        container.appendChild(label);
    });
    
    // Remove test label - no longer needed
}

function addCoordinateDisplay() {
    // Create coordinate display panel
    const coordDisplay = document.createElement('div');
    coordDisplay.id = 'coordinate-display';
    coordDisplay.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        z-index: 2000;
        min-width: 300px;
    `;
    coordDisplay.innerHTML = `
        <strong>🎯 Coordinate Verification</strong><br>
        <div id="coord-info">Move mouse over image...</div>
    `;
    
    document.body.appendChild(coordDisplay);
    
    // Add mouse move listener for real-time coordinates
    pdfImage.addEventListener('mousemove', updateCoordinateDisplay);
}

function updateCoordinateDisplay(event) {
    const coordInfo = document.getElementById('coord-info');
    if (!coordInfo) return;
    
    // Get image position relative to container
    const container = document.querySelector('.pdf-container');
    const imgRect = pdfImage.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    
    // Mouse position relative to page
    const pageX = event.clientX;
    const pageY = event.clientY;
    
    // Mouse position relative to container
    const containerX = pageX - contRect.left;
    const containerY = pageY - contRect.top;
    
    // Image boundaries relative to container
    const imgLeft = imgRect.left - contRect.left;
    const imgTop = imgRect.top - contRect.top;
    const imgRight = imgLeft + imgRect.width;
    const imgBottom = imgTop + imgRect.height;
    
    // Mouse position relative to image (FIXED CALCULATION)
    const mouseX = pageX - imgRect.left;
    const mouseY = pageY - imgRect.top;
    
    // Calculate scaled coordinates (FIXED CALCULATION)
    const scaleX = pdfImage.naturalWidth / imgRect.width;
    const scaleY = pdfImage.naturalHeight / imgRect.height;
    const scaledX = Math.round(mouseX * scaleX);
    const scaledY = Math.round(mouseY * scaleY);
    
    // Check if mouse is actually over the image
    const isOverImage = mouseX >= 0 && mouseY >= 0 && mouseX <= imgRect.width && mouseY <= imgRect.height;
    
    coordInfo.innerHTML = `
        <strong>Page:</strong> (${Math.round(pageX)}, ${Math.round(pageY)})<br>
        <strong>Container:</strong> (${Math.round(containerX)}, ${Math.round(containerY)})<br>
        <strong>Image Bounds:</strong> [${Math.round(imgLeft)},${Math.round(imgTop)} to ${Math.round(imgRight)},${Math.round(imgBottom)}]<br>
        <strong>Mouse-Image:</strong> (${Math.round(mouseX)}, ${Math.round(mouseY)})<br>
        <strong>Scaled:</strong> (${scaledX}, ${scaledY})<br>
        <strong>Display Size:</strong> ${Math.round(imgRect.width)}×${Math.round(imgRect.height)}<br>
        <strong>Actual Size:</strong> ${pdfImage.naturalWidth}×${pdfImage.naturalHeight}<br>
        <strong>Scale:</strong> ${scaleX.toFixed(2)}×${scaleY.toFixed(2)}<br>
        <strong>Over Image:</strong> ${isOverImage ? '✅ Yes' : '❌ No'}
    `;
}

function removeCoordinateGrid() {
    const grid = document.getElementById('coordinate-grid');
    if (grid) grid.remove();
    
    // Remove corner markers and labels
    const markers = document.querySelectorAll('.corner-marker');
    markers.forEach(marker => marker.remove());
    
    const labels = document.querySelectorAll('.corner-label');
    labels.forEach(label => label.remove());
    
    // Remove test labels
    const container = document.querySelector('.pdf-container');
    const testLabels = container.querySelectorAll('div');
    testLabels.forEach(element => {
        if (element.textContent && element.textContent.includes('TEST LABEL')) {
            element.remove();
        }
    });
}

function removeCoordinateDisplay() {
    const display = document.getElementById('coordinate-display');
    if (display) display.remove();
    
    pdfImage.removeEventListener('mousemove', updateCoordinateDisplay);
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

function showCoordinateMarker(x, y) {
    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.coordinate-marker');
    existingMarkers.forEach(marker => marker.remove());
    
    // Add marker on the image
    const marker = document.createElement('div');
    marker.className = 'coordinate-marker';
    marker.style.position = 'absolute';
    marker.style.left = (x - 2) + 'px';
    marker.style.top = (y - 2) + 'px';
    marker.style.width = '4px';
    marker.style.height = '4px';
    marker.style.backgroundColor = '#ff0000';
    marker.style.borderRadius = '50%';
    marker.style.zIndex = '1000';
    marker.style.pointerEvents = 'none';
    
    const container = document.querySelector('.pdf-container');
    container.style.position = 'relative';
    container.appendChild(marker);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (marker.parentNode) {
            marker.parentNode.removeChild(marker);
        }
    }, 3000);
}

async function analyzeWordAtCoordinates(pageNum, x, y, relativeX, relativeY) {
    console.log(`Analyzing Arabic word at (${x}, ${y}) on page ${pageNum}`);
    
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
                y: y,
                relative_x: relativeX,
                relative_y: relativeY,
                text_direction: "rtl"
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayAnalysis(data.analysis, x, y);
            showStatus('Word found!', 'success', 1500);
            console.log('AI analysis completed for coordinates:', { x, y });
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error('Error analyzing Arabic word:', error);
        displayError('Failed to analyze word: ' + error.message);
        showStatus('Analysis failed', 'error');
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

function displayAnalysis(analysis, x, y) {
    panelContent.innerHTML = `
        <div class="word-definition">
            <div class="coordinate-info" style="background: #e8f4fd; padding: 8px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; color: #666;">
                🎯 Clicked at: (${x}, ${y})
            </div>
            <div class="definition-item">
                <div style="white-space: pre-line; line-height: 1.6; font-size: 15px;">${analysis}</div>
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
