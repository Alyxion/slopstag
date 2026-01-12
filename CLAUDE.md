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
