// Global variables
let currentPage = 1;
let totalPages = 0;
let currentBook = null;
let isLoading = false;
let debugMode = false;
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;
let selectStart = { x: 0, y: 0 };

// DOM elements
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageInput = document.getElementById('page-input');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const translatePageBtn = document.getElementById('translate-page');
const testApiBtn = document.getElementById('test-api');
const pageInfo = document.getElementById('page-info');
const pdfImage = document.getElementById('pdf-image');
const loadingMessage = document.getElementById('loading-message');
const definitionPanel = document.getElementById('definition-panel');
const panelContent = document.getElementById('panel-content');
const closePanel = document.getElementById('close-panel');
const debugBtn = document.getElementById('debug-mode');
const translateSelectionBtn = document.getElementById('translateSelectionBtn');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing Qasas Flask App...');
    
    // Event listeners for PDF navigation
    prevBtn.addEventListener('click', showPrevPage);
    nextBtn.addEventListener('click', showNextPage);
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    translatePageBtn.addEventListener('click', () => loadPageTranslation(currentPage));
    testApiBtn.addEventListener('click', testApiConnection);
    closePanel.addEventListener('click', hideDefinitionPanel);
    debugBtn.addEventListener('click', toggleDebugMode);
    
    // Back to gallery button
    const backToGalleryBtn = document.getElementById('back-to-gallery');
    if (backToGalleryBtn) {
        backToGalleryBtn.addEventListener('click', showGalleryView);
    }
    
    pageInput.addEventListener('change', function() {
        const page = parseInt(this.value);
        if (page >= 1 && page <= totalPages) {
            goToPage(page);
        }
    });
    
    pageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const page = parseInt(this.value);
            if (page >= 1 && page <= totalPages) {
                goToPage(page);
            }
        }
    });
    
    // Add keyboard shortcuts for navigation
    document.addEventListener('keydown', function(event) {
        // Only handle keys when not typing in an input field
        if (event.target.tagName === 'INPUT') return;
        
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                showPrevPage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                showNextPage();
                break;
        }
    });
    
    // Add click handler to PDF image - now supports box selection
    pdfImage.addEventListener('mousedown', handleMouseDown);
    pdfImage.addEventListener('mousemove', handleMouseMove);
    pdfImage.addEventListener('mouseup', handleMouseUp);
    pdfImage.addEventListener('click', handleImageClick);
    
    // Show gallery view on startup (no auto-load)
    await showGalleryView();
    
    // Also populate the book selector for the PDF section
    await loadAvailableBooks();
    
    // Ensure we have a button for region translation
    if (translateSelectionBtn) {
      translateSelectionBtn.addEventListener('click', async () => {
        if (!selectionBox) {
          // Fallback to page translation if no selection
          if (typeof translateCurrentPage === 'function') return translateCurrentPage();
          return;
        }
        await translateSelectedRegion();
      });
    }
}

async function showGalleryView() {
    console.log('Showing gallery view...');
    
    // Hide PDF section and show gallery
    const pdfSection = document.getElementById('pdf-section');
    const gallerySection = document.getElementById('books-gallery');
    
    if (pdfSection) pdfSection.style.display = 'none';
    if (gallerySection) gallerySection.style.display = 'block';
    
    await loadBooksGallery();
}

async function loadBookCoverImage(bookCoverElement, filename, title) {
    try {
        console.log(`Loading cover for: ${filename}`);
        const response = await fetch(`/get_book_cover/${filename}`);
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch (e) {
            console.error('Non-JSON cover response for', filename, raw);
            throw new Error('Invalid cover response');
        }
        console.log(`Cover response for ${filename}:`, data);
        if (data.success && data.image_url) {
            bookCoverElement.innerHTML = `
                <img src="${data.image_url}" alt="${title}" loading="lazy" 
                     onerror="this.parentElement.innerHTML='<div class=\\"book-cover-error\\">Image failed to load</div><div class=\\"book-title\\">${title}</div>'">
                <div class="book-title">${title}</div>
            `;
        } else {
            bookCoverElement.innerHTML = `
                <div class="book-cover-error">Failed to load cover<br><small>${(data && data.message) || 'Unknown error'}</small></div>
                <div class="book-title">${title}</div>
            `;
        }
    } catch (error) {
        console.error(`Error loading cover for ${filename}:`, error);
        bookCoverElement.innerHTML = `
            <div class="book-cover-error">Network error loading cover</div>
            <div class="book-title">${title}</div>
        `;
    }
}

