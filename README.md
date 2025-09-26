# TrackHub Chrome Extension

A comprehensive package tracking Chrome extension that allows users to manage tracking numbers from different sources and integrate with external web applications.

## Features

### 🔐 Authentication
- User login and registration system
- Secure session management
- Persistent login state

### 📦 Tracking Management
- Add tracking numbers with brand/carrier selection
- Support for major carriers (UPS, FedEx, USPS, DHL, Amazon)
- Optional description field for each tracking
- Visual tracking list with status indicators

### 🚀 Advanced Features
- **Quick Add from Context Menu**: Right-click on any text to add as tracking number
- **Auto-Detection**: Automatically detects tracking numbers on web pages
- **Visual Highlighting**: Highlights found tracking numbers on pages
- **One-Click Tracking**: Click highlighted numbers to add them instantly

### 🌐 External Integration
- Access to external webapp (configurable URL)
- Data synchronization between extension and webapp
- Background sync capabilities

### ⚙️ Settings & Customization
- Enable/disable quick add functionality
- Notification preferences
- Auto-detection settings
- External webapp URL configuration

## Installation

### Development Setup

1. **Clone or download the extension files**
2. **Generate Icons**:
   - Open `create_icons.html` in your browser
   - Download the generated icons and place them in the `icons/` directory
3. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

### Production Installation

1. Package the extension as a ZIP file
2. Upload to Chrome Web Store (requires developer account)
3. Users can install from the Chrome Web Store

## File Structure

```
TrackHub/
├── manifest.json          # Extension manifest
├── popup.html            # Main popup interface
├── popup.js              # Popup functionality
├── popup.css             # Popup styling
├── background.js         # Background service worker
├── content.js            # Content script for page interaction
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── create_icons.html     # Icon generator utility
└── README.md             # This file
```

## Usage

### Basic Usage

1. **Login**: Click the extension icon and login with your credentials
2. **Add Tracking**: Use the form to add tracking numbers manually
3. **View Trackings**: See all your tracking numbers in the list
4. **Track Packages**: Click the package icon to open tracking URLs

### Advanced Usage

1. **Quick Add**: Right-click on any text containing a tracking number and select "Add to TrackHub"
2. **Auto-Detection**: The extension automatically highlights tracking numbers on web pages
3. **One-Click Add**: Click highlighted tracking numbers to add them instantly
4. **External Access**: Use the "Open Main Webapp" button to access your external application

## Configuration

### External Webapp Integration

To connect with your external webapp:

1. Update the `webappUrl` in the background script
2. Implement the API endpoints in your webapp:
   - `POST /api/tracking` - Add new tracking
   - `POST /api/sync` - Sync all data
3. Handle authentication tokens as needed

### Settings

Access settings through the extension popup:
- **Quick Add**: Enable/disable context menu functionality
- **Notifications**: Control notification display
- **Auto-Detection**: Enable/disable automatic tracking number detection

## Development

### Key Components

- **Popup Script** (`popup.js`): Handles UI interactions and user authentication
- **Background Script** (`background.js`): Manages persistent functionality and external communication
- **Content Script** (`content.js`): Handles page interaction and auto-detection
- **Storage**: Uses Chrome's local storage for data persistence

### Adding New Carriers

To add support for new carriers:

1. Update the brand options in `popup.html`
2. Add tracking URL patterns in `popup.js` (`getTrackingUrl` method)
3. Add detection patterns in `content.js` and `background.js`

### Customization

- **Styling**: Modify `popup.css` for visual customization
- **Branding**: Update colors and fonts in CSS
- **Functionality**: Extend JavaScript files for additional features

## API Integration

The extension is designed to integrate with external web applications. Key integration points:

- **Authentication**: User login/registration
- **Data Sync**: Bidirectional data synchronization
- **Notifications**: Real-time updates from webapp
- **Settings**: Centralized configuration management

## Security Considerations

- All data is stored locally in Chrome's secure storage
- No sensitive information is transmitted without user consent
- Authentication tokens are handled securely
- External API calls are validated and sanitized

## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Chromium-based browsers (Edge, Brave, etc.)
- Requires permissions for storage, tabs, and notifications

## Troubleshooting

### Common Issues

1. **Extension not loading**: Check manifest.json syntax and file paths
2. **Icons not displaying**: Ensure icon files exist in the icons/ directory
3. **Context menu not working**: Verify permissions in manifest.json
4. **Auto-detection not working**: Check content script permissions

### Debug Mode

Enable Chrome's developer tools to debug:
1. Right-click extension icon → "Inspect popup"
2. Check console for error messages
3. Use Chrome's extension debugging tools

## Future Enhancements

- Real-time tracking status updates
- Push notifications for delivery updates
- Batch import/export functionality
- Advanced filtering and search
- Integration with more carriers
- Mobile companion app

## Support

For issues and feature requests, please check the extension's settings and ensure all permissions are granted.

## License

This extension is provided as-is for educational and development purposes. Modify and distribute according to your needs.
