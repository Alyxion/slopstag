/**
 * MoveTool - Move layer contents.
 */
import { Tool } from './Tool.js';

export class MoveTool extends Tool {
    static id = 'move';
    static name = 'Move';
    static icon = 'move';
    static shortcut = 'v';
    static cursor = 'move';

    constructor(app) {
        super(app);

        // State
        this.isMoving = false;
        this.startX = 0;
        this.startY = 0;
        this.layerSnapshot = null;
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        this.isMoving = true;
        this.startX = x;
        this.startY = y;

        // Save layer content for moving
        this.layerSnapshot = layer.ctx.getImageData(0, 0, layer.width, layer.height);

        // Save state for undo
        this.app.history.saveState('move');
    }

    onMouseMove(e, x, y) {
        if (!this.isMoving || !this.layerSnapshot) return;

        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        const dx = Math.round(x - this.startX);
        const dy = Math.round(y - this.startY);

        // Clear layer
        layer.ctx.clearRect(0, 0, layer.width, layer.height);

        // Draw snapshot at offset
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.width;
        tempCanvas.height = layer.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(this.layerSnapshot, 0, 0);

        layer.ctx.drawImage(tempCanvas, dx, dy);
        this.app.renderer.requestRender();
    }

    onMouseUp(e, x, y) {
        this.isMoving = false;
        this.layerSnapshot = null;
    }

    onMouseLeave(e) {
        // Keep state on mouse leave to allow continued dragging
    }

    getProperties() {
        return [];
    }
}
