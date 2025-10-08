# Backend API Endpoints for TrackHub

## Existing Endpoints

### POST /api/tracking/add
**Description:** Add a new tracking item to the system

**Request Body:**
```json
{
  "trackingNumber": "1Z123456789",
  "brand": "UPS",
  "description": "My package description"
}
```

**Required Fields:**
- `trackingNumber` (string): The tracking number

**Optional Fields:**
- `brand` (string): The carrier brand (will be auto-detected if not provided)
- `description` (string): Description of the package
- `dateAdded` (string): ISO timestamp when added
- `status` (string): Tracking status

**Valid Brand Values:**
- `"USPS"`
- `"UPS"`
- `"FedEx"`
- `"DHL"`

**Response:**
```json
{
  "id": "tracking_request_uuid",
  "trackingNumber": "1Z123456789",
  "brand": "ups",
  "description": "My package description",
  "dateAdded": "2024-10-06T00:00:00.000Z"
}
```

## New Endpoints to Add

### POST /api/carrier/predict
**Description:** Predict the carrier from a tracking number and context

**Request Body:**
```json
{
  "trackingNumber": "1Z123456789",
  "context": {
    "url": "https://ups.com/track",
    "userAgent": "Chrome Extension",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "source": "context_menu"
  }
}
```

**Required Fields:**
- `trackingNumber` (string): The tracking number to analyze

**Optional Fields:**
- `context` (object): Additional context for better prediction
  - `url` (string): Current website URL
  - `userAgent` (string): User agent string
  - `timestamp` (string): ISO timestamp
  - `source` (string): How the tracking number was detected

**Response:**
```json
{
  "carrier": "ups",
  "confidence": "high",
  "source": "pattern",
  "alternatives": [
    {
      "carrier": "ups",
      "confidence": "high",
      "source": "pattern"
    },
    {
      "carrier": "fedex", 
      "confidence": "low",
      "source": "website"
    }
  ],
  "trackingNumber": "1Z123456789",
  "suggestedBrand": "UPS",
  "detectionDetails": {
    "pattern": "^1Z[0-9A-Z]{16}$",
    "websiteMatch": false,
    "domMatch": false
  }
}
```

### GET /api/health
**Description:** Health check endpoint for connectivity testing

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <jwt_token>
```

## Error Responses
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```
