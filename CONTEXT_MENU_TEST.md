# Context Menu Quick Add Test Guide

## 🔧 **Issue Fixed: Context Menu Not Adding Tracking Items**

The context menu was working but not properly storing tracking items. This has been fixed by:

1. ✅ **Fixed storage logic** - Now properly saves to Chrome storage
2. ✅ **Added popup refresh** - Popup updates when items are added via context menu
3. ✅ **Enhanced debugging** - Added console logs to track the flow
4. ✅ **Improved error handling** - Better error messages and fallbacks

## 🧪 **Testing Steps**

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find TrackHub extension
3. Click the refresh/reload button
4. Check console for "Context menu created: quickAddTracking"

### Step 2: Login to Extension
1. Click TrackHub extension icon
2. Login with Google OAuth or email/password
3. Verify you can see the dashboard

### Step 3: Test Context Menu
1. **Go to any webpage** with tracking numbers
2. **Select a tracking number** (like "884417250435")
3. **Right-click** on the selected text
4. **Click "Add to TrackHub"** from context menu
5. **Check for notification** - should show "Tracking Added"
6. **Open extension popup** - should see the new tracking item

### Step 4: Debug Console
1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Look for these messages:**
   ```
   Context menu clicked: {menuItemId: "quickAddTracking", selectionText: "884417250435"}
   Processing quick add for text: 884417250435
   Context menu clicked with text: 884417250435
   Quick add tracking: {id: "...", trackingNumber: "884417250435", ...}
   Tracking item added to storage: {id: "...", trackingNumber: "884417250435", ...}
   ```

## 🚨 **Common Issues & Solutions**

### Issue 1: Context Menu Not Appearing
**Symptoms:** No "Add to TrackHub" option in right-click menu
**Solution:**
- Check if extension is properly loaded
- Verify `contextMenus` permission in manifest.json
- Reload the extension

### Issue 2: "Login Required" Message
**Symptoms:** Context menu shows "Login Required" notification
**Solution:**
- Login to the extension first
- Check if OAuth or local auth is working
- Verify user is authenticated

### Issue 3: No Tracking Added
**Symptoms:** Context menu works but no tracking appears in popup
**Solution:**
- Check console for error messages
- Verify storage permissions
- Check if popup is refreshing

### Issue 4: No Notification
**Symptoms:** Context menu works but no success notification
**Solution:**
- Check notification permissions
- Look for console logs as fallback
- Verify notification settings

## 🔍 **Debug Information**

### Console Messages to Look For:
```
✅ Context menu created: quickAddTracking
✅ Context menu clicked: {menuItemId: "quickAddTracking", selectionText: "..."}
✅ Processing quick add for text: ...
✅ Context menu clicked with text: ...
✅ Quick add tracking: {...}
✅ Tracking item added to storage: {...}
✅ TrackHub: Tracking Added - Added UPS tracking
```

### Error Messages to Watch For:
```
❌ Error handling context menu click: ...
❌ Error handling quick add tracking: ...
❌ Error showing notification: ...
```

## 📋 **Test Checklist**

- [ ] Extension reloads without errors
- [ ] Context menu "Add to TrackHub" appears
- [ ] Right-click on tracking number works
- [ ] "Tracking Added" notification shows
- [ ] Tracking appears in extension popup
- [ ] Console shows success messages
- [ ] No error messages in console

## 🆘 **If Still Not Working**

1. **Check Extension Permissions:**
   - Go to `chrome://extensions/`
   - Click "Details" on TrackHub
   - Verify all permissions are granted

2. **Check Console Logs:**
   - Open DevTools (F12)
   - Look for error messages
   - Check if context menu is created

3. **Test with Different Text:**
   - Try selecting different tracking numbers
   - Test with various formats
   - Check if detection patterns work

4. **Verify Storage:**
   - Go to `chrome://extensions/`
   - Click "Inspect views: background page"
   - Check storage in DevTools

## 🎯 **Expected Behavior**

1. **Select tracking number** on any webpage
2. **Right-click** → "Add to TrackHub" appears
3. **Click "Add to TrackHub"** → Notification shows "Tracking Added"
4. **Open extension popup** → New tracking item appears in list
5. **Console shows** success messages

The context menu should now work properly and add tracking items to your extension!
