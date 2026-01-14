/**
 * VectorLayer - A layer that contains vector shapes instead of raster data.
 *
 * Vector shapes are stored as data objects and rendered to the canvas on demand.
 * Shapes remain editable until the layer is rasterized.
 */
import { Layer } from './Layer.js';
import { createShape } from './VectorShape.js';

// Import shape types so they register themselves
import './shapes/RectShape.js';
import './shapes/EllipseShape.js';
import './shapes/LineShape.js';
import './shapes/PolygonShape.js';
import './shapes/PathShape.js';

export class VectorLayer extends Layer {
    /**
     * @param {Object} options
     * @param {string} [options.id]
     * @param {string} [options.name]
     * @param {number} options.width
     * @param {number} options.height
     * @param {number} [options.opacity]
     * @param {string} [options.blendMode]
     * @param {boolean} [options.visible]
     * @param {boolean} [options.locked]
     */
    constructor(options = {}) {
        super(options);

        // Mark as vector layer
        this.type = 'vector';

        // Array of VectorShape instances
        this.shapes = [];

        // Selection state
        this.selectedShapeIds = new Set();
    }

    /**
     * Add a shape to this layer.
     * @param {VectorShape} shape
     * @param {number} [index] - Insert at index, or append if not specified
     */
    addShape(shape, index = -1) {
        if (index >= 0 && index < this.shapes.length) {
            this.shapes.splice(index, 0, shape);
        } else {
            this.shapes.push(shape);
        }
        this.render();
    }

    /**
     * Remove a shape by ID.
     * @param {string} shapeId
     * @returns {VectorShape|null} The removed shape
     */
    removeShape(shapeId) {
        const index = this.shapes.findIndex(s => s.id === shapeId);
        if (index >= 0) {
            const [removed] = this.shapes.splice(index, 1);
            this.selectedShapeIds.delete(shapeId);
            this.render();
            return removed;
        }
        return null;
    }

    /**
     * Get shape by ID.
     * @param {string} shapeId
     * @returns {VectorShape|null}
     */
    getShapeById(shapeId) {
        return this.shapes.find(s => s.id === shapeId) || null;
    }

