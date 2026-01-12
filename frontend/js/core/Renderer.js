/**
 * Renderer - Composites all layers to the display canvas.
 */
import { BlendModes } from './BlendModes.js';

export class Renderer {
    /**
     * @param {HTMLCanvasElement} displayCanvas - The visible canvas element
     * @param {LayerStack} layerStack - The layer stack to render
     */
    constructor(displayCanvas, layerStack) {
        this.displayCanvas = displayCanvas;
        this.displayCtx = displayCanvas.getContext('2d');
        this.layerStack = layerStack;

        // Working canvas for composition
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCtx = this.compositeCanvas.getContext('2d');

        // Preview layer for tool overlays
        this.previewCanvas = null;

        // Settings
        this.backgroundColor = '#FFFFFF';
        this.showTransparencyGrid = true;
        this.gridSize = 10;

        // Viewport/zoom state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;

        // Render loop
        this.needsRender = true;
        this.animationFrameId = null;
        this.startRenderLoop();
    }

    /**
     * Resize the composite canvas (document size).
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
        this.needsRender = true;
    }

    /**
     * Render all layers to the display canvas.
     */
    render() {
        const { width, height } = this.compositeCanvas;

        // Clear composite canvas
        this.compositeCtx.clearRect(0, 0, width, height);

        // Draw transparency grid if enabled
        if (this.showTransparencyGrid) {
            this.drawTransparencyGrid();
        } else {
            this.compositeCtx.fillStyle = this.backgroundColor;
            this.compositeCtx.fillRect(0, 0, width, height);
        }

        // Composite all visible layers (bottom to top)
        for (const layer of this.layerStack.layers) {
            if (!layer.visible) continue;

            this.compositeCtx.globalAlpha = layer.opacity;
            this.compositeCtx.globalCompositeOperation = BlendModes.toCompositeOperation(layer.blendMode);
            this.compositeCtx.drawImage(layer.canvas, 0, 0);
        }

        // Draw preview layer if set
        if (this.previewCanvas) {
            this.compositeCtx.globalAlpha = 1.0;
            this.compositeCtx.globalCompositeOperation = 'source-over';
            this.compositeCtx.drawImage(this.previewCanvas, 0, 0);
        }

        // Reset composite settings
        this.compositeCtx.globalAlpha = 1.0;
        this.compositeCtx.globalCompositeOperation = 'source-over';

        // Draw to display canvas with zoom/pan transform
        this.displayCtx.fillStyle = '#2d2d2d';
        this.displayCtx.fillRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);

        this.displayCtx.save();
        this.displayCtx.translate(this.panX, this.panY);
        this.displayCtx.scale(this.zoom, this.zoom);
        this.displayCtx.imageSmoothingEnabled = this.zoom < 1;
        this.displayCtx.drawImage(this.compositeCanvas, 0, 0);
        this.displayCtx.restore();

        // Draw canvas border
        this.displayCtx.strokeStyle = '#666666';
        this.displayCtx.lineWidth = 1;
        this.displayCtx.strokeRect(
            this.panX - 0.5,
            this.panY - 0.5,
            width * this.zoom + 1,
            height * this.zoom + 1
        );
    }

    /**
     * Draw transparency checkerboard pattern.
     */
    drawTransparencyGrid() {
        const { width, height } = this.compositeCanvas;
        const size = this.gridSize;
        const colors = ['#CCCCCC', '#FFFFFF'];

        for (let y = 0; y < height; y += size) {
            for (let x = 0; x < width; x += size) {
                const colorIndex = ((Math.floor(x / size) + Math.floor(y / size)) % 2);
                this.compositeCtx.fillStyle = colors[colorIndex];
                this.compositeCtx.fillRect(x, y, size, size);
            }
        }
    }

    /**
     * Start the render loop.
     */
    startRenderLoop() {
        const loop = () => {
            if (this.needsRender) {
                this.render();
                this.needsRender = false;
            }
            this.animationFrameId = requestAnimationFrame(loop);
        };
        loop();
    }

    /**
     * Stop the render loop.
     */
    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Request a render on the next frame.
     */
    requestRender() {
        this.needsRender = true;
    }

    /**
     * Set preview canvas for tool overlays.
     * @param {HTMLCanvasElement} canvas
     */
    setPreviewLayer(canvas) {
        this.previewCanvas = canvas;
        this.requestRender();
    }

    /**
     * Clear preview layer.
     */
    clearPreviewLayer() {
        this.previewCanvas = null;
        this.requestRender();
    }

    /**
     * Convert screen coordinates to canvas coordinates.
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    screenToCanvas(screenX, screenY) {
        return {
            x: (screenX - this.panX) / this.zoom,
            y: (screenY - this.panY) / this.zoom
        };
    }

    /**
     * Convert canvas coordinates to screen coordinates.
     * @param {number} canvasX
     * @param {number} canvasY
     * @returns {{x: number, y: number}}
     */
    canvasToScreen(canvasX, canvasY) {
        return {
            x: canvasX * this.zoom + this.panX,
            y: canvasY * this.zoom + this.panY
        };
    }

    /**
     * Zoom in/out centered on a point.
     * @param {number} factor - Zoom factor (>1 to zoom in, <1 to zoom out)
     * @param {number} centerX - Screen X to zoom around
     * @param {number} centerY - Screen Y to zoom around
     */
    zoomAt(factor, centerX, centerY) {
        const canvas = this.screenToCanvas(centerX, centerY);
        this.zoom *= factor;
        this.zoom = Math.max(0.1, Math.min(10, this.zoom));
        const newScreen = this.canvasToScreen(canvas.x, canvas.y);
        this.panX += centerX - newScreen.x;
        this.panY += centerY - newScreen.y;
        this.requestRender();
    }

    /**
     * Pan the viewport.
     * @param {number} dx
     * @param {number} dy
     */
    pan(dx, dy) {
        this.panX += dx;
        this.panY += dy;
        this.requestRender();
    }

    /**
     * Center the canvas in the viewport.
     */
    centerCanvas() {
        const { width, height } = this.compositeCanvas;
        this.panX = (this.displayCanvas.width - width * this.zoom) / 2;
        this.panY = (this.displayCanvas.height - height * this.zoom) / 2;
        this.requestRender();
    }

    /**
     * Fit the canvas to the viewport.
     */
    fitToViewport() {
        const { width, height } = this.compositeCanvas;
        const scaleX = (this.displayCanvas.width - 40) / width;
        const scaleY = (this.displayCanvas.height - 40) / height;
        this.zoom = Math.min(scaleX, scaleY, 1);
        this.centerCanvas();
    }
}
