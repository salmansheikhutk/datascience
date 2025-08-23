# Qasas ul-Anbiya - Interactive Arabic Reader

An interactive Arabic PDF reader with AI-powered word definitions using OpenAI GPT-4.

## Features

- **Interactive PDF Reading**: Navigate through the Arabic text with ease
- **AI-Powered Definitions**: Click on any Arabic word to get instant definitions, grammar analysis, and linguistic roots
- **Responsive Design**: Works on desktop and mobile devices
- **Arabic Interface**: Proper RTL support and Arabic typography

## Setup Instructions

### 1. Configure API Key

Create a `config.js` file in the qasas folder with your OpenAI API key:

```javascript
const CONFIG = {
    OPENAI_API_KEY: 'your-openai-api-key-here'
};
```

### 2. Run Local Server

Since browsers block local file access for security reasons, you need to run a local server:

```bash
cd qasas
python3 -m http.server 8000
```

Then open your browser and go to: `http://localhost:8000`

### 3. Alternative Server Options

If you don't have Python 3, you can use:

**Node.js:**
```bash
npx serve .
```

**PHP:**
```bash
php -S localhost:8000
```

**Live Server (VS Code extension):**
Right-click on `index.html` and select "Open with Live Server"

## Usage

1. **Navigation**: Use the Previous/Next buttons or arrow keys to navigate
2. **Zoom**: Use the zoom buttons or +/- keys to adjust text size
3. **Word Lookup**: Click on any Arabic word to see its definition
4. **Page Jump**: Enter a page number in the input field to jump directly

## Keyboard Shortcuts

- **Arrow Left**: Next page
- **Arrow Right**: Previous page
- **+ or =**: Zoom in
- **-**: Zoom out
- **Escape**: Close definition panel

## Files Structure

```
qasas/
├── index.html          # Main application file
├── styles.css          # Styling and layout
├── script.js           # Application logic
├── config.js           # API key configuration (gitignored)
├── Qasas-ul-Anbiya-Part-1.pdf  # Arabic text PDF
└── README.md           # This file
```

## Troubleshooting

### "Could not load API key" Error
- Make sure `config.js` exists with the correct format
- Verify your OpenAI API key is valid

### "Error loading PDF" Error
- Make sure you're running a local server (not opening file:// directly)
- Check that the PDF file exists in the same folder

### CORS Errors
- Always use a local server instead of opening the HTML file directly
- Make sure all files are in the same directory

## Technical Details

- **PDF.js**: For rendering PDF content in the browser
- **OpenAI GPT-4**: For Arabic language analysis and definitions
- **Vanilla JavaScript**: No external frameworks required
- **Responsive CSS**: Mobile-friendly design

## Security Note

The `config.js` file containing your API key is automatically gitignored to prevent accidental commits to version control.