async function loadBooksGallery() {
    console.log('Loading books gallery...');
    
    const booksGrid = document.getElementById('books-grid');
    if (!booksGrid) {
        console.error('Books grid element not found');
        return;
    }
    
    try {
        // Show loading state
        booksGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">Loading books...</div>';
        
        const response = await fetch('/get_books');
        const data = await response.json();
        
        if (data.success && Object.keys(data.books).length > 0) {
            booksGrid.innerHTML = ''; // Clear loading message
            
            // Create book cover elements
            for (const [filename, title] of Object.entries(data.books)) {
                const bookCover = document.createElement('div');
                bookCover.className = 'book-cover';
                bookCover.setAttribute('data-book', filename);
                
                // Create placeholder content first
                bookCover.innerHTML = `
                    <div class="book-cover-placeholder">Loading...</div>
                    <div class="book-title">${title}</div>
                `;
                
                // Add click handler to load the book
                bookCover.addEventListener('click', () => loadBookFromGallery(filename, title));
                
                booksGrid.appendChild(bookCover);
                
                // Load the actual cover image
                loadBookCoverImage(bookCover, filename, title);
            }
            
            console.log(`Loaded ${Object.keys(data.books).length} books in gallery`);
        } else {
            booksGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">No books found in the pdfs folder.</div>';
        }
    } catch (error) {
        console.error('Error loading books gallery:', error);
        booksGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #e74c3c;">Failed to load books gallery.</div>';
    }
}

async function loadBookFromGallery(filename, title) {
    console.log(`Loading book from gallery: ${filename}`);
    
    // Show loading state on the clicked book cover
    const bookCover = document.querySelector(`[data-book="${filename}"]`);
    if (bookCover) {
        bookCover.classList.add('loading');
    }
    
    try {
        // Hide gallery and show PDF section
        const pdfSection = document.getElementById('pdf-section');
        const gallerySection = document.getElementById('books-gallery');
        
        if (gallerySection) gallerySection.style.display = 'none';
        if (pdfSection) pdfSection.style.display = 'block';
        
        // Load the selected book
        await loadPDF(filename, title);
        
    } catch (error) {
        console.error('Error loading book:', error);
        showStatus('Failed to load book: ' + error.message, 'error');
        
        // Remove loading state
        if (bookCover) {
            bookCover.classList.remove('loading');
        }
    }
}

