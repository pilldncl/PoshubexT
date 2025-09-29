// Tracking State Manager for TrackHub
// Handles editable/locked states and carrier detection

export class TrackingStateManager {
  constructor() {
    this.editingItems = new Set(); // Track which items are being edited
    this.carrierPatterns = this.initializeCarrierPatterns();
  }

  // Initialize comprehensive carrier detection patterns
  initializeCarrierPatterns() {
    return {
      ups: [
        { pattern: /^1Z[0-9A-Z]{16}$/, confidence: 'high' },
        { pattern: /^[0-9]{10,}$/, confidence: 'medium' },
        { pattern: /^T[0-9]{10}$/, confidence: 'high' }, // UPS Ground
        { pattern: /^1Z[A-Z0-9]{6}[0-9]{2}[A-Z0-9]{8}$/, confidence: 'high' }
      ],
      fedex: [
        { pattern: /^[0-9]{12}$/, confidence: 'high' },
        { pattern: /^[0-9]{14}$/, confidence: 'high' },
        { pattern: /^[0-9]{15}$/, confidence: 'high' },
        { pattern: /^[0-9]{20}$/, confidence: 'high' },
        { pattern: /^[0-9]{22}$/, confidence: 'high' }
      ],
      usps: [
        { pattern: /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/, confidence: 'high' },
        { pattern: /^[0-9]{4}\s[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/, confidence: 'high' },
        { pattern: /^[0-9]{20}$/, confidence: 'medium' },
        { pattern: /^[0-9]{22}$/, confidence: 'medium' },
        { pattern: /^[0-9]{26}$/, confidence: 'medium' }
      ],
      dhl: [
        { pattern: /^[0-9]{10,11}$/, confidence: 'medium' },
        { pattern: /^[0-9]{12}$/, confidence: 'medium' },
        { pattern: /^[0-9]{14}$/, confidence: 'medium' },
        { pattern: /^[0-9]{16}$/, confidence: 'medium' }
      ],
      amazon: [
        { pattern: /^TBA[0-9]{10}$/, confidence: 'high' },
        { pattern: /^TBA[0-9]{12}$/, confidence: 'high' },
        { pattern: /^[0-9]{3}-[0-9]{7}-[0-9]{7}$/, confidence: 'high' }
      ],
      ontrac: [
        { pattern: /^[0-9]{12}$/, confidence: 'medium' },
        { pattern: /^[0-9]{14}$/, confidence: 'medium' }
      ],
      lasership: [
        { pattern: /^[0-9]{12}$/, confidence: 'medium' },
        { pattern: /^[0-9]{14}$/, confidence: 'medium' }
      ]
    };
  }

  // Enhanced carrier detection with confidence levels
  detectCarrier(trackingNumber) {
    const number = trackingNumber.trim();
    const results = [];

    // Check each carrier's patterns
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

    // Sort by confidence (high > medium > low)
    results.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    });

