# Slopstag Image Editor

## Quick Start
```bash
poetry install
python main.py
# Opens http://localhost:8080 with hot reload
```

## Architecture
- **JS-first**: Canvas/layer logic runs entirely in browser
- **Python backend**: Optional filters via FastAPI (skimage, OpenCV, PIL)
- **No local file access**: Images loaded from backend sources only
- **Modular tools**: One file per tool, registry-based extensibility
- **Raw transfer**: Uncompressed RGBA bytes for filter I/O (no Base64)

## Development
- NiceGUI hot-reloads on code changes (JS, CSS, Python)
- Port 8080, never needs restart (except adding packages)
- Use chrome-mcp for debugging

## Adding Tools (JS)
1. Create `frontend/js/tools/MyTool.js` extending Tool base class
2. Define static properties: `id`, `name`, `icon`, `shortcut`, `cursor`
3. Override mouse/keyboard handlers as needed
4. Import and register in `app.js`: `toolManager.register(MyTool)`

## Adding Filters (Python)
1. Create class extending `BaseFilter` in `slopstag/filters/`
2. Use `@register_filter("filter_id")` decorator
3. Implement `apply(image: np.ndarray, **params) -> np.ndarray`

## Adding Image Sources
1. Create provider class in `slopstag/images/`
2. Use `@register_provider("source_id")` decorator
3. Implement `list_images()` and `get_image(id)`

## File Structure Convention
- One class per file
- Tools in `frontend/js/tools/`
- Filters in `slopstag/filters/`
- UI components in `frontend/js/ui/`
- Core canvas logic in `frontend/js/core/`

## API Endpoints
- `GET /api/health` - Health check
- `GET /api/filters` - List available filters with param schemas
- `POST /api/filters/{id}` - Apply filter (raw RGBA in/out)
- `GET /api/images/sources` - List image sources
- `GET /api/images/{source}/{id}` - Get sample image as raw RGBA

## Binary Protocol (Filter I/O)
Request: `[4 bytes metadata length (LE)][JSON metadata][raw RGBA bytes]`
Response: `[raw RGBA bytes]` (same dimensions as input)

Metadata JSON: `{"width": int, "height": int, "params": {...}}`
