// Get Chrome Extension Redirect URI
// Run this in your Chrome extension context

console.log('=== Chrome Extension Redirect URI ===');

if (typeof chrome !== 'undefined' && chrome.identity) {
    const redirectUri = chrome.identity.getRedirectURL();
    console.log('Redirect URI:', redirectUri);
    console.log('');
    console.log('Add this URI to your Google OAuth configuration:');
    console.log('1. Go to Google Cloud Console');
    console.log('2. Navigate to APIs & Services > Credentials');
    console.log('3. Click on your OAuth 2.0 Client ID');
    console.log('4. Add this URI to "Authorized redirect URIs":');
    console.log('   ' + redirectUri);
    console.log('5. Save the changes');
} else {
    console.error('Chrome identity API not available');
    console.log('Make sure this is running in a Chrome extension context');
}
