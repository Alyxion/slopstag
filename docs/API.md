# REST API Documentation

## Overview

The Slopstag API provides programmatic access to all editor features. All endpoints are prefixed with `/api`.

## Core Endpoints

### Health Check
```
GET /api/health
```
Returns server status.

### Filters
```
GET /api/filters
```
List available filters with parameter schemas.

```
POST /api/filters/{filter_id}
Content-Type: application/octet-stream
```
Apply filter. Uses binary protocol (see below).

### Images
```
GET /api/images/sources
```
List available image sources.

```
GET /api/images/{source}/{id}
```
Get sample image as raw RGBA.

## Session Management

### List Sessions
```
GET /api/sessions
```
Returns all active editor sessions.

### Get Session
```
GET /api/sessions/{id}
```
Returns session state including layers, dimensions, colors.

### Get Composite Image
```
GET /api/sessions/{id}/image
```
Returns the composite image (all visible layers merged) as base64 RGBA.

### Get Layer Image
```
GET /api/sessions/{id}/layers/{layer_id}
```
Returns a specific layer's image data.

## Tool Execution

### Execute Tool Action
```
POST /api/sessions/{id}/tools/{tool_id}/execute
Content-Type: application/json

{
    "action": "action_name",
    "params": { ... }
}
```

### Available Tools and Actions

#### Selection Tool
- `select` - Create selection: `{x, y, width, height}`
- `select_all` - Select entire canvas
- `clear` - Clear selection
- `get` - Get current selection bounds

#### Brush Tool
- `stroke` - Draw stroke: `{points: [[x,y],...], color, size, hardness, opacity, flow}`
- `dot` - Single dot: `{x, y, size, color}`

#### Eraser Tool
- `stroke` - Erase stroke: `{points: [[x,y],...], size}`

#### Line Tool
- `draw` - Draw line: `{start: [x,y], end: [x,y], color, width}`

#### Rectangle Tool
- `draw` - Draw rect: `{x, y, width, height}` or `{start: [x,y], end: [x,y]}`

#### Circle Tool
- `draw` - Draw circle: `{center: [x,y], radius}` or `{start: [x,y], end: [x,y]}`

#### Polygon Tool
- `draw` - Draw polygon: `{points: [[x,y],...], color, fill, stroke, strokeWidth}`

#### Fill Tool
- `fill` - Flood fill: `{point: [x,y], color, tolerance}`

#### Gradient Tool
- `draw` - Draw gradient: `{x1, y1, x2, y2, type, startColor, endColor}`

#### Text Tool
- `draw` - Add text: `{text, x, y, fontSize, fontFamily, color}`

#### Crop Tool
- `crop` - Crop document: `{x, y, width, height}`

## Command Execution

### Execute Command
```
POST /api/sessions/{id}/command
Content-Type: application/json

{
    "command": "command_name",
    "params": { ... }
}
```

### Available Commands

#### Edit Commands
- `undo` - Undo last action
- `redo` - Redo last undone action

#### Clipboard Commands
- `copy` - Copy selection from current layer
- `copy_merged` - Copy selection from all visible layers
- `cut` - Cut selection
- `paste` - Paste as new layer
- `paste_in_place` - Paste at original position

#### Selection Commands
- `select_all` - Select entire canvas
- `deselect` - Clear selection
- `delete_selection` - Delete selected content

#### Layer Commands
- `new_layer` - Create new layer
- `delete_layer` - Delete active layer
- `duplicate_layer` - Duplicate active layer
- `merge_down` - Merge with layer below
- `flatten` - Flatten all layers

#### Color Commands
- `set_foreground_color` - Set FG color: `{color: "#rrggbb"}`
- `set_background_color` - Set BG color: `{color: "#rrggbb"}`

#### Other Commands
- `select_tool` - Switch tool: `{tool_id: "brush"}`
- `apply_filter` - Apply filter: `{filter_id, params: {...}}`
- `new_document` - New document: `{width, height}`

## Binary Protocol

For filter I/O, raw RGBA bytes are used for efficiency.

### Request Format
```
[4 bytes: metadata length (little-endian)]
[JSON metadata]
[raw RGBA bytes]
```

### Metadata Schema
```json
{
    "width": 800,
    "height": 600,
    "params": {
        "sigma": 2.0
    }
}
```

### Response Format
```
[raw RGBA bytes]
```
Same dimensions as input unless filter transforms size.

## Error Handling

Errors return JSON with success=false:
```json
{
    "success": false,
    "error": "Error message"
}
```

HTTP status codes:
- 200: Success
- 400: Bad request (invalid params)
- 404: Resource not found
- 500: Server error
