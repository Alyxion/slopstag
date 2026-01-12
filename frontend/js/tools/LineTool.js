/**
 * LineTool - Draw straight lines.
 */
import { Tool } from './Tool.js';

export class LineTool extends Tool {
    static id = 'line';
    static name = 'Line';
    static icon = 'line';
    static shortcut = 'l';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);
        this.lineWidth = 2;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;

        // Preview canvas
        this.previewCanvas = document.createElement('canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        this.isDrawing = true;
        this.startX = x;
        this.startY = y;

        this.previewCanvas.width = layer.width;
        this.previewCanvas.height = layer.height;
        this.app.history.saveState('line');
    }

    onMouseMove(e, x, y) {
        if (!this.isDrawing) return;

        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.drawLine(this.previewCtx, this.startX, this.startY, x, y, e.shiftKey);
        this.app.renderer.setPreviewLayer(this.previewCanvas);
    }

    onMouseUp(e, x, y) {
        if (!this.isDrawing) return;

        const layer = this.app.layerStack.getActiveLayer();
        if (layer && !layer.locked) {
            this.drawLine(layer.ctx, this.startX, this.startY, x, y, e.shiftKey);
        }

        this.isDrawing = false;
        this.app.renderer.clearPreviewLayer();
        this.app.renderer.requestRender();
    }

    onMouseLeave(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.app.renderer.clearPreviewLayer();
        }
    }

    drawLine(ctx, x1, y1, x2, y2, constrain = false) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);

        if (constrain) {
            // Snap to 45-degree angles
            const dx = x2 - x1;
            const dy = y2 - y1;
            const angle = Math.atan2(dy, dx);
            const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const dist = Math.sqrt(dx * dx + dy * dy);
            ctx.lineTo(x1 + Math.cos(snapAngle) * dist, y1 + Math.sin(snapAngle) * dist);
        } else {
            ctx.lineTo(x2, y2);
        }

        ctx.strokeStyle = this.app.foregroundColor || '#000000';
        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // API execution method
    executeAction(action, params) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return { success: false, error: 'No active layer' };

        if (action === 'draw' && params.start && params.end) {
            this.app.history.saveState('line_api');

            // Override color if provided
            const origColor = this.app.foregroundColor;
            if (params.color) this.app.foregroundColor = params.color;
            if (params.width) this.lineWidth = params.width;

            this.drawLine(layer.ctx, params.start[0], params.start[1], params.end[0], params.end[1]);

            if (params.color) this.app.foregroundColor = origColor;

            this.app.renderer.requestRender();
            return { success: true };
        }
        return { success: false, error: 'Invalid action or params' };
    }

    getProperties() {
        return [
            { id: 'lineWidth', name: 'Width', type: 'range', min: 1, max: 50, step: 1, value: this.lineWidth }
        ];
    }
}
