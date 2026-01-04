document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const portals = document.querySelectorAll('.portal');

    // Embed Elements
    const embedDropzone = document.getElementById('embed-dropzone');
    const embedInput = document.getElementById('embed-file-input');
    const embedPreviewContainer = document.getElementById('embed-preview-container');
    const embedPreview = document.getElementById('embed-preview');
    const embedRemoveBtn = document.getElementById('embed-remove-btn');
    const secretInput = document.getElementById('secret-text');
    const embedBtn = document.getElementById('embed-btn');

    // Verify Elements
    const verifyDropzone = document.getElementById('verify-dropzone');
    const verifyInput = document.getElementById('verify-file-input');
    const verifyPreviewContainer = document.getElementById('verify-preview-container');
    const verifyPreview = document.getElementById('verify-preview');
    const verifyRemoveBtn = document.getElementById('verify-remove-btn');
    const verifyBtn = document.getElementById('verify-btn');
    const verifyResult = document.getElementById('verify-result');

    const API_URL = 'http://localhost:5000/api';

    // --- State ---
    let embedFile = null;
    let verifyFile = null;

    // --- Tabs ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            portals.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- Drag & Drop Generic Logic ---
    function setupDragAndDrop(dropzone, input, onFileSelect) {
        dropzone.addEventListener('click', () => input.click());

        input.addEventListener('change', (e) => {
            if (e.target.files.length) {
                onFileSelect(e.target.files[0]);
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                onFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // --- Embed Logic ---
    setupDragAndDrop(embedDropzone, embedInput, (file) => {
        if (!file.type.match('image.*')) {
            showToast('Only image files are allowed.', 'error');
            return;
        }
        embedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            embedPreview.src = e.target.result;
            embedPreviewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    });

    embedRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        embedFile = null;
        embedInput.value = '';
        embedPreview.src = '';
        embedPreviewContainer.style.display = 'none';
    });

    embedBtn.addEventListener('click', async () => {
        if (!embedFile) {
            showToast('Please select an image first.', 'error');
            return;
        }
        const text = secretInput.value.trim();
        if (!text) {
            showToast('Please enter a secret signature.', 'error');
            return;
        }

        setLoading(embedBtn, true);

        const formData = new FormData();
        formData.append('image', embedFile);
        formData.append('text', text);

        try {
            const response = await fetch(`${API_URL}/embed`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to embed text');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'secure-image.png'; // Enforce PNG
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showToast('Watermark embedded successfully! Download started.');
            secretInput.value = ''; // clear secret
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(embedBtn, false);
        }
    });

    // --- Verify Logic ---
    setupDragAndDrop(verifyDropzone, verifyInput, (file) => {
        if (!file.type.match('image.*')) {
            showToast('Only image files are allowed.', 'error');
            return;
        }
        verifyFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            verifyPreview.src = e.target.result;
            verifyPreviewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
        verifyResult.style.display = 'none'; // reset previous result
    });

    verifyRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        verifyFile = null;
        verifyInput.value = '';
        verifyPreview.src = '';
        verifyPreviewContainer.style.display = 'none';
        verifyResult.style.display = 'none';
    });

    verifyBtn.addEventListener('click', async () => {
        if (!verifyFile) {
            showToast('Please upload an image to scan.', 'error');
            return;
        }

        setLoading(verifyBtn, true);

        const formData = new FormData();
        formData.append('image', verifyFile);

        try {
            const response = await fetch(`${API_URL}/extract`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract watermark');
            }

            verifyResult.style.display = 'block';
            if (data.found) {
                verifyResult.className = 'result-card success';
                verifyResult.innerHTML = `
                    <span class="label-text">Watermark Found:</span>
                    <strong>${escapeHtml(data.text)}</strong>
                `;
            } else {
                verifyResult.className = 'result-card error';
                verifyResult.innerHTML = `
                     <span class="label-text">Status:</span>
                     <strong>${data.message}</strong>
                `;
            }

        } catch (error) {
            showToast(error.message, 'error');
            verifyResult.style.display = 'none';
        } finally {
            setLoading(verifyBtn, false);
        }
    });

    function setLoading(btn, isLoading) {
        const span = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.loader');
        if (isLoading) {
            btn.disabled = true;
            span.style.display = 'none';
            loader.style.display = 'inline-block';
        } else {
            btn.disabled = false;
            span.style.display = 'inline-block';
            loader.style.display = 'none';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