    // Return the highest confidence match
    return results.length > 0 ? results[0].carrier : 'other';
  }

  // Get all available carriers for selection
  getAvailableCarriers() {
    return [
      { value: 'ups', label: 'UPS', icon: '🚚' },
      { value: 'fedex', label: 'FedEx', icon: '📦' },
      { value: 'usps', label: 'USPS', icon: '📮' },
      { value: 'dhl', label: 'DHL', icon: '🌍' },
      { value: 'amazon', label: 'Amazon', icon: '📱' },
      { value: 'ontrac', label: 'OnTrac', icon: '🚛' },
      { value: 'lasership', label: 'LaserShip', icon: '🚚' },
      { value: 'other', label: 'Other', icon: '📦' }
    ];
  }

  // Check if an item is in editing state
  isEditing(itemId) {
    return this.editingItems.has(itemId);
  }

  // Set editing state for an item
  setEditingState(itemId, isEditing) {
    if (isEditing) {
      this.editingItems.add(itemId);
    } else {
      this.editingItems.delete(itemId);
    }
  }

  // Clear all editing states
  clearAllEditingStates() {
    this.editingItems.clear();
  }

  // Get editing state for all items
  getEditingStates() {
    return Array.from(this.editingItems);
  }

  // Validate tracking number format
  validateTrackingNumber(trackingNumber) {
    if (!trackingNumber || trackingNumber.trim().length === 0) {
      return { valid: false, error: 'Tracking number is required' };
    }

    const trimmed = trackingNumber.trim();
    
    // Check minimum length
    if (trimmed.length < 8) {
      return { valid: false, error: 'Tracking number too short' };
    }

    // Check maximum length
    if (trimmed.length > 30) {
      return { valid: false, error: 'Tracking number too long' };
    }

    // Check for valid characters (alphanumeric, spaces, hyphens)
    if (!/^[A-Z0-9\s\-]+$/i.test(trimmed)) {
      return { valid: false, error: 'Invalid characters in tracking number' };
    }

    return { valid: true };
  }

  // Validate brand selection
  validateBrand(brand) {
    const availableCarriers = this.getAvailableCarriers();
    const validBrands = availableCarriers.map(c => c.value);
    
    if (!brand || brand.trim().length === 0) {
      return { valid: false, error: 'Carrier is required' };
    }

    if (!validBrands.includes(brand)) {
      return { valid: false, error: 'Invalid carrier selection' };
    }

    return { valid: true };
  }

  // Validate description
  validateDescription(description) {
    if (!description || description.trim().length === 0) {
      return { valid: true }; // Description is optional
    }

    if (description.trim().length > 200) {
      return { valid: false, error: 'Description too long (max 200 characters)' };
    }

    return { valid: true };
  }

  // Validate all tracking item data
  validateTrackingItem(data) {
    const errors = [];

    // Validate tracking number
    const trackingValidation = this.validateTrackingNumber(data.trackingNumber);
    if (!trackingValidation.valid) {
      errors.push(trackingValidation.error);
    }

    // Validate brand
    const brandValidation = this.validateBrand(data.brand);
    if (!brandValidation.valid) {
      errors.push(brandValidation.error);
    }

    // Validate description
    const descriptionValidation = this.validateDescription(data.description);
    if (!descriptionValidation.valid) {
      errors.push(descriptionValidation.error);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Auto-detect carrier and suggest to user
  suggestCarrier(trackingNumber) {
    const detectedCarrier = this.detectCarrier(trackingNumber);
    const availableCarriers = this.getAvailableCarriers();
    const carrierInfo = availableCarriers.find(c => c.value === detectedCarrier);

    return {
      suggested: detectedCarrier,
      confidence: this.getCarrierConfidence(trackingNumber, detectedCarrier),
      carrierInfo: carrierInfo || { value: 'other', label: 'Other', icon: '📦' }
    };
  }

  // Get confidence level for carrier detection
  getCarrierConfidence(trackingNumber, carrier) {
    const patterns = this.carrierPatterns[carrier] || [];
    const number = trackingNumber.trim();

    for (const { pattern, confidence } of patterns) {
      if (pattern.test(number)) {
        return confidence;
      }
    }

    return 'low';
  }

  // Get tracking URL for a carrier
  getTrackingUrl(brand, trackingNumber) {
    const urls = {
      'ups': `https://www.ups.com/track?trackingNumber=${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'usps': `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`,
      'dhl': `https://www.dhl.com/tracking?trackingNumber=${trackingNumber}`,
      'amazon': `https://www.amazon.com/progress-tracker/package/${trackingNumber}`,
      'ontrac': `https://www.ontrac.com/tracking?trackingNumber=${trackingNumber}`,
      'lasership': `https://www.lasership.com/track/${trackingNumber}`,
      'other': null
    };
    return urls[brand.toLowerCase()] || null;
  }

  // Format tracking number for display
  formatTrackingNumber(trackingNumber, brand) {
    const number = trackingNumber.trim();
    
    switch (brand.toLowerCase()) {
      case 'ups':
        // Format UPS tracking numbers
        if (number.startsWith('1Z')) {
          return number.toUpperCase();
        }
        return number;
        
      case 'fedex':
        // Format FedEx tracking numbers
        return number;
        
      case 'usps':
        // Format USPS tracking numbers
        if (number.length === 20 && !number.includes(' ')) {
          return number.replace(/(.{4})/g, '$1 ').trim();
        }
        return number;
        
      default:
        return number;
    }
  }

  // Get carrier icon
  getCarrierIcon(brand) {
    const availableCarriers = this.getAvailableCarriers();
    const carrier = availableCarriers.find(c => c.value === brand);
    return carrier ? carrier.icon : '📦';
  }

  // Get carrier label
  getCarrierLabel(brand) {
    const availableCarriers = this.getAvailableCarriers();
    const carrier = availableCarriers.find(c => c.value === brand);
    return carrier ? carrier.label : 'Other';
  }
}

// Export for use in other files
export default TrackingStateManager;
