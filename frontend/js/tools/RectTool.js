/**
 * RectTool - Draw rectangles and squares.
 */
import { Tool } from './Tool.js';

export class RectTool extends Tool {
    static id = 'rect';
    static name = 'Rectangle';
    static icon = 'rect';
    static shortcut = 'r';
    static cursor = 'crosshair';

    constructor(app) {
        super(app);
        this.fill = true;
        this.stroke = true;
        this.strokeWidth = 2;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;

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
        this.app.history.saveState('rect');
    }

    onMouseMove(e, x, y) {
        if (!this.isDrawing) return;

        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.drawRect(this.previewCtx, this.startX, this.startY, x, y, e.shiftKey);
        this.app.renderer.setPreviewLayer(this.previewCanvas);
    }

    onMouseUp(e, x, y) {
        if (!this.isDrawing) return;

        const layer = this.app.layerStack.getActiveLayer();
        if (layer && !layer.locked) {
            this.drawRect(layer.ctx, this.startX, this.startY, x, y, e.shiftKey);
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

    drawRect(ctx, x1, y1, x2, y2, constrain = false, options = {}) {
        let width = x2 - x1;
        let height = y2 - y1;

        // Constrain to square if shift held
        if (constrain) {
            const size = Math.max(Math.abs(width), Math.abs(height));
            width = Math.sign(width) * size || size;
            height = Math.sign(height) * size || size;
        }

        const fillColor = options.fillColor || this.app.foregroundColor || '#000000';
        const strokeColor = options.strokeColor || this.app.backgroundColor || '#FFFFFF';
        const doFill = options.fill !== undefined ? options.fill : this.fill;
        const doStroke = options.stroke !== undefined ? options.stroke : this.stroke;
        const strokeW = options.strokeWidth || this.strokeWidth;

        ctx.beginPath();
        ctx.rect(x1, y1, width, height);

        if (doFill) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        if (doStroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.stroke();
        }
    }

    // API execution method
    executeAction(action, params) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return { success: false, error: 'No active layer' };

        if (action === 'draw') {
            // Support both start/end and x/y/width/height formats
            let x1, y1, x2, y2;
            if (params.start && params.end) {
                x1 = params.start[0];
                y1 = params.start[1];
                x2 = params.end[0];
                y2 = params.end[1];
            } else if (params.x !== undefined && params.y !== undefined && params.width !== undefined && params.height !== undefined) {
                x1 = params.x;
                y1 = params.y;
                x2 = params.x + params.width;
                y2 = params.y + params.height;
            } else {
                return { success: false, error: 'Need start/end or x/y/width/height' };
            }

            this.app.history.saveState('rect_api');
            this.drawRect(layer.ctx, x1, y1, x2, y2, false, {
                fillColor: params.fillColor || params.color,
                strokeColor: params.strokeColor,
                fill: params.fill !== undefined ? params.fill : true,
                stroke: params.stroke !== undefined ? params.stroke : false,
                strokeWidth: params.strokeWidth,
            });

            this.app.renderer.requestRender();
            return { success: true };
        }
        return { success: false, error: 'Invalid action' };
    }

    getProperties() {
        return [
            { id: 'fill', name: 'Fill', type: 'checkbox', value: this.fill },
            { id: 'stroke', name: 'Stroke', type: 'checkbox', value: this.stroke },
            { id: 'strokeWidth', name: 'Stroke Width', type: 'range', min: 1, max: 50, step: 1, value: this.strokeWidth }
        ];
    }
}