async function showBookCover(bookFilename) {
    try {
        const response = await fetch(`/get_book_cover/${bookFilename}`);
        const data = await response.json();
        
        if (data.success) {
            pdfImage.src = data.image_url;
            pdfImage.style.display = 'block';
            loadingMessage.style.display = 'none';
            
            // Update UI to show this is just a cover
            pageInfo.textContent = `Cover: ${data.book_title}`;
            
            // Disable navigation buttons since this is just a cover
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            translatePageBtn.disabled = true;
            
            console.log(`Showing cover for: ${data.book_title}`);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading book cover:', error);
        showStatus('Failed to load book cover: ' + error.message, 'error');
    }
}

async function loadAvailableBooks() {
    try {
        const response = await fetch('/get_books');
        const data = await response.json();
        
        if (data.success) {
            console.log('Available books loaded:', Object.keys(data.books));
            // Note: We use gallery view now, no book selector dropdown
        }
    } catch (error) {
        console.error('Error loading available books:', error);
    }
}

async function loadPDF(selectedBook = null, bookTitle = null) {
    console.log('Loading PDF...');
    const bookToLoad = selectedBook || 'default';
    console.log('Selected book:', bookToLoad);
    showStatus('Loading PDF...', 'info');
    try {
        const response = await fetch('/load_pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdf_filename: bookToLoad })
        });
        let data;
        const raw = await response.text();
        try { data = JSON.parse(raw); } catch (e) {
            console.error('Non-JSON response from /load_pdf:', raw);
            throw new Error('Server returned invalid JSON');
        }
        console.log('DEBUG: Response from server:', data);
        if (response.ok && data.success) {
            totalPages = data.total_pages;
            showStatus(`${bookTitle || data.book_title} loaded successfully: ${totalPages} pages`, 'success');
            await loadPage(1);
            updateUI();
            translatePageBtn.disabled = false;
        } else {
            const msg = data && data.message ? data.message : 'Failed to load PDF';
            showStatus(msg, 'error');
            throw new Error(msg);
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        showStatus(`Failed to load PDF: ${error.message}`, 'error');
    }
}

async function ensureVisionIndexForPage(pageNum) {
    const res = await fetch(`/vision_index/${pageNum}`);
    const data = await res.json();
    if (!data.success) {
        console.warn('Vision index init failed:', data.message);
    } else {
        console.log(`Vision index ready for page ${pageNum}, tokens: ${data.token_count}`);
    }
}

async function loadPageTranslation(pageNum) {
    try {
        showDefinitionPanel();
        panelContent.innerHTML = `
            <div class="loading-message">
                <div class="spinner"></div>
                <p>Translating page ${pageNum}...</p>
            </div>
        `;
        
        const response = await fetch(`/translate_page/${pageNum}`);
        const data = await response.json();
        
        if (data.success) {
            panelContent.innerHTML = `
                <div class="page-translation">
                    <h3 style="margin: 0 0 15px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">
                        📄 Page ${pageNum} Translation
                    </h3>
                    <div style="font-size: 15px; line-height: 1.6; color: #333; white-space: pre-line;">
                        ${data.translation}
                    </div>
                </div>
            `;
        } else {
            panelContent.innerHTML = `
                <div class="definition-item" style="border-left-color: #e74c3c; background: #fdf2f2;">
                    <div style="color: #e74c3c; font-weight: bold;">Translation Error</div>
                    <div style="color: #333; margin-top: 8px;">${data.message}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Translation error:', error);
        panelContent.innerHTML = `
            <div class="definition-item" style="border-left-color: #e74c3c; background: #fdf2f2;">
                <div style="color: #e74c3c; font-weight: bold;">Error</div>
                <div style="color: #333; margin-top: 8px;">Failed to load translation</div>
            </div>
        `;
    }
}

async function translateSelectedRegion() {
  try {
    if (!currentBook || !currentPage || !selectionBox) return;
    const imgEl = document.getElementById('pageImage');
    if (!imgEl || !imgEl.naturalWidth || !imgEl.naturalHeight) return;

    const payload = {
      box: {
        x1: Math.min(selectionBox.x1, selectionBox.x2),
        y1: Math.min(selectionBox.y1, selectionBox.y2),
        x2: Math.max(selectionBox.x1, selectionBox.x2),
        y2: Math.max(selectionBox.y1, selectionBox.y2),
      },
      image_width: imgEl.naturalWidth,
      image_height: imgEl.naturalHeight,
    };

    const res = await fetch(`/translate_region/${currentPage}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.success) {
      showTranslation(`Failed to translate selection: ${data.message || 'Unknown error'}`);
      return;
    }
    showTranslation(data.translation || '');
  } catch (err) {
    showTranslation(`Error translating selection: ${err.message || err}`);
  }
}

// Mouse handlers should already set selectionBox. Ensure they use natural coordinates.
// Removed old conflicting event handlers - using simplified selection logic below

function drawSelection() {
  // This function is no longer used - simplified selection handles its own display
}

function clearSelection() {
  selectionBox = null;
  const boxEl = document.getElementById('selectionBox');
  if (boxEl) boxEl.style.display = 'none';
}

// Hook clear on page change
if (typeof onPageChanged === 'function') {
  const prevOnPageChanged = onPageChanged;
  window.onPageChanged = (page) => {
    clearSelection();
    prevOnPageChanged(page);
  };
}

// Simple selection translation - just drag to select and auto-translate
function setupSimpleSelection() {
    const overlay = document.getElementById('selectionOverlay');
    const pageImage = document.getElementById('pdf-image'); // Use the same element that loadPage sets
    
    console.log('Setting up simple selection. Overlay:', overlay, 'PageImage:', pageImage);
    
    if (!overlay || !pageImage) {
        console.warn('Missing overlay or pageImage elements');
        return;
    }
    
    overlay.addEventListener('mousedown', (e) => {
        console.log('Mouse down - starting selection');
        isSelecting = true;
        const rect = overlay.getBoundingClientRect();
        selectionStart = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Clear previous selection
        clearSelectionBox();
        e.preventDefault();
    });
    
    overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
        const rect = overlay.getBoundingClientRect();
        const currentPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        showSelectionBox(selectionStart, currentPos);
        e.preventDefault();
    });
    
    overlay.addEventListener('mouseup', (e) => {
        if (!isSelecting) return;
        
        console.log('Mouse up - ending selection');
        isSelecting = false;
        
        const rect = overlay.getBoundingClientRect();
        const endPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        selectionBox = {
            x1: Math.min(selectionStart.x, endPos.x),
            y1: Math.min(selectionStart.y, endPos.y),
            x2: Math.max(selectionStart.x, endPos.x),
            y2: Math.max(selectionStart.y, endPos.y)
        };
        
        console.log('Selection box created:', selectionBox);
        
        // Auto-translate if selection is big enough
        const width = Math.abs(selectionBox.x2 - selectionBox.x1);
        const height = Math.abs(selectionBox.y2 - selectionBox.y1);
        
        console.log('Selection size:', width, 'x', height);
        
        if (width > 20 && height > 20) {
            console.log('Selection big enough, translating...');
            translateSelection();
        } else {
            console.log('Selection too small, not translating');
        }
        
        e.preventDefault();
    });
}

