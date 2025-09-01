"""
Qasas ul-Anbiya - Interactive Arabic Reader
Flask application with AI-powered word recognition using OpenAI GPT-4 Vision
"""

from flask import Flask, render_template, request, jsonify
import os
import base64
import json
from pdf2image import convert_from_path
from PIL import Image
import io
import openai
from dotenv import load_dotenv
from typing import Dict, Any, List, Optional

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# OpenAI configuration
openai.api_key = os.getenv('OPENAI_API_KEY')

# Global variables for PDF handling
current_pdf = None
current_book_name = None
total_pages = 0

# Available books
def get_available_books():
    """Auto-discover PDF files in the pdfs directory"""
    import glob
    
    pdfs_dir = os.path.join(app.static_folder, 'pdfs')
    pdf_files = glob.glob(os.path.join(pdfs_dir, '*.pdf'))
    
    available_books = {}
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        # Use filename without extension as the title
        title = os.path.splitext(filename)[0].replace('-', ' ').replace('_', ' ')
        # Capitalize words for better display
        title = ' '.join(word.capitalize() for word in title.split())
        
        # Return simple filename -> title mapping
        available_books[filename] = title
    
    return available_books

# Vision cache: page_num -> { 'tokens': [...], 'lines': [...], 'image_size': (W,H) }
vision_cache: Dict[int, Dict[str, Any]] = {}

class PDFProcessor:
    def __init__(self):
        self.pdf_path = None
        self.total_pages = 0
        self.page_images_cache = {}
    
    def load_pdf(self, pdf_path):
        """Load PDF file using pdf2image"""
        try:
            # Get page count efficiently using pdfinfo (part of poppler)
            import subprocess
            try:
                result = subprocess.run(['pdfinfo', pdf_path], 
                                      capture_output=True, text=True, check=True)
                for line in result.stdout.split('\n'):
                    if line.startswith('Pages:'):
                        self.total_pages = int(line.split()[1])
                        break
                
                if self.total_pages > 0:
                    self.pdf_path = pdf_path
                    # Clear page cache when loading new PDF
                    self.page_images_cache.clear()
                    return self.total_pages
            except:
                # Fallback: convert just first page to validate PDF
                images = convert_from_path(pdf_path, first_page=1, last_page=1)
                if images:
                    # Try PyPDF2 for page count
                    try:
                        import PyPDF2
                        with open(pdf_path, 'rb') as file:
                            pdf_reader = PyPDF2.PdfReader(file)
                            self.total_pages = len(pdf_reader.pages)
                    except:
                        # Last resort: slower method
                        print("Warning: Using slow page counting method")
                        all_images = convert_from_path(pdf_path)
                        self.total_pages = len(all_images)
                    
                    if self.total_pages > 0:
                        self.pdf_path = pdf_path
                        # Clear page cache when loading new PDF
                        self.page_images_cache.clear()
                        return self.total_pages
            return 0
        except Exception as e:
            print(f"Error loading PDF: {e}")
            return 0
    
    def get_page_image(self, page_num, dpi=200):
        """Convert PDF page to image using pdf2image"""
        try:
            if not self.pdf_path:
                return None
            
            # Check cache first
            cache_key = f"{page_num}_{dpi}"
            if cache_key in self.page_images_cache:
                return self.page_images_cache[cache_key]
            
            # Convert specific page
            images = convert_from_path(
                self.pdf_path, 
                first_page=page_num, 
                last_page=page_num,
                dpi=dpi
            )
            
            if images:
                img = images[0]
                # Cache the image (limit cache size)
                if len(self.page_images_cache) > 5:
                    # Remove oldest entry
                    oldest_key = next(iter(self.page_images_cache))
                    del self.page_images_cache[oldest_key]
                
                self.page_images_cache[cache_key] = img
                return img
            
            return None
        except Exception as e:
            print(f"Error converting page to image: {e}")
            return None
    
    def get_page_image_base64(self, page_num, dpi=200):
        """Get page as base64 encoded image"""
        img = self.get_page_image(page_num, dpi)
        if img:
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            return f"data:image/png;base64,{img_base64}"
        return None

