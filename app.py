from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import requests
from werkzeug.utils import secure_filename
import tempfile

# If you’ve already created these in backend/utils/, keep them;
# otherwise you need to have these files in your repo as shown earlier.
from utils.ocr_processor import process_image_ocr
from utils.data_aggregator import PlayerDataAggregator

# Tell Flask to look in the project root for index.html
app = Flask(__name__, template_folder='.')
# Enable CORS on every route
CORS(app)

# 16 MB max file size
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['UPLOAD_FOLDER']    = tempfile.gettempdir()

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
def allowed_file(filename):
    return (
        '.' in filename and
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    )

@app.route('/')
def index():
    # Will find the index.html at your repo root
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process_images():
    if 'images' not in request.files:
        return jsonify({'error': 'No images provided'}), 400

    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No images selected'}), 400

    aggregator = PlayerDataAggregator()
    processed_images = []

    for i, file in enumerate(files):
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            path = os.path.join(app.config['UPLOAD_FOLDER'], f'temp_{i}_{filename}')
            file.save(path)

            try:
                players_data = process_image_ocr(path)
                aggregator.add_image_data(filename, players_data)
                processed_images.append({
                    'filename': filename,
                    'players': players_data,
                    'player_count': len(players_data)
                })
            except Exception as e:
                processed_images.append({
                    'filename': filename,
                    'error': str(e),
                    'players': [],
                    'player_count': 0
                })
            finally:
                if os.path.exists(path):
                    os.remove(path)

    result = aggregator.get_aggregated_data()
    return jsonify({
        'success': True,
        'processed_images':    processed_images,
        'aggregated_players':  result['players'],
        'statistics':          result['statistics'],
        'total_images':        len(processed_images),
        'unique_players':      result['statistics']['unique_players']
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    # Local debug only
    app.run(debug=True, port=5000)
