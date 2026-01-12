/**
 * Clipboard - Manages copy, cut, and paste operations.
 */
export class Clipboard {
    constructor(app) {
        this.app = app;
        this.buffer = null; // { imageData, width, height, x, y }
    }

    /**
     * Copy the current selection or entire layer to clipboard.
     * @param {Object} selection - Optional selection rect {x, y, width, height}
     * @returns {boolean} Success
     */
    copy(selection = null) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer) return false;

        let x, y, width, height;

        if (selection && selection.width > 0 && selection.height > 0) {
            x = Math.max(0, Math.floor(selection.x));
            y = Math.max(0, Math.floor(selection.y));
            width = Math.min(selection.width, layer.width - x);
            height = Math.min(selection.height, layer.height - y);
        } else {
            // Copy entire layer
            x = 0;
            y = 0;
            width = layer.width;
            height = layer.height;
        }

        if (width <= 0 || height <= 0) return false;

        const imageData = layer.ctx.getImageData(x, y, width, height);
        this.buffer = {
            imageData,
            width,
            height,
            sourceX: x,
            sourceY: y
        };

        this.app.eventBus.emit('clipboard:copy', { width, height });
        return true;
    }

    /**
     * Cut the current selection (copy + clear).
     * @param {Object} selection - Selection rect {x, y, width, height}
     * @returns {boolean} Success
     */
    cut(selection = null) {
        if (!this.copy(selection)) return false;

        const layer = this.app.layerStack.getActiveLayer();
        if (!layer) return false;

        this.app.history.saveState('cut');

        if (selection && selection.width > 0 && selection.height > 0) {
            // Clear selection area
            layer.ctx.clearRect(
                Math.floor(selection.x),
                Math.floor(selection.y),
                Math.ceil(selection.width),
                Math.ceil(selection.height)
            );
        } else {
            // Clear entire layer
            layer.ctx.clearRect(0, 0, layer.width, layer.height);
        }

        this.app.renderer.requestRender();
        this.app.eventBus.emit('clipboard:cut', { width: this.buffer.width, height: this.buffer.height });
        return true;
    }

    /**
     * Paste clipboard content to a new layer or at position.
     * @param {Object} options - { x, y, asNewLayer }
     * @returns {boolean} Success
     */
    paste(options = {}) {
        if (!this.buffer) return false;

        const { x = 0, y = 0, asNewLayer = true } = options;

        this.app.history.saveState('paste');

        let targetLayer;
        if (asNewLayer) {
            targetLayer = this.app.layerStack.addLayer({ name: 'Pasted' });
        } else {
            targetLayer = this.app.layerStack.getActiveLayer();
        }

        if (!targetLayer) return false;

        // Create temp canvas to hold image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.buffer.width;
        tempCanvas.height = this.buffer.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(this.buffer.imageData, 0, 0);

        // Draw to target layer at position
        targetLayer.ctx.drawImage(tempCanvas, x, y);

        this.app.renderer.requestRender();
        this.app.eventBus.emit('clipboard:paste', {
            x, y,
            width: this.buffer.width,
            height: this.buffer.height,
            newLayer: asNewLayer
        });
        return true;
    }

    /**
     * Paste in place (at original position).
     * @param {boolean} asNewLayer - Create new layer
     * @returns {boolean} Success
     */
    pasteInPlace(asNewLayer = true) {
        if (!this.buffer) return false;
        return this.paste({
            x: this.buffer.sourceX,
            y: this.buffer.sourceY,
            asNewLayer
        });
    }

    /**
     * Check if clipboard has content.
     * @returns {boolean}
     */
    hasContent() {
        return this.buffer !== null;
    }

    /**
     * Get clipboard info.
     * @returns {Object|null}
     */
    getInfo() {
        if (!this.buffer) return null;
        return {
            width: this.buffer.width,
            height: this.buffer.height,
            sourceX: this.buffer.sourceX,
            sourceY: this.buffer.sourceY
        };
    }

    /**
     * Clear clipboard.
     */
    clear() {
        this.buffer = null;
        this.app.eventBus.emit('clipboard:clear');
    }

    /**
     * Set clipboard from raw RGBA data (for API use).
     * @param {Uint8ClampedArray} data - RGBA pixel data
     * @param {number} width
     * @param {number} height
     * @param {number} sourceX
     * @param {number} sourceY
     */
    setFromData(data, width, height, sourceX = 0, sourceY = 0) {
        const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
        this.buffer = {
            imageData,
            width,
            height,
            sourceX,
            sourceY
        };
    }

    /**
     * Get clipboard as raw RGBA data (for API use).
     * @returns {Object|null}
     */
    getData() {
        if (!this.buffer) return null;
        return {
            data: Array.from(this.buffer.imageData.data),
            width: this.buffer.width,
            height: this.buffer.height,
            sourceX: this.buffer.sourceX,
            sourceY: this.buffer.sourceY
        };
    }
}