class VisionIndexer:
    def __init__(self, client):
        self.client = client
    
    def index_page(self, image_base64: str, width: int, height: int) -> Dict[str, Any]:
        """Ask OpenAI Vision to return JSON with tokens and lines and their bounding boxes in image pixels."""
        system_prompt = (
            "You are an OCR and layout engine for Arabic text. Given an image of a page, "
            "extract words (tokens) with precise bounding boxes in pixels relative to the provided image size. "
            "Also group tokens into lines and provide each line's full text and bbox. Output strict JSON with this schema:\n\n"
            "{\n  \"image_width\": <number>,\n  \"image_height\": <number>,\n  \"lines\": [ { \"id\": \"L1\", \"text\": \"...\", \"bbox\": {\"left\": n, \"top\": n, \"width\": n, \"height\": n} } ],\n  \"tokens\": [ { \"text\": \"...\", \"line_id\": \"L1\", \"bbox\": {\"left\": n, \"top\": n, \"width\": n, \"height\": n} } ]\n}\n\n"
            "Use pixel integers. Ensure bboxes tightly bound the text. Do not include any fields other than those specified."
        )
        user_text = (
            f"Image size: {width}x{height} pixels. Return only valid JSON matching the schema."
        )
        resp = self.client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": image_base64, "detail": "high"}}
                ]},
            ],
            temperature=0.0,
            max_tokens=8000,
        )
        content = resp.choices[0].message.content
        try:
            data = json.loads(content)
        except Exception as e:
            raise ValueError(f"Failed to parse JSON from vision response: {e}\nRaw: {content[:500]}")
        # Basic validation
        if 'tokens' not in data or 'lines' not in data:
            raise ValueError("Vision response missing tokens/lines")
        return data

class AIAnalyzer:
    def __init__(self):
        self.client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    def translate_full_page(self, image_base64: str) -> str:
        """Translate the entire page content from Arabic to English"""
        system_prompt = (
            "You are an expert Arabic-to-English translator. Given an image of an Arabic text page, "
            "provide a complete and accurate English translation of all the text on the page. "
            "Maintain the meaning and flow while making it readable in English. "
            "If there are titles, headers, or different sections, preserve that structure in your translation."
        )
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Please translate all Arabic text in this image to English."},
                        {"type": "image_url", "image_url": {"url": image_base64, "detail": "high"}}
                    ]},
                ],
                max_tokens=4000,
                temperature=0.1,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error with page translation: {e}")
            raise e

    def analyze_context_meaning(self, context_line: str, target_word: str) -> str:
        """Ask OpenAI for the English meaning of target_word in the given Arabic context."""
        system_prompt = (
            "You are an Arabic lexicon assistant. Given an Arabic sentence and a target word, "
            "provide the most likely English meaning (gloss) of the target word IN THIS CONTEXT. "
            "Keep it concise. If the context suggests a different sense than the dictionary base form, choose the contextual sense.\n\n"
            "Return in this exact format:\n"
            "**Arabic Word:** ...\n"
            "**Meaning (in context):** ...\n"
        )
        user_text = (
            f"Sentence (Arabic): {context_line}\n"
            f"Target word: {target_word}\n"
            f"Answer with the format above."
        )
        resp = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
            max_tokens=120,
            temperature=0.2,
        )
        return resp.choices[0].message.content

    def translate_region(self, image_base64: str) -> str:
        """Translate only the Arabic text present in the provided cropped image to English."""
        system_prompt = (
            "You are an expert Arabic-to-English translator. Given an image that contains a cropped section "
            "from a page, translate only the Arabic text visible in this image into clear English."
        )
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Translate the Arabic text in this selection to English only."},
                        {"type": "image_url", "image_url": {"url": image_base64, "detail": "high"}}
                    ]},
                ],
                max_tokens=1200,
                temperature=0.1,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error with region translation: {e}")
            raise e

# Translation cache: page_num -> translated_text
translation_cache: Dict[int, str] = {}

# Initialize processors
pdf_processor = PDFProcessor()
ai_analyzer = AIAnalyzer()
vision_indexer = VisionIndexer(ai_analyzer.client)

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/load_pdf', methods=['GET', 'POST'])
def load_pdf():
    """Load a PDF file"""
    global current_pdf, current_book_name, total_pages
    try:
        if request.method == 'POST':
            data = request.get_json(silent=True) or {}
            pdf_filename = data.get('pdf_filename', '')
        else:
            pdf_filename = ''

        available_books = get_available_books()

        if not pdf_filename:
            return jsonify({
                'success': True,
                'message': 'No book selected. Please choose a book to load.',
                'books_available': list(available_books.keys())
            })

        if pdf_filename not in available_books:
            return jsonify({
                'success': False,
                'message': f'Invalid book selection: {pdf_filename}',
                'books_available': list(available_books.keys())
            })

        book_title = available_books[pdf_filename]
        pdf_path = os.path.join(app.static_folder, 'pdfs', pdf_filename)
        if os.path.exists(pdf_path):
            pages = pdf_processor.load_pdf(pdf_path)
            if pages > 0:
                total_pages = pages
                current_pdf = pdf_path
                current_book_name = book_title
                vision_cache.clear()
                translation_cache.clear()
                return jsonify({
                    'success': True,
                    'total_pages': total_pages,
                    'book_title': current_book_name,
                    'filename': pdf_filename,
                    'message': f'{current_book_name} loaded successfully with {total_pages} pages'
                })
            else:
                return jsonify({'success': False, 'message': f'Failed to load PDF file: {pdf_filename}'})
        else:
            return jsonify({'success': False, 'message': f'PDF not found on disk: {pdf_filename}'})
    except Exception as e:
        print(f"ERROR in load_pdf: {e}")
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': f'Exception loading PDF: {str(e)}'})

