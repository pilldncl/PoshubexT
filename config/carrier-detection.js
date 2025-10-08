// Enhanced Carrier Detection Service
// Detects carriers from tracking numbers, DOM content, and website context

export class CarrierDetectionService {
  constructor() {
    this.carrierPatterns = this.initializeCarrierPatterns();
    this.websiteCarrierMappings = this.initializeWebsiteMappings();
    this.domSelectors = this.initializeDOMSelectors();
  }

  initializeCarrierPatterns() {
    return {
      ups: [
        { pattern: /^1Z[0-9A-Z]{16}$/, confidence: 'high' },
        { pattern: /^[0-9]{10,}$/, confidence: 'medium' },
        { pattern: /^T[0-9]{10}$/, confidence: 'high' }
      ],
      fedex: [
        { pattern: /^[0-9]{12}$/, confidence: 'high' },
        { pattern: /^[0-9]{14}$/, confidence: 'high' },
        { pattern: /^[0-9]{15}$/, confidence: 'high' },
        { pattern: /^[0-9]{20}$/, confidence: 'high' }
      ],
      usps: [
        { pattern: /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/, confidence: 'high' },
        { pattern: /^[0-9]{4}\s[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/, confidence: 'high' },
        { pattern: /^[0-9]{20,22}$/, confidence: 'medium' },
        { pattern: /^[A-Z]{2}[0-9]{9}US$/, confidence: 'high' }
      ],
      dhl: [
        { pattern: /^[0-9]{10,11}$/, confidence: 'medium' },
        { pattern: /^[0-9]{12}$/, confidence: 'medium' },
        { pattern: /^[0-9]{14}$/, confidence: 'medium' }
      ],
      amazon: [
        { pattern: /^TBA[0-9]{10}$/, confidence: 'high' },
        { pattern: /^TBA[0-9]{12}$/, confidence: 'high' },
        { pattern: /^[0-9]{3}-[0-9]{7}-[0-9]{7}$/, confidence: 'high' }
      ],
      ontrac: [
        { pattern: /^[0-9]{12}$/, confidence: 'low' },
        { pattern: /^[A-Z]{2}[0-9]{8}$/, confidence: 'medium' }
      ],
      lasership: [
        { pattern: /^[0-9]{12}$/, confidence: 'low' },
        { pattern: /^[A-Z]{2}[0-9]{8}$/, confidence: 'medium' }
      ]
    };
  }

  initializeWebsiteMappings() {
    return {
      'ups.com': 'ups',
      'fedex.com': 'fedex',
      'usps.com': 'usps',
      'dhl.com': 'dhl',
      'amazon.com': 'amazon',
      'ontrac.com': 'ontrac',
      'lasership.com': 'lasership',
      'track.ups.com': 'ups',
      'www.fedex.com': 'fedex',
      'tools.usps.com': 'usps',
      'webtrack.dhl.com': 'dhl'
    };
  }

  initializeDOMSelectors() {
    return {
      // Common selectors for carrier information on tracking pages
      carrierSelectors: [
        '[class*="carrier"]',
        '[class*="shipping"]',
        '[class*="delivery"]',
        '[class*="tracking"]',
        '[id*="carrier"]',
        '[id*="shipping"]',
        '[id*="delivery"]',
        '[id*="tracking"]',
        '.carrier-name',
        '.shipping-carrier',
        '.delivery-service',
        '.tracking-carrier'
      ],
      // Selectors for tracking numbers
      trackingSelectors: [
        '[class*="tracking"]',
        '[class*="track"]',
        '[id*="tracking"]',
        '[id*="track"]',
        '.tracking-number',
        '.track-number',
        '.tracking-id',
        '.track-id'
      ]
    };
  }

  // Main detection method - combines all detection strategies
  async detectCarrierFromContext(trackingNumber, tab = null) {
    const results = [];
    
    // 1. Pattern-based detection (highest priority)
    const patternResult = this.detectCarrierFromPattern(trackingNumber);
    if (patternResult.confidence === 'high') {
      results.push({ ...patternResult, source: 'pattern' });
    }

    // 2. Website-based detection
    if (tab && tab.url) {
      const websiteResult = this.detectCarrierFromWebsite(tab.url);
      if (websiteResult) {
        results.push({ carrier: websiteResult, confidence: 'high', source: 'website' });
      }
    }

    // 3. DOM-based detection (if we have access to the page)
    if (tab) {
      try {
        const domResult = await this.detectCarrierFromDOM(tab.id);
        if (domResult) {
          results.push({ ...domResult, source: 'dom' });
        }
      } catch (error) {
        console.log('DOM detection failed:', error);
      }
    }

    // Return the best result
    return this.selectBestResult(results, trackingNumber);
  }

  // Pattern-based detection
  detectCarrierFromPattern(trackingNumber) {
    const number = trackingNumber.trim();
    const results = [];

    Object.entries(this.carrierPatterns).forEach(([carrier, patterns]) => {
      patterns.forEach(({ pattern, confidence }) => {
        if (pattern.test(number)) {
          results.push({
            carrier,
            confidence,
            pattern: pattern.toString()
          });
        }
      });
    });

    // Sort by confidence
    results.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    });

