"""
Qasas ul-Anbiya - Interactive Arabic Reader
Flask application with AI-powered word recognition using OpenAI GPT-4 Vision
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import base64
import json
from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
from PIL import Image
import io
import openai
from dotenv import load_dotenv

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

class AIAnalyzer:
    def __init__(self):
        self.client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    def analyze_word_at_coordinates(self, image_base64, x, y):
        """Use GPT-4 Vision to identify Arabic word at given coordinates"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Updated to use current GPT-4 with vision
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert in Arabic language. You will be given an image of an Arabic text page and coordinates where a user clicked. Your tasks:

1. Identify the Arabic word at or near those coordinates
2. Provide comprehensive explanation including:
   - Primary meaning
   - Linguistic root if possible
   - Usage examples
   - Additional grammatical information

Make your response clear and helpful for learners. Start with the identified word, then follow with the explanation."""
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Please identify the Arabic word at coordinates ({x}, {y}) in this image. If there's no word at that exact point, find the closest Arabic word."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_base64,
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=800,
                temperature=0.3
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Error with AI analysis: {e}")
            raise e

# Initialize processors
pdf_processor = PDFProcessor()
ai_analyzer = AIAnalyzer()

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
                'image': image_base64,
                'page_num': page_num,
                'total_pages': total_pages
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to generate page image'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

@app.route('/analyze_word', methods=['POST'])
def analyze_word():
    """Analyze word at given coordinates using AI"""
    try:
        data = request.get_json()
        page_num = data.get('page_num')
        x = data.get('x')
        y = data.get('y')
        
        if not all([page_num, x is not None, y is not None]):
            return jsonify({'success': False, 'message': 'Missing required parameters'})
        
        # Get page image
        image_base64 = pdf_processor.get_page_image_base64(page_num)
        if not image_base64:
            return jsonify({'success': False, 'message': 'Failed to get page image'})
        
        # Analyze with AI
        try:
            analysis = ai_analyzer.analyze_word_at_coordinates(image_base64, x, y)
            return jsonify({
                'success': True,
                'analysis': analysis,
                'coordinates': {'x': x, 'y': y}
            })
        except Exception as ai_error:
            return jsonify({
                'success': False, 
                'message': f'AI analysis failed: {str(ai_error)}'
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
