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
- `copy`, `copy_merged`, `cut`, `paste`, `paste_in_place`
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
- **Clipboard**: Ctrl+C (copy from layer), Ctrl+Shift+C (copy merged from all layers), Ctrl+X (cut), Ctrl+V (paste), Ctrl+Shift+V (paste in place)
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

## Layer Coordinate System

Layers can be positioned anywhere in the document using offset coordinates.

### Coordinate Spaces
- **Document coordinates**: Absolute position in the document (used by tools, selections)
- **Layer canvas coordinates**: Position relative to the layer's top-left corner

### Coordinate Conversion
```javascript
// Convert document coords to layer canvas coords
const localCoords = layer.docToCanvas(docX, docY);

// Convert layer canvas coords to document coords
const docCoords = layer.canvasToDoc(canvasX, canvasY);
```

### Layer Properties
- `layer.offsetX`, `layer.offsetY`: Layer position in document space
- `layer.width`, `layer.height`: Layer canvas dimensions
- Layers can be smaller than the document and positioned anywhere

### Tool Behavior with Offset Layers
- All tools receive document coordinates in mouse events
- Tools must convert to layer coordinates before drawing
- Operations outside layer bounds are clipped
- Selections are in document space, not layer space

## Testing

### Test Framework
Tests use Selenium WebDriver with a unified helper system in `tests/helpers/`:

- **EditorTestHelper**: Browser interaction, canvas events, tool selection
- **PixelHelper**: Pixel extraction, checksums, color counting
- **ToolHelper**: Tool-specific operations (brush, shapes, etc.)
- **LayerHelper**: Layer creation, manipulation, properties
- **SelectionHelper**: Selection operations, clipboard

### Running Tests
```bash
pytest tests/                    # All tests
pytest tests/test_tools_*.py    # Tool tests only
pytest -k "brush"                # Tests matching pattern
```

### Testing Principles

**CRITICAL: Always use range-based assertions for pixel counts, never just "it changed".**

#### Expected Pixel Counts

Calculate expected pixels from geometry with appropriate tolerance:

| Shape | Formula | Default Tolerance |
|-------|---------|-------------------|
| Line/stroke | length × width | ±30% |
| Rectangle | width × height | ±10% |
| Circle | π × r² | ±20% |
| Ellipse | π × a × b | ±20% |
| Outline | perimeter × stroke | ±30% |
| Diagonal line | √(Δx² + Δy²) × width | ±35% |

#### Assertion Helpers

```python
from tests.helpers import (
    approx_line_pixels,
    approx_rect_pixels,
    approx_circle_pixels,
    assert_pixel_count_in_range,
    assert_pixel_count_exact,
)

# Range assertions for drawing operations
min_px, max_px = approx_line_pixels(length=100, width=4)
assert min_px <= actual <= max_px

# Exact assertions for undo/redo
assert_pixel_count_exact(after_undo, 0, "Undo should restore empty canvas")
```

#### When to Use Each Assertion Type

**Range assertions** (most common):
- After drawing any shape or stroke
- After erasing content
- After clipboard paste

**Exact assertions**:
- Undo/redo must restore exactly to previous state
- Operations outside layer bounds must produce 0 pixels
- Layer fill must produce exact width × height pixels

#### Example Test Pattern

```python
def test_brush_horizontal_stroke(self, helpers):
    helpers.new_document(200, 200)

    brush_size = 10
    stroke_length = 100  # from (50, 100) to (150, 100)

    helpers.tools.brush_stroke(
        [(50, 100), (150, 100)],
        color='#FF0000',
        size=brush_size
    )

    red_pixels = helpers.pixels.count_pixels_with_color(
        (255, 0, 0, 255), tolerance=10
    )

    # Expected: 100 × 10 = 1000 pixels, ±30% = 700-1300
    min_expected, max_expected = approx_line_pixels(stroke_length, brush_size)

    assert min_expected <= red_pixels <= max_expected, \
        f"Expected {min_expected}-{max_expected} pixels, got {red_pixels}"
```

#### Testing Offset Layers

Always test tools with layers at different positions:

```python
def test_brush_on_offset_layer(self, helpers):
    helpers.new_document(400, 400)

    # Create layer NOT at origin
    layer_id = helpers.layers.create_offset_layer(
        offset_x=200, offset_y=200,
        width=150, height=150
    )

    # Draw in document coordinates
    helpers.tools.brush_stroke([(250, 275), (320, 275)], color='#FF0000')

    # Verify on the specific layer
    pixels = helpers.pixels.count_pixels_with_color(
        (255, 0, 0, 255), tolerance=10, layer_id=layer_id
    )

    # Calculate expected based on portion inside layer
    # ...
```

### Test Categories

- `test_tools_brush_eraser.py` - Brush/eraser with offset layers
- `test_tools_shapes.py` - Line/rect/circle with offset layers
- `test_tools_selection.py` - Selection tools with offset layers
- `test_clipboard.py` - Copy/cut/paste with offset layers
- `test_layers.py` - Layer operations