function showSelectionBox(start, end) {
    let box = document.getElementById('selectionBox');
    if (!box) {
        box = document.createElement('div');
        box.id = 'selectionBox';
        box.style.position = 'absolute';
        box.style.border = '2px solid #007acc';
        box.style.backgroundColor = 'rgba(0, 122, 204, 0.1)';
        box.style.pointerEvents = 'none';
        box.style.zIndex = '1000';
        document.getElementById('selectionOverlay').appendChild(box);
    }
    
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
    box.style.display = 'block';
}

function clearSelectionBox() {
    const box = document.getElementById('selectionBox');
    if (box) {
        box.style.display = 'none';
    }
    selectionBox = null;
}

// Simple function to show translation in the panel
function showTranslation(translation) {
    showDefinitionPanel();
    panelContent.innerHTML = `
        <div class="selection-translation">
            <h3 style="margin: 0 0 15px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">
                📦 Selection Translation
            </h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #3498db; line-height: 1.6;">
                ${translation}
            </div>
        </div>
    `;
}

async function translateSelection() {
    if (!selectionBox) return;
    
    try {
        showTranslation('Translating selection...');
        
        const pageImage = document.getElementById('pdf-image'); // Use the same element that loadPage sets
        if (!pageImage) return;
        
        // Create canvas to crop the selection
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate scaling from display to natural image size
        const scaleX = pageImage.naturalWidth / pageImage.clientWidth;
        const scaleY = pageImage.naturalHeight / pageImage.clientHeight;
        
        const cropX = selectionBox.x1 * scaleX;
        const cropY = selectionBox.y1 * scaleY;
        const cropWidth = (selectionBox.x2 - selectionBox.x1) * scaleX;
        const cropHeight = (selectionBox.y2 - selectionBox.y1) * scaleY;
        
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        
        // Draw the cropped portion
        ctx.drawImage(pageImage, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        
        // Convert to base64
        const croppedImage = canvas.toDataURL('image/png');
        
        // Send to backend
        const response = await fetch('/translate_selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ croppedImage })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showTranslation(result.translation || 'No translation received');
        } else {
            showTranslation('Translation failed: ' + (result.message || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Translation error:', error);
        showTranslation('Error: ' + error.message);
    }
}

// Add to initialization
document.addEventListener('DOMContentLoaded', () => {
    setupSimpleSelection();
});

async function handleImageClick(event) {
    // Don't handle click if we were selecting
    if (isSelecting) return;
    
    const rect = pdfImage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert coordinates relative to image
    const scaleX = pdfImage.naturalWidth / pdfImage.width;
    const scaleY = pdfImage.naturalHeight / pdfImage.height;
    
    const realX = Math.round(x * scaleX);
    const realY = Math.round(y * scaleY);
    
    console.log(`Image clicked at: (${x}, ${y}) -> scaled: (${realX}, ${realY})`);
    console.log(`Image dimensions: display=${pdfImage.width}x${pdfImage.height}, natural=${pdfImage.naturalWidth}x${pdfImage.naturalHeight}`);
    
    // Ensure vision index exists for this page
    await ensureVisionIndexForPage(currentPage);
    
    // Analyze the click
    await analyzeClick(realX, realY);
}

async function loadPage(pageNum) {
    if (isLoading || pageNum < 1 || pageNum > totalPages) return;
    
    isLoading = true;
    loadingMessage.style.display = 'block';
    pdfImage.style.display = 'none';
    
    try {
        console.log(`Loading page ${pageNum}...`);
        
        // Add cache-busting parameter with current book
        const currentBookParam = currentBook || 'default';
        const response = await fetch(`/get_page/${pageNum}?book=${encodeURIComponent(currentBookParam)}&t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            currentPage = pageNum;
            
            // Create new image to load
            const newImage = new Image();
            newImage.onload = function() {
                pdfImage.src = data.image_url;
                pdfImage.style.display = 'block';
                loadingMessage.style.display = 'none';
                isLoading = false;
                
                console.log(`Page ${pageNum} loaded successfully`);
                updateUI();
            };
            
            newImage.onerror = function() {
                throw new Error('Failed to load page image');
            };
            
            newImage.src = data.image_url;
            
        } else {
            throw new Error(data.message);
        }
        
    } catch (error) {
        console.error(`Error loading page ${pageNum}:`, error);
        showStatus('Failed to load page: ' + error.message, 'error');
        isLoading = false;
        loadingMessage.style.display = 'none';
    }
}

async function ensureVisionIndexForPage(pageNum) {
    const res = await fetch(`/vision_index/${pageNum}`);
    const data = await res.json();
    if (!data.success) {
        console.warn('Vision index init failed:', data.message);
    } else {
        console.log(`Vision index ready for page ${pageNum}, tokens: ${data.token_count}`);
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
    event.preventDefault();

    // Add debugging for page mismatch
    console.log('🔍 Click Debug Info:');
    console.log('- Frontend currentPage:', currentPage);
    console.log('- Page display shows:', pageInfo.textContent);

    const rect = pdfImage.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const scaleX = pdfImage.naturalWidth / rect.width;
    const scaleY = pdfImage.naturalHeight / rect.height;
    const imageX = Math.round(clickX * scaleX);
    const imageY = Math.round(clickY * scaleY);

    showStatus('Looking up word...', 'info', 1200);

    console.log('- Sending to backend: page_num =', currentPage);

    try {
        const response = await fetch('/lookup_click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page_num: currentPage, x: imageX, y: imageY })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success) {
            showDefinitionError(data.message || 'Lookup failed');
            return;
        }
        // Remove existing highlight boxes
        document.querySelectorAll('.word-highlight').forEach(el => el.remove());

        // Map bbox (image px) to display px and draw
        const left = Math.round(data.bbox.left / scaleX);
        const top = Math.round(data.bbox.top / scaleY);
        const width = Math.round(data.bbox.width / scaleX);
        const height = Math.round(data.bbox.height / scaleY);
        showWordHighlightRect(left, top, width, height);

        // Build word info for panel
        const info = parseAnalysisToWordInfo(data.analysis);
        if (!info.arabic_text) info.arabic_text = data.arabic_text;
        displaySimpleDefinition(info);
    } catch (err) {
        console.error('Lookup error:', err);
        showDefinitionError('Lookup error: ' + err.message);
    }
}

// Draw a highlight by top-left + size (exact rectangle)
function showWordHighlightRect(left, top, width, height) {
    const container = document.querySelector('.pdf-container');
    const highlight = document.createElement('div');
    highlight.className = 'word-highlight';
    highlight.style.cssText = `
        position: absolute;
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        height: ${height}px;
        background: rgba(255, 255, 0, 0.25);
        border: 2px solid rgba(255, 215, 0, 0.9);
        border-radius: 8px;
        z-index: 1200;
        pointer-events: auto;
        cursor: pointer;
        animation: pulse 1s ease-in-out;
    `;
    highlight.title = 'Click to remove';
    highlight.addEventListener('click', (e) => { e.stopPropagation(); highlight.remove(); });
    container.style.position = 'relative';
    container.appendChild(highlight);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
    
    console.log(`UpdateUI: currentPage=${currentPage}, totalPages=${totalPages}, prevBtn.disabled=${prevBtn.disabled}, nextBtn.disabled=${nextBtn.disabled}`);
    
    // Update page input
    pageInput.value = currentPage;
    pageInput.max = totalPages;
}

function showDefinitionPanel() {
    definitionPanel.classList.remove('hidden');
}

function hideDefinitionPanel() {
    definitionPanel.classList.add('hidden');
}

function showDefinitionError(message) {
    showDefinitionPanel();
    panelContent.innerHTML = `
        <div class="definition-item" style="border-left-color: #e74c3c; background: #fdf2f2;">
            <div style="color: #e74c3c; font-weight: bold;">Error</div>
            <div style="color: #333; margin-top: 8px;">${message}</div>
        </div>
    `;
}

function parseAnalysisToWordInfo(analysisText) {
    const clean = (s) => (s || '').replace(/\*\*/g, '').trim();
    const info = { arabic_text: '', english_meaning: '', confidence: undefined };
    if (!analysisText) return info;
    
    // Allow qualifiers inside parentheses before colon
    const arabicMatch = analysisText.match(/Arabic\s*Word\s*:\s*(.+)/i) || analysisText.match(/\bWord\s*:\s*(.+)/i);
    const meaningMatch = analysisText.match(/Meaning(?:[^:]*)\s*:\s*(.+)/i) || analysisText.match(/English\s*Meaning\s*:\s*(.+)/i);
    const confMatch = analysisText.match(/Confidence\s*:\s*(.+)/i);
    
    if (arabicMatch) info.arabic_text = clean(arabicMatch[1]);
    if (meaningMatch) info.english_meaning = clean(meaningMatch[1]);
    if (confMatch) info.confidence = clean(confMatch[1]);
    
    // Fallback: if parsing failed, show the full analysis as meaning
    if (!info.arabic_text && !info.english_meaning) {
        info.english_meaning = clean(analysisText);
    }
    return info;
}

function displaySimpleDefinition(wordInfo) {
    // Ensure the side panel is visible
    showDefinitionPanel();
    
    // Build simple, clear content for right panel
    let content = '<div class="word-definition">';
    if (wordInfo.arabic_text) {
        content += `
        <div class="definition-item" style="direction: rtl; text-align: right;">
            <div style="font-size: 22px; color: #2c3e50;">${wordInfo.arabic_text}</div>
        </div>`;
    }
    if (wordInfo.english_meaning) {
        content += `
        <div class="definition-item">
            <div style="font-size: 16px; line-height: 1.5;">${wordInfo.english_meaning}</div>
        </div>`;
    }
    if (wordInfo.confidence) {
        content += `<div class="definition-item" style="font-size: 12px; color: #7f8c8d;">Confidence: ${wordInfo.confidence}</div>`;
    }
    content += '</div>';
    
    panelContent.innerHTML = content;
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
