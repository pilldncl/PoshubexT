// TrackHub Chrome Extension - Content Script
class TrackHubContent {
    constructor() {
        this.trackingNumbers = [];
        this.isInitialized = false;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        try {
            // Check if auto-detect is enabled
            const settings = await this.getSettings();
            if (!settings.autoDetectTracking) return;

            // Scan page for tracking numbers
            await this.scanPageForTrackingNumbers();
            
            // Add visual indicators for found tracking numbers
            this.addTrackingIndicators();
            
            // Setup click handlers
            this.setupClickHandlers();
            
            this.isInitialized = true;
        } catch (error) {
            console.error('TrackHub content script initialization error:', error);
        }
    }

    async getSettings() {
        try {
            const result = await chrome.storage.local.get([
                'autoDetectTracking',
                'enableQuickAdd',
                'enableNotifications'
            ]);
            return result;
        } catch (error) {
            console.error('Error getting settings:', error);
            return {
                autoDetectTracking: true,
                enableQuickAdd: true,
                enableNotifications: true
            };
        }
    }

    async scanPageForTrackingNumbers() {
        try {
            // Get all text content from the page
            const textContent = document.body.innerText;
            
            // Define tracking number patterns
            const patterns = [
                // UPS patterns
                { pattern: /1Z[0-9A-Z]{16}/g, brand: 'ups' },
                { pattern: /\b[0-9]{10,}\b/g, brand: 'ups' },
                
                // FedEx patterns
                { pattern: /\b[0-9]{12}\b/g, brand: 'fedex' },
                { pattern: /\b[0-9]{14}\b/g, brand: 'fedex' },
                
                // USPS patterns
                { pattern: /[A-Z]{2}[0-9]{9}[A-Z]{2}/g, brand: 'usps' },
                { pattern: /[0-9]{4}\s[0-9]{4}\s[0-9]{4}\s[0-9]{4}/g, brand: 'usps' },
                
                // DHL patterns
                { pattern: /\b[0-9]{10,11}\b/g, brand: 'dhl' },
                
                // Amazon patterns
                { pattern: /TBA[0-9]{10}/g, brand: 'amazon' },
                
                // Generic patterns
                { pattern: /\b[A-Z0-9]{8,20}\b/g, brand: 'other' }
            ];

            this.trackingNumbers = [];

            patterns.forEach(({ pattern, brand }) => {
                const matches = textContent.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        if (this.isValidTrackingNumber(match)) {
                            this.trackingNumbers.push({
                                number: match.trim(),
                                brand: brand,
                                element: this.findElementContainingText(match)
                            });
                        }
                    });
                }
            });

            // Remove duplicates
            this.trackingNumbers = this.trackingNumbers.filter((item, index, self) => 
                index === self.findIndex(t => t.number === item.number)
            );

            console.log('TrackHub found tracking numbers:', this.trackingNumbers);
        } catch (error) {
            console.error('Error scanning page for tracking numbers:', error);
        }
    }

    isValidTrackingNumber(text) {
        // Additional validation to avoid false positives
        const number = text.trim();
        
        // Must be at least 8 characters
        if (number.length < 8) return false;
        
        // Must not be just numbers (avoid phone numbers, dates, etc.)
        if (/^[0-9]+$/.test(number) && number.length < 10) return false;
        
        // Must not be common non-tracking patterns
        const excludePatterns = [
            /^\d{4}-\d{2}-\d{2}$/, // Dates
            /^\d{3}-\d{3}-\d{4}$/, // Phone numbers
            /^\d{5}$/, // ZIP codes
            /^[A-Z]{2}\d{2}$/ // State codes
        ];
        
        return !excludePatterns.some(pattern => pattern.test(number));
    }

    findElementContainingText(text) {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes(text)) {
                return node.parentElement;
            }
        }
        return null;
    }

    addTrackingIndicators() {
        this.trackingNumbers.forEach(({ number, brand, element }) => {
            if (element && !element.hasAttribute('data-trackhub-processed')) {
                this.highlightTrackingNumber(element, number, brand);
                element.setAttribute('data-trackhub-processed', 'true');
            }
        });
    }

    highlightTrackingNumber(element, number, brand) {
        try {
            // Create highlight wrapper
            const wrapper = document.createElement('span');
            wrapper.className = 'trackhub-highlight';
            wrapper.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.9em;
                margin: 0 2px;
                display: inline-block;
                transition: all 0.3s ease;
                position: relative;
            `;

            // Add hover effect
            wrapper.addEventListener('mouseenter', () => {
                wrapper.style.transform = 'scale(1.05)';
                wrapper.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
            });

            wrapper.addEventListener('mouseleave', () => {
                wrapper.style.transform = 'scale(1)';
                wrapper.style.boxShadow = 'none';
            });

            // Add click handler
            wrapper.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleTrackingClick(number, brand);
            });

            // Replace text content
            const textNode = Array.from(element.childNodes).find(node => 
                node.nodeType === Node.TEXT_NODE && node.textContent.includes(number)
            );

            if (textNode) {
                const newText = textNode.textContent.replace(number, '');
                const beforeText = newText.substring(0, newText.indexOf(number));
                const afterText = newText.substring(newText.indexOf(number) + number.length);
                
                wrapper.textContent = number;
                
                if (beforeText) {
                    element.insertBefore(document.createTextNode(beforeText), textNode);
                }
                element.insertBefore(wrapper, textNode);
                if (afterText) {
                    element.insertBefore(document.createTextNode(afterText), textNode);
                }
                element.removeChild(textNode);
            }
        } catch (error) {
            console.error('Error highlighting tracking number:', error);
        }
    }

    setupClickHandlers() {
        // Add global click handler for tracking numbers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('trackhub-highlight')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    async handleTrackingClick(number, brand) {
        try {
            // Check if user is logged in
            const result = await chrome.storage.local.get(['isLoggedIn']);
            if (!result.isLoggedIn) {
                this.showQuickLoginPrompt();
                return;
            }

            // Show quick add dialog
            this.showQuickAddDialog(number, brand);
        } catch (error) {
            console.error('Error handling tracking click:', error);
        }
    }

    showQuickLoginPrompt() {
        const dialog = this.createDialog(
            'Login Required',
            'Please login to TrackHub to add tracking numbers.',
            [
                { text: 'Open TrackHub', action: () => this.openTrackHub() },
                { text: 'Cancel', action: () => dialog.remove() }
            ]
        );
        document.body.appendChild(dialog);
    }

    showQuickAddDialog(number, brand) {
        const dialog = this.createDialog(
            'Add to TrackHub',
            `Add tracking number: ${number}`,
            [
                { 
                    text: 'Add', 
                    action: () => {
                        this.addTrackingQuickly(number, brand);
                        dialog.remove();
                    }
                },
                { text: 'Cancel', action: () => dialog.remove() }
            ]
        );
        document.body.appendChild(dialog);
    }

    createDialog(title, message, buttons) {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            padding: 20px;
            z-index: 10000;
            min-width: 300px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">${title}</h3>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                ${buttons.map(btn => 
                    `<button style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        ${btn.text === 'Add' ? 'background: #667eea; color: white;' : 'background: #f0f0f0; color: #333;'}
                    ">${btn.text}</button>`
                ).join('')}
            </div>
        `;

        // Add button event listeners
        const buttonElements = dialog.querySelectorAll('button');
        buttons.forEach((btn, index) => {
            buttonElements[index].addEventListener('click', btn.action);
        });

        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
        `;
        backdrop.addEventListener('click', () => dialog.remove());
        document.body.appendChild(backdrop);

        return dialog;
    }

    async addTrackingQuickly(number, brand) {
        try {
            const trackingData = {
                id: Date.now().toString(),
                trackingNumber: number,
                brand: brand,
                description: `Quick add from ${document.title}`,
                dateAdded: new Date().toISOString(),
                status: 'pending'
            };

            // Send to background script
            chrome.runtime.sendMessage({
                action: 'quickAddTracking',
                data: trackingData
            });

            // Show success message
            this.showSuccessMessage('Tracking added to TrackHub!');
        } catch (error) {
            console.error('Error adding tracking quickly:', error);
        }
    }

    showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10001;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    openTrackHub() {
        chrome.runtime.sendMessage({ action: 'openTrackHub' });
    }
}

// Initialize content script
new TrackHubContent();
