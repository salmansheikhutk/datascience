# Qasas ul-Anbiya - Flask Application

A professional Flask web application for interactive Arabic text reading with AI-powered word recognition using OpenAI GPT-4 Vision.

## 🚀 **Features**

### **AI-Powered Word Recognition**
- Click anywhere on Arabic text to get AI analysis
- GPT-4 Vision identifies words from coordinates
- Comprehensive definitions with grammar and etymology
- Context-aware Arabic language analysis

### **Professional Architecture**
- **Backend**: Flask with Python
- **PDF Processing**: pdf2image for reliable PDF to image conversion
- **AI Integration**: OpenAI GPT-4 Vision API
- **Frontend**: Clean HTML/CSS/JavaScript
- **Security**: API keys stored server-side

### **User Experience**
- Real-time page navigation
- Zoom functionality
- Responsive design
- Visual click feedback
- Status notifications

## 📁 **Project Structure**

```
qasas_flask/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env                  # Environment variables (API key)
├── venv/                 # Virtual environment
├── templates/
│   └── index.html        # Main template
├── static/
│   ├── css/
│   │   └── styles.css    # Application styling
│   ├── js/
│   │   └── app.js        # Frontend JavaScript
│   └── pdfs/
│       └── Qasas-ul-Anbiya-Part-1.pdf
└── README.md
```

## 🛠 **Installation & Setup**

### **1. Prerequisites**
```bash
# Install poppler (required for pdf2image)
brew install poppler

# Verify Python 3.8+ is installed
python3 --version
```

### **2. Environment Setup**
```bash
# Clone/navigate to project directory
cd qasas_flask

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### **3. Configuration**
Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your-openai-api-key-here
```

### **4. Run Application**
```bash
# Activate virtual environment
source venv/bin/activate

# Start Flask server
python app.py
```

Visit: `http://127.0.0.1:5000`

## 🔧 **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application page |
| `/load_pdf` | GET | Load PDF and get page count |
| `/get_page/<int:page_num>` | GET | Get specific page as image |
| `/analyze_word` | POST | AI analysis of word at coordinates |
| `/test_api` | GET | Test OpenAI API connection |

## 🤖 **AI Integration**

### **How It Works**
1. **User clicks** on Arabic text
2. **Frontend captures** click coordinates
3. **Backend converts** PDF page to high-resolution image
4. **GPT-4 Vision** analyzes image + coordinates
5. **AI identifies** closest Arabic word
6. **Comprehensive definition** returned to user

### **AI Prompt Engineering**
- Specialized Arabic language system prompt
- Coordinate-based word identification
- Context-aware linguistic analysis
- Educational formatting for learners

## 🎨 **Technical Features**

### **Backend (Flask)**
- **PDF Processing**: Converts PDF pages to images on-demand
- **Caching**: Page image caching for performance
- **Error Handling**: Comprehensive error management
- **Security**: API keys stored server-side only

### **Frontend**
- **Responsive Design**: Works on desktop and mobile
- **Visual Feedback**: Click animations and status messages
- **Smooth Navigation**: Page controls with keyboard shortcuts
- **Real-time Updates**: Live status notifications

### **Performance Optimizations**
- Image caching to reduce PDF processing
- Lazy loading of PDF pages
- Optimized image compression
- Efficient coordinate mapping

## 🔒 **Security**

- ✅ API keys stored server-side only
- ✅ Input validation on all endpoints
- ✅ CORS protection
- ✅ File size limits
- ✅ Error message sanitization

## 🚀 **Advantages Over JavaScript Version**

| Aspect | Flask (Python) | JavaScript |
|--------|---------------|------------|
| **Security** | API keys on server | API keys exposed |
| **PDF Processing** | Native Python libraries | Browser limitations |
| **AI Integration** | Server-side processing | Client-side overhead |
| **Scalability** | Easy to scale | Browser memory limits |
| **Error Handling** | Robust Python ecosystem | Limited browser APIs |
| **Debugging** | Professional debugging tools | Browser console only |

## 🎯 **Usage**

1. **Start the application** - Visit `http://127.0.0.1:5000`
2. **Test API connection** - Click "Test API" button
3. **Navigate pages** - Use Previous/Next or enter page number
4. **Click on text** - Click anywhere on Arabic text
5. **View definition** - AI analysis appears in right panel
6. **Zoom control** - Use zoom buttons or keyboard shortcuts

## ⌨️ **Keyboard Shortcuts**

- **Arrow Left**: Next page
- **Arrow Right**: Previous page  
- **+ or =**: Zoom in
- **-**: Zoom out
- **Escape**: Close definition panel

## 🐛 **Troubleshooting**

### **Common Issues**

**"PDF not loading"**
- Check PDF file exists in `static/pdfs/`
- Verify poppler installation: `which pdftoppm`

**"API test failed"**
- Verify OpenAI API key in `.env` file
- Check internet connection
- Ensure API key has sufficient credits

**"Page not rendering"**
- Check virtual environment is activated
- Verify all dependencies installed
- Check Flask debug output for errors

## 🔄 **Development**

### **Adding New Features**
1. Backend logic in `app.py`
2. Frontend updates in `static/js/app.js`
3. Styling changes in `static/css/styles.css`
4. Template modifications in `templates/index.html`

### **Testing**
```bash
# Test PDF processing
python -c "from app import pdf_processor; print(pdf_processor.load_pdf('static/pdfs/Qasas-ul-Anbiya-Part-1.pdf'))"

# Test API connection
curl http://127.0.0.1:5000/test_api
```

This Flask application provides a professional, scalable foundation for Arabic text analysis with AI integration!
