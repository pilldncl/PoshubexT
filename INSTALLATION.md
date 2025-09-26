# TrackHub Chrome Extension - Installation Guide

## Quick Start

### Step 1: Prepare the Extension

1. **Download/Clone** all the extension files to a folder on your computer
2. **Generate Icons**:
   - Open `create_icons.html` in your web browser
   - Download all 4 generated icon files (16x16, 32x32, 48x48, 128x128)
   - Place them in the `icons/` folder with these exact names:
     - `icon16.png`
     - `icon32.png`
     - `icon48.png`
     - `icon128.png`

### Step 2: Load in Chrome

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner
3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the folder containing your TrackHub extension files
   - Click "Select Folder"

### Step 3: Verify Installation

1. **Check Extension List**: You should see "TrackHub - Package Tracking Extension" in your extensions list
2. **Pin the Extension**: Click the puzzle piece icon in Chrome toolbar and pin TrackHub
3. **Test the Extension**: Click the TrackHub icon to open the popup

## First Time Setup

### 1. Create Account
- Click the TrackHub extension icon
- Enter your email and password
- Click "Register" to create a new account
- Or click "Login" if you already have an account

### 2. Configure Settings
- The extension will work with default settings
- You can customize settings later through the popup interface

### 3. Test Features
- **Manual Add**: Try adding a tracking number manually
- **Quick Add**: Right-click on any text and select "Add to TrackHub"
- **Auto-Detection**: Visit a page with tracking numbers to see them highlighted

## Configuration

### External Webapp Integration (Optional)

If you have an external webapp to integrate with:

1. **Update Webapp URL**:
   - Open `background.js`
   - Find the line: `webappUrl: 'https://your-webapp-url.com'`
   - Replace with your actual webapp URL

2. **Configure API Endpoints**:
   - Ensure your webapp has the required API endpoints
   - Update authentication if needed

### Custom Settings

Access settings through the extension popup:
- **Quick Add**: Enable/disable right-click functionality
- **Notifications**: Control popup notifications
- **Auto-Detection**: Enable/disable automatic tracking number detection

## Troubleshooting

### Extension Not Loading
- Check that all files are in the correct locations
- Verify `manifest.json` syntax is correct
- Ensure all icon files exist in the `icons/` folder

### Icons Not Showing
- Make sure icon files are named exactly: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- Check that icons are in the `icons/` directory
- Verify icon files are valid PNG images

### Context Menu Not Working
- Check that the extension has the required permissions
- Try refreshing the page after installing
- Verify "Developer mode" is enabled in Chrome

### Auto-Detection Not Working
- Check that the extension has permission to access the current page
- Verify auto-detection is enabled in settings
- Try refreshing the page

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "TrackHub - Package Tracking Extension"
3. Click "Remove"
4. Confirm removal

## Updating

1. Download the new version files
2. Replace the old files with new ones
3. Go to `chrome://extensions/`
4. Click the refresh icon on the TrackHub extension
5. The extension will reload with the new version

## Development Mode

For developers working on the extension:

1. **Enable Developer Mode** in Chrome extensions
2. **Make Changes** to the extension files
3. **Reload Extension** by clicking the refresh icon
4. **Test Changes** immediately without reinstalling

## Permissions Explained

The extension requests these permissions:
- **Storage**: To save your tracking data locally
- **ActiveTab**: To access the current page for auto-detection
- **Tabs**: To open tracking URLs in new tabs
- **ContextMenus**: For the right-click "Add to TrackHub" feature
- **Notifications**: To show status updates

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all files are in the correct locations
3. Ensure Chrome is up to date
4. Try disabling and re-enabling the extension

## Next Steps

After installation:
1. **Register/Login** to your TrackHub account
2. **Add your first tracking** number
3. **Test the quick-add feature** by right-clicking on text
4. **Configure external webapp** integration if needed
5. **Customize settings** to your preferences
