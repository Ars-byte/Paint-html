/* --- CONFIGURACIÓN Y ESTADO --- */
const CONFIG = {
    colors: [
        "#11111b", "#f38ba8", "#fab387", "#f9e2af", 
        "#a6e3a1", "#94e2d5", "#89b4fa", "#cba6f7", 
        "#f5c2e7", "#f2cdcd"
    ],
    maxHistory: 20 // Límite de pasos para deshacer (ahorra memoria)
};

const state = {
    isDrawing: false,
    tool: 'brush',      // 'brush', 'bucket', 'eraser'
    color: '#11111b',
    size: 5,
    history: []         // Pila para guardar estados (Undo)
};

// Referencias DOM
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const wrapper = document.getElementById('canvas-wrapper');

/* --- APLICACIÓN PRINCIPAL (Objeto "app") --- */
const app = {
    init() {
        this.resizeCanvas();
        this.renderPalette();
        this.addEventListeners();
    },

    resizeCanvas() {
        canvas.width = wrapper.clientWidth - 40;
        canvas.height = wrapper.clientHeight - 40;
        this.clearCanvas(false); // Reinicia a blanco
        state.history = []; // Limpiar historial al redimensionar
    },

    renderPalette() {
        const container = document.getElementById('preset-colors');
        CONFIG.colors.forEach(color => {
            const div = document.createElement('div');
            div.className = 'color-dot';
            div.style.backgroundColor = color;
            div.onclick = () => this.setColor(color);
            container.appendChild(div);
        });
    },

    // --- ACCIONES DE ESTADO ---
    
    saveState() {
        // Guardamos el estado actual antes de modificarlo
        if (state.history.length >= CONFIG.maxHistory) {
            state.history.shift(); // Eliminar el más antiguo si llenamos la memoria
        }
        state.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    },

    undo() {
        if (state.history.length === 0) return;
        const lastState = state.history.pop();
        ctx.putImageData(lastState, 0, 0);
    },

    // --- HERRAMIENTAS ---

    setTool(toolName) {
        state.tool = toolName;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`btn-${toolName}`).classList.add('active');
    },

    setColor(newColor) {
        state.color = newColor;
        document.getElementById('color-picker').value = newColor;
        
        if (state.tool === 'eraser') this.setTool('brush');

        document.querySelectorAll('.color-dot').forEach(dot => {
            dot.classList.remove('active');
            if (this.rgbMatch(dot.style.backgroundColor, newColor)) {
                dot.classList.add('active');
            }
        });
    },

    setSize(val) {
        state.size = parseInt(val);
        document.getElementById('size-val').innerText = val;
    },

    clearCanvas(confirmar = true) {
        if (!confirmar || confirm("¿Borrar todo el dibujo?")) {
            this.saveState(); // Guardar antes de borrar para poder deshacer
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    },

    saveCanvas() {
        const link = document.createElement('a');
        link.download = `dibujo-arsbyte-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    },

    // --- LÓGICA DE DIBUJO ---

    startDraw(x, y) {
        if (state.tool === 'bucket') {
            this.saveState(); // Guardar antes de rellenar
            this.floodFill(x, y);
            return;
        }
        
        this.saveState(); // Guardar antes de empezar el trazo
        state.isDrawing = true;
        
        ctx.beginPath();
        ctx.lineWidth = state.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = (state.tool === 'eraser') ? '#ffffff' : state.color;
        
        // Mover al punto inicial y dibujar un punto
        ctx.moveTo(x, y);
        ctx.lineTo(x, y); 
        ctx.stroke();
    },

    draw(x, y) {
        if (!state.isDrawing) return;
        ctx.lineTo(x, y);
        ctx.stroke();
    },

    stopDraw() {
        if (state.isDrawing) {
            state.isDrawing = false;
            ctx.beginPath();
        }
    },

    // --- ALGORITMO FLOOD FILL ---
    floodFill(startX, startY) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        const targetColor = this.getPixel(data, startX, startY);
        const fillColor = this.hexToRgba(state.color);

        if (this.colorsMatch(targetColor, fillColor)) return;

        const stack = [[startX, startY]];
        const w = canvas.width;
        const h = canvas.height;

        while (stack.length) {
            const [x, y] = stack.pop();
            const idx = (y * w + x) * 4;

            if (x < 0 || x >= w || y < 0 || y >= h) continue;
            if (!this.matches(data, idx, targetColor)) continue;

            // Pintar pixel
            data[idx] = fillColor[0];
            data[idx+1] = fillColor[1];
            data[idx+2] = fillColor[2];
            data[idx+3] = 255;

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        ctx.putImageData(imgData, 0, 0);
    },

    // --- UTILIDADES ---
    addEventListeners() {
        // Mouse
        canvas.addEventListener('mousedown', e => this.handleInputStart(e));
        canvas.addEventListener('mousemove', e => this.handleInputMove(e));
        canvas.addEventListener('mouseup', () => this.stopDraw());
        canvas.addEventListener('mouseleave', () => this.stopDraw());

        // Touch (Móviles)
        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.handleInputStart(e.touches[0]);
        }, {passive: false});

        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.handleInputMove(e.touches[0]);
        }, {passive: false});
        
        canvas.addEventListener('touchend', () => this.stopDraw());
    },

    handleInputStart(e) {
        const rect = canvas.getBoundingClientRect();
        this.startDraw(Math.floor(e.clientX - rect.left), Math.floor(e.clientY - rect.top));
    },

    handleInputMove(e) {
        const rect = canvas.getBoundingClientRect();
        this.draw(e.clientX - rect.left, e.clientY - rect.top);
    },

    // Helpers de Colores y Pixeles
    getPixel(data, x, y) {
        const idx = (y * canvas.width + x) * 4;
        return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
    },
    matches(data, idx, target) {
        return data[idx] === target[0] && data[idx+1] === target[1] &&
               data[idx+2] === target[2] && data[idx+3] === target[3];
    },
    colorsMatch(c1, c2) {
        return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2];
    },
    hexToRgba(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b, 255];
    },
    rgbMatch(rgbStr, hex) {
        // Comparación simple entre "rgb(r,g,b)" y "#hex"
        const c = this.hexToRgba(hex);
        return rgbStr === `rgb(${c[0]}, ${c[1]}, ${c[2]})` || 
               rgbStr === `rgba(${c[0]}, ${c[1]}, ${c[2]}, 1)`; // A veces computa rgba
    }
};

// Iniciar app
window.addEventListener('load', () => app.init());