    /**
     * Get shape at position (for hit testing).
     * Checks in reverse order (top shapes first).
     * @param {number} x
     * @param {number} y
     * @returns {VectorShape|null}
     */
    getShapeAt(x, y) {
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            if (this.shapes[i].containsPoint(x, y)) {
                return this.shapes[i];
            }
        }
        return null;
    }

    /**
     * Get control point at position across all selected shapes.
     * @param {number} x
     * @param {number} y
     * @param {number} [tolerance]
     * @returns {{ shape: VectorShape, control: Object }|null}
     */
    getControlPointAt(x, y, tolerance = 8) {
        for (const shapeId of this.selectedShapeIds) {
            const shape = this.getShapeById(shapeId);
            if (shape) {
                const control = shape.getControlPointAt(x, y, tolerance);
                if (control) {
                    return { shape, control };
                }
            }
        }
        return null;
    }

    /**
     * Select a shape.
     * @param {string} shapeId
     * @param {boolean} [addToSelection] - Add to existing selection
     */
    selectShape(shapeId, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        const shape = this.getShapeById(shapeId);
        if (shape) {
            shape.selected = true;
            this.selectedShapeIds.add(shapeId);
            this.render();
        }
    }

    /**
     * Deselect a shape.
     * @param {string} shapeId
     */
    deselectShape(shapeId) {
        const shape = this.getShapeById(shapeId);
        if (shape) {
            shape.selected = false;
            this.selectedShapeIds.delete(shapeId);
            this.render();
        }
    }

    /**
     * Clear all selection.
     */
    clearSelection() {
        for (const shapeId of this.selectedShapeIds) {
            const shape = this.getShapeById(shapeId);
            if (shape) {
                shape.selected = false;
            }
        }
        this.selectedShapeIds.clear();
        this.render();
    }

    /**
     * Get all selected shapes.
     * @returns {VectorShape[]}
     */
    getSelectedShapes() {
        return this.shapes.filter(s => this.selectedShapeIds.has(s.id));
    }

    /**
     * Move a shape in z-order.
     * @param {string} shapeId
     * @param {'up'|'down'|'top'|'bottom'} direction
     */
    moveShapeInOrder(shapeId, direction) {
        const index = this.shapes.findIndex(s => s.id === shapeId);
        if (index < 0) return;

        const [shape] = this.shapes.splice(index, 1);

        switch (direction) {
            case 'up':
                this.shapes.splice(Math.min(index + 1, this.shapes.length), 0, shape);
                break;
            case 'down':
                this.shapes.splice(Math.max(index - 1, 0), 0, shape);
                break;
            case 'top':
                this.shapes.push(shape);
                break;
            case 'bottom':
                this.shapes.unshift(shape);
                break;
        }

        this.render();
    }

    /**
     * Render all shapes to the canvas using Canvas 2D API.
     * Used for fast preview during editing.
     */
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (const shape of this.shapes) {
            shape.render(this.ctx);
        }

        // Render selection handles for selected shapes
        for (const shapeId of this.selectedShapeIds) {
            const shape = this.getShapeById(shapeId);
            if (shape) {
                shape.renderSelection(this.ctx);
            }
        }
    }

    /**
     * Generate SVG document from all shapes.
     * This is the canonical representation for cross-platform parity.
     * @returns {string} SVG document string
     */
    toSVG() {
        const elements = this.shapes
            .map(shape => shape.toSVGElement())
            .filter(el => el);  // Remove empty elements

        // Use shape-rendering="crispEdges" for cross-platform parity.
        // This disables anti-aliasing, ensuring Chrome and resvg produce
        // identical pixel output. With AA enabled (geometricPrecision),
        // the renderers produce 1-4% pixel difference on curves/diagonals.
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" shape-rendering="crispEdges">
  ${elements.join('\n  ')}
</svg>`;
    }

    /**
     * Render layer via SVG for pixel-accurate output.
     * This matches Python's resvg rendering for cross-platform parity.
     * @returns {Promise<void>}
     */
    async renderViaSVG() {
        if (this.shapes.length === 0) {
            this.ctx.clearRect(0, 0, this.width, this.height);
            return;
        }

        const svg = this.toSVG();
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        try {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            this.ctx.clearRect(0, 0, this.width, this.height);
            this.ctx.drawImage(img, 0, 0);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Get raw RGBA pixel data after SVG rendering.
     * Used for parity testing with Python.
     * @returns {Promise<Uint8ClampedArray>}
     */
    async getPixelsViaSVG() {
        await this.renderViaSVG();
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        return imageData.data;
    }

    /**
     * Create a rasterized (pixel) copy of this layer.
     * @returns {Layer}
     */
    rasterize() {
        // Make sure canvas is up to date
        this.render();

        // Create a new bitmap layer
        const rasterLayer = new Layer({
            width: this.width,
            height: this.height,
            name: this.name,
            opacity: this.opacity,
            blendMode: this.blendMode,
            visible: this.visible,
            locked: this.locked
        });

        // Copy the rendered content
        rasterLayer.ctx.drawImage(this.canvas, 0, 0);

        return rasterLayer;
    }

    /**
     * Clone this vector layer.
     * @returns {VectorLayer}
     */
    clone() {
        const cloned = new VectorLayer({
            width: this.width,
            height: this.height,
            name: `${this.name} (copy)`,
            opacity: this.opacity,
            blendMode: this.blendMode,
            visible: this.visible
        });

        // Clone all shapes
        cloned.shapes = this.shapes.map(s => s.clone());

        cloned.render();
        return cloned;
    }

    /**
     * Serialize for history/save.
     * @returns {Object}
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            width: this.width,
            height: this.height,
            opacity: this.opacity,
            blendMode: this.blendMode,
            visible: this.visible,
            locked: this.locked,
            type: 'vector',
            shapes: this.shapes.map(s => s.toData())
        };
    }

    /**
     * Restore from serialized data.
     * @param {Object} data
     * @returns {VectorLayer}
     */
    static deserialize(data) {
        const layer = new VectorLayer({
            id: data.id,
            name: data.name,
            width: data.width,
            height: data.height,
            opacity: data.opacity,
            blendMode: data.blendMode,
            visible: data.visible,
            locked: data.locked
        });

        // Restore shapes
        layer.shapes = (data.shapes || []).map(shapeData => createShape(shapeData));
        layer.render();

        return layer;
    }

    /**
     * Check if this is a vector layer.
     * @returns {boolean}
     */
    isVector() {
        return true;
    }
}

// Add helper to regular Layer to check type
Layer.prototype.isVector = function() {
    return false;
};
