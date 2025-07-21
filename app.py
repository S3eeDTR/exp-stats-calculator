from flask import Flask, render_template, request, jsonify
import os
import requests
from werkzeug.utils import secure_filename
import tempfile
from utils.ocr_processor import process_image_ocr
from utils.data_aggregator import PlayerDataAggregator

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process_images():
    try:
        if 'images' not in request.files:
            return jsonify({'error': 'No images provided'}), 400
        
        files = request.files.getlist('images')
        if not files or all(file.filename == '' for file in files):
            return jsonify({'error': 'No images selected'}), 400
        
        aggregator = PlayerDataAggregator()
        processed_images = []
        
        for i, file in enumerate(files):
            if file and allowed_file(file.filename):
                # Save file temporarily
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{i}_{filename}")
                file.save(filepath)
                
                try:
                    # Process OCR
                    players_data = process_image_ocr(filepath)
                    
                    # Add to aggregator
                    aggregator.add_image_data(filename, players_data)
                    
                    processed_images.append({
                        'filename': filename,
                        'players': players_data,
                        'player_count': len(players_data)
                    })
                    
                except Exception as e:
                    print(f"Error processing {filename}: {str(e)}")
                    processed_images.append({
                        'filename': filename,
                        'error': str(e),
                        'players': [],
                        'player_count': 0
                    })
                
                finally:
                    # Clean up temporary file
                    if os.path.exists(filepath):
                        os.remove(filepath)
        
        # Get aggregated results
        aggregated_data = aggregator.get_aggregated_data()
        
        return jsonify({
            'success': True,
            'processed_images': processed_images,
            'aggregated_players': aggregated_data['players'],
            'statistics': aggregated_data['statistics'],
            'total_images': len(processed_images),
            'unique_players': aggregated_data['statistics']['unique_players']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)