@app.route('/get_books')
def get_books():
    """Get list of available books"""
    try:
        available_books = get_available_books()
        return jsonify({
            'success': True,
            'books': available_books
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error loading books: {str(e)}'})

@app.route('/get_book_cover/<book_filename>')
def get_book_cover(book_filename):
    """Get the first page (cover) of a book as preview"""
    try:
        available_books = get_available_books()
        if book_filename not in available_books:
            return jsonify({'success': False, 'message': 'Book not found'})
        pdf_path = os.path.join(app.static_folder, 'pdfs', book_filename)
        if not os.path.exists(pdf_path):
            return jsonify({'success': False, 'message': 'PDF file not found'})

        # Create temporary processor to get first page
        temp_processor = PDFProcessor()
        pages_loaded = temp_processor.load_pdf(pdf_path)
        if pages_loaded == 0:
            return jsonify({'success': False, 'message': 'Failed to load PDF'})

        # Try multiple DPIs for reliability
        for dpi in (150, 120, 100):
            image_base64 = temp_processor.get_page_image_base64(1, dpi=dpi)
            if image_base64:
                return jsonify({
                    'success': True,
                    'image_url': image_base64,
                    'book_title': available_books[book_filename],
                    'filename': book_filename
                })
        return jsonify({'success': False, 'message': 'Failed to generate cover image'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

@app.route('/get_page/<int:page_num>')
def get_page(page_num):
    """Get specific page as image"""
    book_param = request.args.get('book', '')
    timestamp = request.args.get('t', '')
    if not current_pdf or page_num < 1 or page_num > total_pages:
        return jsonify({'success': False, 'message': 'Invalid page number'})
    try:
        # Try a few DPIs to improve reliability/performance
        image_base64 = None
        for dpi in (180, 150, 120):
            image_base64 = pdf_processor.get_page_image_base64(page_num, dpi=dpi)
            if image_base64:
                break
        if image_base64:
            response = jsonify({
                'success': True,
                'image_url': image_base64,
                'page_num': page_num,
                'total_pages': total_pages,
                'book_name': current_book_name,
                'timestamp': timestamp
            })
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        else:
            return jsonify({'success': False, 'message': 'Failed to generate page image'})
    except Exception as e:
        print(f"ERROR in get_page({page_num}): {e}")
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

@app.route('/vision_index/<int:page_num>')
def vision_index(page_num: int):
    """Index a PDF page using OpenAI Vision"""
    if not current_pdf or page_num < 1 or page_num > total_pages:
        return jsonify({'success': False, 'message': 'Invalid page number'})
    try:
        img = pdf_processor.get_page_image(page_num)
        if img is None:
            return jsonify({'success': False, 'message': 'Failed to load page image'})
        W, H = img.size
        # Use the same base64 image sent to client to align pixels
        image_base64 = pdf_processor.get_page_image_base64(page_num)
        data = vision_indexer.index_page(image_base64, W, H)
        # Cache
        vision_cache[page_num] = {**data, 'image_size': (W, H)}
        return jsonify({'success': True, 'page_num': page_num, 'token_count': len(data.get('tokens', []))})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Vision index failed: {str(e)}'})

@app.route('/translate_page/<int:page_num>')
def translate_page(page_num: int):
    """Get English translation of the entire page"""
    if not current_pdf or page_num < 1 or page_num > total_pages:
        return jsonify({'success': False, 'message': 'Invalid page number'})
    
    try:
        # Check cache first
        if page_num in translation_cache:
            return jsonify({
                'success': True, 
                'page_num': page_num, 
                'translation': translation_cache[page_num]
            })
        
        # Get page image
        image_base64 = pdf_processor.get_page_image_base64(page_num)
        if not image_base64:
            return jsonify({'success': False, 'message': 'Failed to load page image'})
        
        # Translate the page
        translation = ai_analyzer.translate_full_page(image_base64)
        
        # Cache the translation
        translation_cache[page_num] = translation
        
        return jsonify({
            'success': True,
            'page_num': page_num,
            'translation': translation
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Translation failed: {str(e)}'})

@app.route('/lookup_click', methods=['POST'])
def lookup_click():
    """Lookup Arabic word at clicked position and provide contextual meaning"""
    try:
        data = request.get_json()
        page_num = int(data.get('page_num'))
        x = int(data.get('x'))
        y = int(data.get('y'))
        
        # Add backend debugging
        print(f"🔍 Backend Debug - Received: page_num={page_num}, x={x}, y={y}")
        print(f"🔍 Vision cache keys: {list(vision_cache.keys())}")
        
        if not (1 <= page_num <= total_pages):
            return jsonify({'success': False, 'message': 'Invalid page number'})
        # Ensure vision cache
        if page_num not in vision_cache:
            print(f"🔍 Indexing page {page_num} (not in cache)")
            # Build on-demand
            img = pdf_processor.get_page_image(page_num)
            if img is None:
                return jsonify({'success': False, 'message': 'Failed to load page image'})
            W, H = img.size
            image_base64 = pdf_processor.get_page_image_base64(page_num)
            try:
                data_idx = vision_indexer.index_page(image_base64, W, H)
                vision_cache[page_num] = {**data_idx, 'image_size': (W, H)}
                print(f"🔍 Successfully indexed page {page_num}, tokens: {len(data_idx.get('tokens', []))}")
            except Exception as e:
                return jsonify({'success': False, 'message': f'Indexing failed: {str(e)}'})
        else:
            print(f"🔍 Using cached data for page {page_num}")
            
        idx = vision_cache[page_num]
        tokens = idx.get('tokens', [])
        lines = idx.get('lines', [])
        print(f"🔍 Page {page_num} has {len(tokens)} tokens, searching for click at ({x}, {y})")
        
        # Find token at (x,y)
        def contains(b, px, py):
            return (px >= b.get('bbox', {}).get('left', 0) and
                    px <= b.get('bbox', {}).get('left', 0) + b.get('bbox', {}).get('width', 0) and
                    py >= b.get('bbox', {}).get('top', 0) and
                    py <= b.get('bbox', {}).get('top', 0) + b.get('bbox', {}).get('height', 0))
        target = None
        for t in tokens:
            if contains(t, x, y):
                target = t
                break
        if target is None:
            # nearest by center
            best_d = 1e18
            for t in tokens:
                b = t.get('bbox', {})
                cx = b.get('left', 0) + b.get('width', 0) / 2
                cy = b.get('top', 0) + b.get('height', 0) / 2
                d = (cx - x) ** 2 + (cy - y) ** 2
                if d < best_d:
                    best_d = d
                    target = t
        if target is None:
            return jsonify({'success': False, 'message': 'No token found at click'})
        # Find line text
        line_id = target.get('line_id')
        context_line = ''
        if line_id:
            for ln in lines:
                if ln.get('id') == line_id:
                    context_line = ln.get('text', '')
                    break
        if not context_line:
            context_line = target.get('text', '')
        # Ask for contextual meaning
        analysis = ai_analyzer.analyze_context_meaning(context_line, target.get('text', ''))
        return jsonify({
            'success': True,
            'arabic_text': target.get('text', ''),
            'bbox': target.get('bbox', {}),
            'context_line': context_line,
            'analysis': analysis
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'})

@app.route('/translate_selection', methods=['POST'])
def translate_selection():
    """Translate a selected region - just crop and send to AI."""
    try:
        data = request.get_json()
        
        # Get the cropped image as base64 from frontend
        cropped_image = data.get('croppedImage')
        if not cropped_image:
            return jsonify({'success': False, 'message': 'No cropped image provided'})
        
        # Send directly to AI for translation
        translation = ai_analyzer.translate_region(cropped_image)
        
        return jsonify({'success': True, 'translation': translation})
        
    except Exception as e:
        print(f"Translation error: {e}")
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

@app.route('/test_api')
def test_api():
    """Test OpenAI API connection"""
    try:
        # Simple test to verify API key works
        response = ai_analyzer.client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say 'API test successful'"}],
            max_tokens=10
        )
        
        return jsonify({
            'success': True,
            'message': 'OpenAI API connection successful',
            'response': response.choices[0].message.content
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'API test failed: {str(e)}'
        })

@app.errorhandler(413)
def too_large(e):
    return jsonify({'success': False, 'message': 'File too large'}), 413

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500

if __name__ == '__main__':
    # Ensure required environment variables are set
    if not os.getenv('OPENAI_API_KEY'):
        print("Warning: OPENAI_API_KEY not found in environment variables")
    
    app.run(debug=True, host='0.0.0.0', port=5001)
