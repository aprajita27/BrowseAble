document.addEventListener('DOMContentLoaded', function () {
    const neurotypesInfo = {
        'adhd': 'Makes content easier to focus on with bullet points, highlights, and clear structure.',
        'autism': 'Presents information in a clear, literal, and predictable way without ambiguity.',
        'blind': 'Optimizes content for screen readers with better descriptions and linear flow.',
        'sensory': 'Creates a calmer reading experience by reducing visual intensity and sensory triggers.'
    };

    const neurotype = document.getElementById('neurotype');
    const description = document.getElementById('description');
    const applyBtn = document.getElementById('apply');
    const preview = document.getElementById('preview');

    // Update the description and preview when neurotype changes
    neurotype.addEventListener('change', function () {
        description.textContent = neurotypesInfo[neurotype.value];
        preview.className = `mode-preview ${neurotype.value}`;
    });

    // Apply button click handler
    applyBtn.addEventListener('click', function () {
        // Add visual feedback
        applyBtn.textContent = 'Simplifying...';
        applyBtn.disabled = true;

        // Send message to update neurotype
        chrome.runtime.sendMessage({
            type: 'updateNeurotype',
            neurotype: neurotype.value
        }, function (response) {
            console.log('Neurotype updated:', response);

            // Trigger page reprocessing on the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'reprocessPage',
                        neurotype: neurotype.value
                    });

                    // Visual feedback
                    applyBtn.textContent = 'Applied!';
                    setTimeout(() => {
                        applyBtn.textContent = 'Simplify Current Page';
                        applyBtn.disabled = false;
                    }, 2000);
                }
            });
        });
    });

    // Load current setting
    chrome.runtime.sendMessage({ type: 'getNeurotype' }, function (response) {
        if (response && response.neurotype) {
            neurotype.value = response.neurotype;
            description.textContent = neurotypesInfo[response.neurotype];
            preview.className = `mode-preview ${response.neurotype}`;
        }
    });
});