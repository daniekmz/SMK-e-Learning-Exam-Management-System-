async function generateLinkPreview(url) {
    try {
        const data = await linkPreviewJs.getLinkPreview(url);
        return {
            title: data.title || 'No title',
            description: data.description || 'No description',
            image: data.images ? data.images[0] : null,
            domain: data.url ? new URL(data.url).hostname : ''
        };
    } catch (error) {
        console.error('Error generating link preview:', error);
        return null;
    }
}

function createLinkPreviewElement(previewData) {
    const previewElement = document.createElement('div');
    previewElement.className = 'link-preview';
    
    let html = `
        <div class="link-preview-content">
            <div class="link-preview-text">
                <div class="link-preview-domain">${previewData.domain}</div>
                <h4 class="link-preview-title">${previewData.title}</h4>
                <p class="link-preview-description">${previewData.description}</p>
            </div>
    `;
    
    if (previewData.image) {
        html += `
            <div class="link-preview-image">
                <img src="${previewData.image}" alt="${previewData.title}">
            </div>
        `;
    }
    
    html += `</div>`;
    previewElement.innerHTML = html;
    return previewElement;
}

// Fungsi untuk memproses link dalam teks
function processLinksInText(textElement) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const text = textElement.textContent;
    const matches = text.match(urlRegex);
    
    if (!matches) return;
    
    let newHtml = text;
    
    matches.forEach(async url => {
        const previewData = await generateLinkPreview(url);
        if (previewData) {
            const previewElement = createLinkPreviewElement(previewData);
            newHtml = newHtml.replace(url, previewElement.outerHTML);
            textElement.innerHTML = newHtml;
        }
    });
}