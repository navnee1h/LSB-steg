from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import io
from PIL import Image

app = Flask(__name__)
CORS(app)

DELIMITER = "#####"

def embed_lsb(image, secret_text):
    """Embeds secret text into the BLUE channel LSB of the image."""
    img = image.convert("RGB")
    pixels = img.load()

    full_text = secret_text + DELIMITER
    binary_text = ''.join(format(ord(char), '08b') for char in full_text)

    data_index = 0
    width, height = img.size

    if len(binary_text) > width * height:
        raise ValueError("Text is too long for this image.")

    for y in range(height):
        for x in range(width):
            if data_index < len(binary_text):
                r, g, b = pixels[x, y]

                # Modify the LSB of the BLUE channel
                new_b = (b & 0xFE) | int(binary_text[data_index])

                pixels[x, y] = (r, g, new_b)
                data_index += 1
            else:
                break
        if data_index >= len(binary_text):
            break

    return img

def extract_lsb(image):
    """Extracts hidden text from the BLUE channel LSB of the image."""
    img = image.convert("RGB")
    pixels = img.load()

    binary_data = ""
    width, height = img.size

    for y in range(height):
        for x in range(width):
            _, _, b = pixels[x, y]
            binary_data += str(b & 1)

    # Convert binary data to text and search for delimiter
    all_bytes = [binary_data[i:i+8] for i in range(0, len(binary_data), 8)]

    decoded_text = ""
    for byte in all_bytes:
        try:
            char = chr(int(byte, 2))
            decoded_text += char
            if decoded_text.endswith(DELIMITER):
                return decoded_text[:-len(DELIMITER)]
        except:
            continue

    return None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "PixelProof Backend"})

@app.route('/api/embed', methods=['POST'])
def embed():
    if 'image' not in request.files or 'text' not in request.form:
        return jsonify({"error": "Missing image or text"}), 400

    image_file = request.files['image']
    text = request.form['text']

    if not text:
        return jsonify({"error": "Text cannot be empty"}), 400

    try:
        img = Image.open(image_file)
        result_img = embed_lsb(img, text)

        img_io = io.BytesIO()
        result_img.save(img_io, 'PNG')
        img_io.seek(0)

        return send_file(
            img_io,
            mimetype='image/png',
            as_attachment=True,
            download_name='secure_image.png'
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/extract', methods=['POST'])
def extract():
    if 'image' not in request.files:
        return jsonify({"error": "Missing image"}), 400

    image_file = request.files['image']

    try:
        img = Image.open(image_file)
        hidden_text = extract_lsb(img)

        if hidden_text:
            return jsonify({"found": True, "text": hidden_text})
        else:
            return jsonify({"found": False, "message": "No watermark found or image corrupted."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

