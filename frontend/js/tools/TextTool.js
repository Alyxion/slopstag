/**
 * TextTool - Add text to the canvas.
 */
import { Tool } from './Tool.js';

export class TextTool extends Tool {
    static id = 'text';
    static name = 'Text';
    static icon = 'text';
    static shortcut = 't';
    static cursor = 'text';

    constructor(app) {
        super(app);

        // Text properties
        this.fontSize = 24;
        this.fontFamily = 'Arial';
        this.fontWeight = 'normal';
        this.fontStyle = 'normal';
        this.textAlign = 'left';

        // State
        this.isEditing = false;
        this.textX = 0;
        this.textY = 0;
        this.currentText = '';

        // Input element for text entry
        this.inputElement = null;
    }

    onMouseDown(e, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        // If already editing, commit the text
        if (this.isEditing) {
            this.commitText();
        }

        // Start new text entry
        this.textX = x;
        this.textY = y;
        this.showTextInput(x, y);
    }

    showTextInput(x, y) {
        // Remove existing input
        if (this.inputElement) {
            this.inputElement.remove();
        }

        // Convert canvas coords to screen coords
        const screenPos = this.app.renderer.canvasToScreen(x, y);

        // Create input element
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.style.cssText = `
            position: fixed;
            left: ${screenPos.x}px;
            top: ${screenPos.y - this.fontSize}px;
            font-size: ${this.fontSize * this.app.renderer.zoom}px;
            font-family: ${this.fontFamily};
            font-weight: ${this.fontWeight};
            font-style: ${this.fontStyle};
            color: ${this.app.foregroundColor};
            background: rgba(255,255,255,0.9);
            border: 1px solid #0078d4;
            outline: none;
            padding: 2px 4px;
            min-width: 100px;
            z-index: 10000;
        `;

        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.commitText();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelText();
            }
        });

        this.inputElement.addEventListener('blur', () => {
            // Small delay to allow click events to process
            setTimeout(() => {
                if (this.isEditing) {
                    this.commitText();
                }
            }, 100);
        });

        document.body.appendChild(this.inputElement);
        this.inputElement.focus();
        this.isEditing = true;
    }

    commitText() {
        if (!this.inputElement) return;

        const text = this.inputElement.value.trim();
        if (text) {
            this.drawText(text, this.textX, this.textY);
        }

        this.cleanup();
    }

    cancelText() {
        this.cleanup();
    }

    cleanup() {
        if (this.inputElement) {
            this.inputElement.remove();
            this.inputElement = null;
        }
        this.isEditing = false;
        this.currentText = '';
    }

    drawText(text, x, y) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) return;

        this.app.history.saveState('text');

        const ctx = layer.ctx;
        ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        ctx.fillStyle = this.app.foregroundColor || '#000000';
        ctx.textAlign = this.textAlign;
        ctx.textBaseline = 'top';

        ctx.fillText(text, x, y);

        this.app.renderer.requestRender();
    }

    deactivate() {
        super.deactivate();
        if (this.isEditing) {
            this.commitText();
        }
    }

    getProperties() {
        return [
            { id: 'fontSize', name: 'Size', type: 'range', min: 8, max: 200, step: 1, value: this.fontSize },
            { id: 'fontFamily', name: 'Font', type: 'select', options: ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS'], value: this.fontFamily },
            { id: 'fontWeight', name: 'Weight', type: 'select', options: ['normal', 'bold'], value: this.fontWeight },
            { id: 'fontStyle', name: 'Style', type: 'select', options: ['normal', 'italic'], value: this.fontStyle }
        ];
    }

    // API execution
    executeAction(action, params) {
        const layer = this.app.layerStack.getActiveLayer();
        if (!layer || layer.locked) {
            return { success: false, error: 'No active layer or layer is locked' };
        }

        if (action === 'draw' || action === 'write') {
            const text = params.text;
            if (!text) {
                return { success: false, error: 'No text provided' };
            }

            const x = params.x !== undefined ? params.x : 0;
            const y = params.y !== undefined ? params.y : 0;

            // Apply optional parameters
            if (params.fontSize !== undefined) this.fontSize = params.fontSize;
            if (params.fontFamily) this.fontFamily = params.fontFamily;
            if (params.fontWeight) this.fontWeight = params.fontWeight;
            if (params.fontStyle) this.fontStyle = params.fontStyle;
            if (params.color) this.app.foregroundColor = params.color;
            if (params.textAlign) this.textAlign = params.textAlign;

            this.drawText(text, x, y);
            return { success: true };
        }

        return { success: false, error: `Unknown action: ${action}` };
    }
}