    return results.length > 0 ? results[0] : { carrier: 'other', confidence: 'low', source: 'pattern' };
  }

  // Website-based detection
  detectCarrierFromWebsite(url) {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      
      // Direct domain mapping
      if (this.websiteCarrierMappings[domain]) {
        return this.websiteCarrierMappings[domain];
      }

      // Partial domain matching
      for (const [website, carrier] of Object.entries(this.websiteCarrierMappings)) {
        if (domain.includes(website.replace(/^www\./, ''))) {
          return carrier;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // DOM-based detection
  async detectCarrierFromDOM(tabId) {
    try {
      // Inject script to scan DOM for carrier information
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.scanDOMForCarrier.bind(this)
      });

      return results[0]?.result || null;
    } catch (error) {
      console.log('DOM scanning failed:', error);
      return null;
    }
  }

  // Function to be injected into the page
  scanDOMForCarrier() {
    const carrierKeywords = {
      ups: ['ups', 'united parcel service'],
      fedex: ['fedex', 'federal express'],
      usps: ['usps', 'united states postal service', 'postal service'],
      dhl: ['dhl'],
      amazon: ['amazon', 'amazon logistics'],
      ontrac: ['ontrac'],
      lasership: ['lasership', 'laser ship']
    };

    // Search for carrier keywords in the page
    const pageText = document.body.innerText.toLowerCase();
    const foundCarriers = [];

    Object.entries(carrierKeywords).forEach(([carrier, keywords]) => {
      keywords.forEach(keyword => {
        if (pageText.includes(keyword)) {
          foundCarriers.push({
            carrier,
            confidence: 'medium',
            keyword,
            source: 'dom'
          });
        }
      });
    });

    // Also check for carrier logos/images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const src = img.src.toLowerCase();
      const alt = (img.alt || '').toLowerCase();
      const title = (img.title || '').toLowerCase();
      
      Object.entries(carrierKeywords).forEach(([carrier, keywords]) => {
        keywords.forEach(keyword => {
          if (src.includes(keyword) || alt.includes(keyword) || title.includes(keyword)) {
            foundCarriers.push({
              carrier,
              confidence: 'high',
              keyword,
              source: 'dom_logo'
            });
          }
        });
      });
    });

    // Return the most confident result
    if (foundCarriers.length > 0) {
      foundCarriers.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      });
      return foundCarriers[0];
    }

    return null;
  }

  // Select the best result from all detection methods
  selectBestResult(results, trackingNumber) {
    if (results.length === 0) {
      return { carrier: 'other', confidence: 'low', source: 'none' };
    }

    // Prioritize by source and confidence
    const sourcePriority = { pattern: 3, website: 2, dom_logo: 2, dom: 1 };
    const confidenceOrder = { high: 3, medium: 2, low: 1 };

    results.sort((a, b) => {
      const sourceScore = sourcePriority[a.source] || 0;
      const confidenceScore = confidenceOrder[a.confidence] || 0;
      const aScore = sourceScore + confidenceScore;
      
      const bSourceScore = sourcePriority[b.source] || 0;
      const bConfidenceScore = confidenceOrder[b.confidence] || 0;
      const bScore = bSourceScore + bConfidenceScore;
      
      return bScore - aScore;
    });

    return results[0];
  }

  // Enhanced tracking number validation
  isValidTrackingNumber(text) {
    const trimmed = text.trim();
    
    // Basic length check
    if (trimmed.length < 8 || trimmed.length > 30) {
      return false;
    }

    // Check if it matches any known pattern
    const patternResult = this.detectCarrierFromPattern(trimmed);
    return patternResult.carrier !== 'other' || /^[A-Z0-9]{8,}$/.test(trimmed);
  }

  // Get all available carriers
  getAvailableCarriers() {
    return Object.keys(this.carrierPatterns).map(carrier => ({
      id: carrier,
      name: this.getCarrierDisplayName(carrier),
      icon: this.getCarrierIcon(carrier)
    }));
  }

  getCarrierDisplayName(carrier) {
    const names = {
      ups: 'UPS',
      fedex: 'FedEx',
      usps: 'USPS',
      dhl: 'DHL',
      amazon: 'Amazon',
      ontrac: 'OnTrac',
      lasership: 'LaserShip',
      other: 'Other'
    };
    return names[carrier] || carrier;
  }

  getCarrierIcon(carrier) {
    const icons = {
      ups: '🚚',
      fedex: '📦',
      usps: '📮',
      dhl: '🌍',
      amazon: '📦',
      ontrac: '🚛',
      lasership: '🚚',
      other: '📦'
    };
    return icons[carrier] || '📦';
  }
}

export const carrierDetection = new CarrierDetectionService();


