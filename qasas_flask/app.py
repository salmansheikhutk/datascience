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
total_pages = 0

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
            # Convert first page to get total pages count
            images = convert_from_path(pdf_path, first_page=1, last_page=1)
            if images:
                # Get total pages by converting all (this is more reliable)
                all_images = convert_from_path(pdf_path)
                self.total_pages = len(all_images)
                self.pdf_path = pdf_path
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

@app.route('/load_pdf')
def load_pdf():
    """Load the default PDF file"""
    global current_pdf, total_pages
    
    pdf_path = os.path.join(app.static_folder, 'pdfs', 'Qasas-ul-Anbiya-Part-1.pdf')
    
    if os.path.exists(pdf_path):
        total_pages = pdf_processor.load_pdf(pdf_path)
        if total_pages > 0:
            current_pdf = pdf_path
            return jsonify({
                'success': True,
                'total_pages': total_pages,
                'message': f'PDF loaded successfully with {total_pages} pages'
            })
    
    return jsonify({
        'success': False,
        'message': 'Failed to load PDF file'
    })

@app.route('/get_page/<int:page_num>')
def get_page(page_num):
    """Get specific page as image"""
    if not current_pdf or page_num < 1 or page_num > total_pages:
        return jsonify({'success': False, 'message': 'Invalid page number'})
    
    try:
        image_base64 = pdf_processor.get_page_image_base64(page_num)
        if image_base64:
            return jsonify({
                'success': True,
                'image_url': image_base64,
                'page_num': page_num,
                'total_pages': total_pages
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to generate page image'})
    
    except Exception as e:
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
    
    app.run(debug=True, host='0.0.0.0', port=5000)
