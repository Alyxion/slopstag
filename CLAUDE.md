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
- **API-first**: ALL tools and features MUST be accessible via REST API
- **Multi-document**: Multiple documents open simultaneously, each with independent history/layers
- **High-quality rendering**: Bicubic interpolation for zoom, anti-aliased brush strokes

## Development
- NiceGUI hot-reloads on code changes (JS, CSS, Python)
- Port 8080, never needs restart (except adding packages)
- Use chrome-mcp for debugging

## Adding Tools (JS)

**IMPORTANT: All tools MUST implement `executeAction(action, params)` for API access.**

1. Create `frontend/js/tools/MyTool.js` extending Tool base class
2. Define static properties: `id`, `name`, `icon`, `shortcut`, `cursor`
3. Override mouse/keyboard handlers for interactive use
4. **Implement `executeAction(action, params)` for programmatic/API use**
5. Import and register in `canvas_editor.js`

Example tool with API support:
```javascript
import { Tool } from './Tool.js';

export class MyTool extends Tool {
    static id = 'mytool';
    static name = 'My Tool';
    static icon = 'star';
    static shortcut = 't';

    // Interactive mouse handlers
    onMouseDown(e, x, y) { /* ... */ }
    onMouseUp(e, x, y) { /* ... */ }

    // API execution - REQUIRED for all tools
    executeAction(action, params) {
        if (action === 'draw') {
            // Perform the action
            return { success: true };
        }
        return { success: false, error: 'Unknown action' };
    }
}
```

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

### Core Classes (`frontend/js/core/`)
- **Document.js** - Single document with its own LayerStack, History, colors, view state
- **DocumentManager.js** - Manages multiple open documents, tab switching, close prompts
- **Layer.js** - Individual layer with canvas, opacity, blend mode
- **LayerStack.js** - Layer ordering, active layer selection, merge/flatten
- **Renderer.js** - Composites layers to display canvas with zoom/pan
- **History.js** - Undo/redo with automatic pixel diff detection
- **Clipboard.js** - Cut/copy/paste with selection support

## API Endpoints

### Core Endpoints
- `GET /api/health` - Health check
- `GET /api/filters` - List available filters with param schemas
- `POST /api/filters/{id}` - Apply filter (raw RGBA in/out)
- `GET /api/images/sources` - List image sources
- `GET /api/images/{source}/{id}` - Get sample image as raw RGBA

### Session Management API
All editor operations are available via the Session API:

- `GET /api/sessions` - List all active editor sessions
- `GET /api/sessions/{id}` - Get session state
- `GET /api/sessions/{id}/image` - Get composite image (base64 RGBA)
- `GET /api/sessions/{id}/layers/{layer_id}` - Get layer image

### Tool Execution API
Execute any tool action programmatically:

- `POST /api/sessions/{id}/tools/{tool_id}/execute`
  ```json
  {"action": "draw", "params": {"x": 100, "y": 100, ...}}
  ```

Available tools and actions:
- **selection**: `select`, `select_all`, `clear`, `get`
- **lasso**: `select` (params: `points`), `clear`
- **magicwand**: `select` (params: `x`, `y`, `tolerance`, `contiguous`)
- **brush**: `stroke` (params: `points`, `color`, `size`, `hardness`, `opacity`, `flow`), `dot`
- **spray**: `spray` (params: `x`, `y`, `size`, `density`, `color`, `count`), `stroke`
- **eraser**: `stroke` (params: `points`, `size`)
- **line**: `draw` (params: `start`, `end`, `color`, `width`)
- **rect**: `draw` (params: `x`, `y`, `width`, `height` or `start`, `end`)
- **circle**: `draw` (params: `center`, `radius` or `start`, `end`)
- **polygon**: `draw` (params: `points`, `color`, `fill`, `stroke`, `strokeWidth`)
- **fill**: `fill` (params: `point`, `color`, `tolerance`)
- **gradient**: `draw` (params: `x1`, `y1`, `x2`, `y2`, `type`, `startColor`, `endColor`)
- **text**: `draw` (params: `text`, `x`, `y`, `fontSize`, `fontFamily`, `color`)
- **crop**: `crop` (params: `x`, `y`, `width`, `height`)

### Command API
Execute editor commands:

- `POST /api/sessions/{id}/command`
  ```json
  {"command": "copy", "params": {}}
  ```

Available commands:
- `undo`, `redo`
- `copy`, `cut`, `paste`, `paste_in_place`
- `select_all`, `deselect`, `delete_selection`
- `new_layer`, `delete_layer`, `duplicate_layer`, `merge_down`, `flatten`
- `set_foreground_color`, `set_background_color` (params: `color`)
- `select_tool` (params: `tool_id`)
- `apply_filter` (params: `filter_id`, `params`)
- `new_document` (params: `width`, `height`)

## Binary Protocol (Filter I/O)
Request: `[4 bytes metadata length (LE)][JSON metadata][raw RGBA bytes]`
Response: `[raw RGBA bytes]` (same dimensions as input)

## Keyboard Shortcuts
- **Selection Tools**: M (selection), L (lasso), W (magic wand)
- **Drawing Tools**: V (move), B (brush), A (spray/airbrush), E (eraser)
- **Shape Tools**: L (line), R (rect), C (circle/crop), P (polygon)
- **Other Tools**: G (gradient/fill), T (text), I (eyedropper)
- **Edit**: Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo)
- **Clipboard**: Ctrl+C (copy), Ctrl+X (cut), Ctrl+V (paste), Ctrl+Shift+V (paste in place)
- **Selection**: Ctrl+A (select all), Ctrl+D (deselect), Delete (clear selection)
- **Colors**: X (swap FG/BG), D (reset to black/white)

## Multi-Document Support

The editor supports multiple documents open simultaneously, similar to GIMP and Photoshop.

### Features
- **Document tabs**: Tab bar shows all open documents
- **Independent state**: Each document has its own layers, history, colors, and view state
- **Tab interactions**:
  - Click tab to switch documents
  - Middle-click tab to close
  - Click × button to close
  - Click + button to create new document
- **Modified indicator**: Documents with unsaved changes show a dot (•) after the name
- **Unsaved changes prompt**: Closing a modified document shows a confirmation dialog

### Document State
Each document maintains:
- LayerStack (all layers and their pixel data)
- History (independent undo/redo stack)
- Foreground/background colors
- View state (zoom level, pan position)
- Document dimensions (width × height)
- Modified flag

### Implementation
- `Document` class encapsulates all document state
- `DocumentManager` handles document lifecycle and switching
- When switching documents, the app context (layerStack, history, renderer) is updated to point to the new document's data

## Rendering Quality

The editor uses high-quality rendering techniques for professional results.

### Canvas Rendering
- **Bicubic interpolation**: `imageSmoothingQuality = 'high'` for zoom operations
- **Always smooth**: Image smoothing enabled at all zoom levels for best quality
- **Navigator preview**: High-quality scaled preview with live updates during drawing

### Brush Quality
- **Anti-aliased circles**: Brush stamps use `ctx.arc()` for proper circular shapes
- **Supersampling**: Small brushes (< 20px) rendered at 2x-4x resolution then downscaled
- **Smooth gradients**: Soft brushes use multi-stop radial gradients for natural falloff
- **Live preview**: Navigator updates every 100ms during brush strokes
