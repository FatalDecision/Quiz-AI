from PIL import Image
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
svg_path = os.path.join(script_dir, '..', 'public', 'icon.svg')

# Convert SVG to PNG using ImageMagick
try:
    # 192x192
    os.system(f'magick convert {svg_path} -resize 192x192 {os.path.join(script_dir, "../public/icon-192.png")}')
    
    # 512x512
    os.system(f'magick convert {svg_path} -resize 512x512 {os.path.join(script_dir, "../public/icon-512.png")}')
    
    print("Icons generated successfully!")
except Exception as e:
    print(f"Error: {e}") 