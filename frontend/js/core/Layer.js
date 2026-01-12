/**
 * Layer - Represents a single layer with its own offscreen canvas.
 */
export class Layer {
    /**
     * @param {Object} options
     * @param {string} [options.id] - Unique identifier
     * @param {string} [options.name] - Display name
     * @param {number} options.width - Canvas width
     * @param {number} options.height - Canvas height
     * @param {number} [options.opacity] - Opacity 0.0-1.0
     * @param {string} [options.blendMode] - Blend mode
     * @param {boolean} [options.visible] - Visibility
     * @param {boolean} [options.locked] - Lock state
     */
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID();
        this.name = options.name || 'Layer';
        this.width = options.width;
        this.height = options.height;

        // Create offscreen canvas for this layer
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Layer properties
        this.opacity = options.opacity ?? 1.0;
        this.blendMode = options.blendMode || 'normal';
        this.visible = options.visible ?? true;
        this.locked = options.locked ?? false;
    }

    /**
     * Get raw ImageData for transfer to backend.
     * @returns {ImageData}
     */
    getImageData() {
        return this.ctx.getImageData(0, 0, this.width, this.height);
    }

    /**
     * Set ImageData (from backend filter result).
     * @param {ImageData} imageData
     */
    setImageData(imageData) {
        this.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Clone this layer.
     * @returns {Layer}
     */
    clone() {
        const cloned = new Layer({
            width: this.width,
            height: this.height,
            name: `${this.name} (copy)`,
            opacity: this.opacity,
            blendMode: this.blendMode,
            visible: this.visible
        });
        cloned.ctx.drawImage(this.canvas, 0, 0);
        return cloned;
    }

    /**
     * Clear layer content.
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Fill layer with a color.
     * @param {string} color - CSS color string
     */
    fill(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.width, this.height);
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
            imageData: this.canvas.toDataURL('image/png')
        };
    }

    /**
     * Restore from serialized data.
     * @param {Object} data
     * @returns {Promise<Layer>}
     */
    static async deserialize(data) {
        const layer = new Layer({
            id: data.id,
            name: data.name,
            width: data.width,
            height: data.height,
            opacity: data.opacity,
            blendMode: data.blendMode,
            visible: data.visible,
            locked: data.locked
        });

        // Load image data from data URL
        await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                layer.ctx.drawImage(img, 0, 0);
                resolve();
            };
            img.src = data.imageData;
        });

        return layer;
    }
}
