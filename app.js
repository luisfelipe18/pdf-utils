// Configurar PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let currentPdfBytes = null;
let pdfDocument = null;
let originalFileName = "";

// DOM Elements
const pdfInput = document.getElementById('pdfInput');
const fileNameDisplay = document.getElementById('fileName');
const nextBtn = document.getElementById('nextBtn');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const backBtn = document.getElementById('backBtn');
const processBtn = document.getElementById('processBtn');
const previewCanvas = document.getElementById('previewCanvas');
const previewNumber = document.getElementById('previewNumber');
const colorPicker = document.getElementById('colorPicker');
const fontSizeInput = document.getElementById('fontSize');
const reversePagesCheckbox = document.getElementById('reversePages');
const orderNormalRadio = document.getElementById('orderNormal');
const orderReverseRadio = document.getElementById('orderReverse');

// Helper to pad number
const padZero = (num) => num.toString().padStart(3, '0');

// Event Listeners
pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        originalFileName = file.name;
        fileNameDisplay.textContent = originalFileName;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            currentPdfBytes = e.target.result;
            try {
                // Load for preview using pdf.js
                pdfDocument = await pdfjsLib.getDocument({ data: currentPdfBytes }).promise;
                nextBtn.disabled = false;
            } catch (err) {
                console.error("Error cargando PDF para previsualización", err);
                alert("Error cargando el PDF. Asegúrate de que no esté corrupto o protegido con contraseña.");
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        fileNameDisplay.textContent = 'Ningún archivo seleccionado o formato inválido.';
        nextBtn.disabled = true;
    }
});

nextBtn.addEventListener('click', async () => {
    step1.classList.remove('active');
    step2.classList.add('active');
    await renderPreview();
    updatePreviewNumber();
});

backBtn.addEventListener('click', () => {
    step2.classList.remove('active');
    step1.classList.add('active');
});

colorPicker.addEventListener('input', (e) => {
    previewNumber.style.color = e.target.value;
});

fontSizeInput.addEventListener('input', async () => {
    await renderPreview();
});

orderNormalRadio.addEventListener('change', updatePreviewNumber);
orderReverseRadio.addEventListener('change', updatePreviewNumber);
reversePagesCheckbox.addEventListener('change', async () => {
    updatePreviewNumber();
    await renderPreview();
});

function updatePreviewNumber() {
    if (!pdfDocument) return;
    
    let totalPages = pdfDocument.numPages;
    let isReverseNumbering = orderReverseRadio.checked;
    
    let numberToDisplay = 1;
    
    if (isReverseNumbering) {
        numberToDisplay = totalPages;
    } else {
        numberToDisplay = 1;
    }
    
    previewNumber.textContent = padZero(numberToDisplay);
}

async function renderPreview() {
    if (!pdfDocument) return;
    
    // Si se invierten las páginas, la "primera" visualmente es la última original
    let pageNum = reversePagesCheckbox.checked ? pdfDocument.numPages : 1;
    
    const page = await pdfDocument.getPage(pageNum);
    
    // Un viewport base
    let viewport = page.getViewport({ scale: 1.0 });
    
    // Adaptar escala al contenedor
    const container = document.getElementById('canvasContainer');
    const containerWidth = container.clientWidth;
    // Dar un poco de margen si es muy grande
    const scale = containerWidth / viewport.width;
    const finalScale = scale > 1 ? 1 : scale; // No agrandar más del 100%
    
    viewport = page.getViewport({ scale: finalScale });

    previewCanvas.width = viewport.width;
    previewCanvas.height = viewport.height;

    const ctx = previewCanvas.getContext('2d');
    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };

    await page.render(renderContext).promise;
    
    // Posicionar el número simulando los 20 puntos de margen superior y derecho
    // Escalar la posición
    const padding = 20 * finalScale;
    previewNumber.style.top = `${padding}px`;
    previewNumber.style.right = `${padding}px`;
    // Escalar también el tamaño de la fuente para la previsualización para que sea proporcional
    const fontSize = parseInt(fontSizeInput.value, 10) || 24;
    previewNumber.style.fontSize = `${fontSize * finalScale}px`;
}

// Hex a RGB normalizado (0 a 1) para pdf-lib
function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

processBtn.addEventListener('click', async () => {
    try {
        processBtn.classList.add('processing');
        processBtn.disabled = true;

        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        // Cargar PDF original en pdf-lib
        let pdfDoc = await PDFDocument.load(currentPdfBytes);
        
        const isReverseNumbering = orderReverseRadio.checked;
        const isReversePages = reversePagesCheckbox.checked;
        const colorHex = colorPicker.value;
        const color = hexToRgb(colorHex);
        
        // 1. Invertir el orden de las páginas en el documento si está marcado
        if (isReversePages) {
            const reversedDoc = await PDFDocument.create();
            // indices de atrás para adelante
            const pageIndices = Array.from({length: pdfDoc.getPageCount()}, (_, i) => pdfDoc.getPageCount() - 1 - i);
            const copiedPages = await reversedDoc.copyPages(pdfDoc, pageIndices);
            copiedPages.forEach(p => reversedDoc.addPage(p));
            pdfDoc = reversedDoc; // Trabajar con el documento invertido
        }
        
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const totalPages = pages.length;
        
        // 2. Aplicar foleado
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            
            // Lógica de numeración:
            // Si es normal: la primera página del pdfDoc actual es 1
            // Si es inverso: la primera página del pdfDoc actual es totalPages
            let num = isReverseNumbering ? (totalPages - i) : (i + 1);
            let text = padZero(num);
            
            const fontSize = parseInt(fontSizeInput.value, 10) || 24;
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            
            // Dibujar texto en la esquina superior derecha
            // (0,0) está en la esquina inferior izquierda en pdf-lib
            page.drawText(text, {
                x: width - textWidth - 20,
                y: height - 20 - fontSize + (fontSize * 0.25), // Ajuste baseline
                size: fontSize,
                font: font,
                color: rgb(color.r, color.g, color.b),
            });
        }
        
        // Guardar y descargar
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        let prefix = isReversePages ? "inv_" : "";
        link.download = `foleado_${prefix}${originalFileName}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (e) {
        console.error(e);
        alert("Hubo un error procesando el PDF.");
    } finally {
        processBtn.classList.remove('processing');
        processBtn.disabled = false;
    }
});
