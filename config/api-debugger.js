// API Debugger for TrackHub Chrome Extension
// Comprehensive tool to debug API communication with backend

export class APIDebugger {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.logs = [];
  }

  // Add log entry with timestamp
  log(category, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      category,
      message,
      data
    };
    this.logs.push(entry);
    console.log(`[${category}] ${message}`, data || '');
    return entry;
  }

  // Get auth token from storage
  async getAuthToken() {
    try {
      const result = await chrome.storage.local.get([
        'trackhub_access_token',
        'auth0_access_token',
        'trackhub_token_expiry',
        'auth0_token_expiry'
      ]);

      if (result.auth0_access_token && result.auth0_token_expiry) {
        const isExpired = Date.now() >= result.auth0_token_expiry;
        this.log('AUTH', 'Auth0 token found', {
          tokenLength: result.auth0_access_token.length,
          expiry: new Date(result.auth0_token_expiry).toISOString(),
          isExpired
        });
        return isExpired ? null : result.auth0_access_token;
      }

      if (result.trackhub_access_token && result.trackhub_token_expiry) {
        const isExpired = Date.now() >= result.trackhub_token_expiry;
        this.log('AUTH', 'TrackHub token found', {
          tokenLength: result.trackhub_access_token.length,
          expiry: new Date(result.trackhub_token_expiry).toISOString(),
          isExpired
        });
        return isExpired ? null : result.trackhub_access_token;
      }

      if (result.trackhub_access_token) {
        this.log('AUTH', 'TrackHub token found (no expiry)', {
          tokenLength: result.trackhub_access_token.length
        });
        return result.trackhub_access_token;
      }

      this.log('AUTH', 'No auth token found', null);
      return null;
    } catch (error) {
      this.log('ERROR', 'Failed to get auth token', { error: error.message });
      return null;
    }
  }

  // Test 1: Check if backend is reachable
  async testBackendConnectivity() {
    this.log('TEST', 'Testing backend connectivity...', { url: this.baseUrl });

    try {
      const startTime = performance.now();
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (response.ok) {
        const data = await response.json().catch(() => ({ status: 'ok' }));
        this.log('SUCCESS', 'Backend is reachable', {
          status: response.status,
          duration: `${duration}ms`,
          data
        });
        return { success: true, status: response.status, duration, data };
      } else {
        this.log('WARNING', 'Backend responded with error', {
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`
        });
        return { success: false, status: response.status, duration };
      }
    } catch (error) {
      this.log('ERROR', 'Cannot connect to backend', {
        error: error.message,
        url: `${this.baseUrl}/api/health`,
        hint: 'Is your backend server running?'
      });
      return { success: false, error: error.message };
    }
  }

  // Test 2: Test GET request (fetch tracking items)
  async testGetRequest() {
    this.log('TEST', 'Testing GET request to fetch tracking items...');

    const token = await this.getAuthToken();
    if (!token) {
      this.log('ERROR', 'No auth token available for GET request');
      return { success: false, error: 'No auth token' };
    }

    const url = `${this.baseUrl}/api/tracking/user`;
    this.log('REQUEST', 'Sending GET request', { url, hasToken: !!token });

    try {
      const startTime = performance.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Extension-Version': '1.0.0'
        }
      });
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      this.log('RESPONSE', 'GET request response received', {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const data = await response.json();
        this.log('SUCCESS', 'GET request successful', {
          dataReceived: true,
          itemCount: Array.isArray(data) ? data.length : (data.trackings?.length || data.trackingItems?.length || 'unknown'),
          data
        });
        return { success: true, status: response.status, duration, data };
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        this.log('ERROR', 'GET request failed', {
          status: response.status,
          error: errorData
        });
        return { success: false, status: response.status, error: errorData };
      }
    } catch (error) {
      this.log('ERROR', 'GET request threw exception', {
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  // Test 3: Test POST request (add tracking item)
  async testPostRequest() {
    this.log('TEST', 'Testing POST request to add tracking item...');

    const token = await this.getAuthToken();
    if (!token) {
      this.log('ERROR', 'No auth token available for POST request');
      return { success: false, error: 'No auth token' };
    }

    const url = `${this.baseUrl}/api/tracking/add`;
    const testTrackingData = {
      trackingNumber: `TEST${Date.now()}`,
      brand: 'ups',
      description: 'API Debug Test Item',
      dateAdded: new Date().toISOString(),
      status: 'pending'
    };

    this.log('REQUEST', 'Sending POST request', {
      url,
      hasToken: !!token,
      payload: testTrackingData
    });

    try {
      const startTime = performance.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Extension-Version': '1.0.0'
        },
        body: JSON.stringify(testTrackingData)
      });
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      this.log('RESPONSE', 'POST request response received', {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const data = await response.json();
        this.log('SUCCESS', 'POST request successful', {
          dataReceived: true,
          createdId: data.id || data.trackingId || 'unknown',
          data
        });
        return { success: true, status: response.status, duration, data };
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        this.log('ERROR', 'POST request failed', {
          status: response.status,
          error: errorData
        });
        return { success: false, status: response.status, error: errorData };
      }
    } catch (error) {
      this.log('ERROR', 'POST request threw exception', {
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  // Test 4: Test authentication endpoints
  async testAuthEndpoints() {
    this.log('TEST', 'Testing authentication endpoints...');

    const results = {
      login: null,
      register: null,
      profile: null
    };

    // Test login endpoint (without credentials, just connectivity)
    try {
      const loginUrl = `${this.baseUrl}/api/auth/login`;
      this.log('REQUEST', 'Testing login endpoint', { url: loginUrl });
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '', password: '' })
      });

      results.login = {
        reachable: true,
        status: response.status,
        message: response.status === 400 || response.status === 401 ? 'Endpoint working (validation/auth expected)' : 'Unexpected response'
      };
      this.log('INFO', 'Login endpoint test', results.login);
    } catch (error) {
      results.login = { reachable: false, error: error.message };
      this.log('ERROR', 'Login endpoint unreachable', { error: error.message });
    }

    // Test profile endpoint
    const token = await this.getAuthToken();
    if (token) {
      try {
        const profileUrl = `${this.baseUrl}/api/user/profile`;
        this.log('REQUEST', 'Testing profile endpoint', { url: profileUrl });
        
        const response = await fetch(profileUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          results.profile = { reachable: true, status: response.status, authenticated: true, data };
          this.log('SUCCESS', 'Profile endpoint working', results.profile);
        } else {
          results.profile = { reachable: true, status: response.status, authenticated: false };
          this.log('WARNING', 'Profile endpoint returned error', results.profile);
        }
      } catch (error) {
        results.profile = { reachable: false, error: error.message };
        this.log('ERROR', 'Profile endpoint unreachable', { error: error.message });
      }
    } else {
      results.profile = { skipped: true, reason: 'No auth token available' };
      this.log('INFO', 'Profile endpoint test skipped', results.profile);
    }

    return results;
  }

  // Test 5: Verify request/response cycle
  async testRequestResponseCycle() {
    this.log('TEST', 'Testing complete request/response cycle...');

    const results = {
      requestSent: false,
      responsReceived: false,
      dataValid: false,
      details: {}
    };

    try {
      const url = `${this.baseUrl}/api/health`;
      this.log('REQUEST', 'Sending test request', { url });

      // Track request
      results.requestSent = true;
      results.details.requestTime = new Date().toISOString();

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      // Track response
      results.responseReceived = true;
      results.details.responseTime = new Date().toISOString();
      results.details.status = response.status;
      results.details.statusText = response.statusText;
      results.details.headers = Object.fromEntries(response.headers.entries());

      // Check data
      if (response.ok) {
        const data = await response.json().catch(() => null);
        results.dataValid = !!data;
        results.details.data = data;
      }

      this.log('SUCCESS', 'Request/response cycle complete', results);
      return results;

    } catch (error) {
      results.details.error = error.message;
      this.log('ERROR', 'Request/response cycle failed', results);
      return results;
    }
  }

  // Run all tests
  async runAllTests() {
    this.logs = [];
    this.log('START', '========== API DEBUG SESSION START ==========');

    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Backend connectivity
    this.log('INFO', '--- Test 1: Backend Connectivity ---');
    results.tests.connectivity = await this.testBackendConnectivity();

    // Test 2: Request/Response cycle
    this.log('INFO', '--- Test 2: Request/Response Cycle ---');
    results.tests.requestResponse = await this.testRequestResponseCycle();

    // Test 3: Authentication status
    this.log('INFO', '--- Test 3: Authentication Endpoints ---');
    results.tests.auth = await this.testAuthEndpoints();

    // Test 4: GET request
    this.log('INFO', '--- Test 4: GET Request (Fetch Tracking Items) ---');
    results.tests.getRequest = await this.testGetRequest();

    // Test 5: POST request
    this.log('INFO', '--- Test 5: POST Request (Add Tracking Item) ---');
    results.tests.postRequest = await this.testPostRequest();

    this.log('END', '========== API DEBUG SESSION END ==========');
    
    results.logs = this.logs;
    results.summary = this.generateSummary(results);

    return results;
  }

  // Generate summary of test results
  generateSummary(results) {
    const summary = {
      backendReachable: results.tests.connectivity?.success || false,
      requestsSent: results.tests.requestResponse?.requestSent || false,
      responsesReceived: results.tests.requestResponse?.responseReceived || false,
      authWorking: results.tests.auth?.profile?.authenticated || false,
      getRequestWorks: results.tests.getRequest?.success || false,
      postRequestWorks: results.tests.postRequest?.success || false,
      overallStatus: 'Unknown'
    };

    // Determine overall status
    if (summary.backendReachable && summary.authWorking && summary.getRequestWorks) {
      summary.overallStatus = 'All systems operational';
    } else if (summary.backendReachable && !summary.authWorking) {
      summary.overallStatus = 'Backend reachable but authentication issue';
    } else if (!summary.backendReachable) {
      summary.overallStatus = 'Backend not reachable';
    } else {
      summary.overallStatus = 'Partial functionality';
    }

    return summary;
  }

  // Export logs as JSON
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  // Export results as formatted text
  formatResults(results) {
    let output = '';
    output += '='.repeat(60) + '\n';
    output += 'API DEBUG REPORT\n';
    output += '='.repeat(60) + '\n\n';
    output += `Timestamp: ${results.timestamp}\n`;
    output += `Backend URL: ${this.baseUrl}\n\n`;

    output += 'SUMMARY:\n';
    output += '-'.repeat(60) + '\n';
    output += `Overall Status: ${results.summary.overallStatus}\n`;
    output += `Backend Reachable: ${results.summary.backendReachable ? '✅' : '❌'}\n`;
    output += `Requests Sent: ${results.summary.requestsSent ? '✅' : '❌'}\n`;
    output += `Responses Received: ${results.summary.responsesReceived ? '✅' : '❌'}\n`;
    output += `Authentication: ${results.summary.authWorking ? '✅' : '❌'}\n`;
    output += `GET Requests: ${results.summary.getRequestWorks ? '✅' : '❌'}\n`;
    output += `POST Requests: ${results.summary.postRequestWorks ? '✅' : '❌'}\n\n`;

    output += 'DETAILED RESULTS:\n';
    output += '-'.repeat(60) + '\n\n';

    // Connectivity
    output += '1. Backend Connectivity:\n';
    if (results.tests.connectivity.success) {
      output += `   ✅ Backend is reachable (${results.tests.connectivity.duration}ms)\n`;
    } else {
      output += `   ❌ Backend unreachable: ${results.tests.connectivity.error}\n`;
    }
    output += '\n';

    // GET Request
    output += '2. GET Request Test:\n';
    if (results.tests.getRequest.success) {
      output += `   ✅ GET request successful\n`;
      output += `   📦 Received data with ${results.tests.getRequest.data?.length || 'unknown'} items\n`;
    } else {
      output += `   ❌ GET request failed: ${results.tests.getRequest.error?.message || results.tests.getRequest.error}\n`;
    }
    output += '\n';

    // POST Request
    output += '3. POST Request Test:\n';
    if (results.tests.postRequest.success) {
      output += `   ✅ POST request successful\n`;
      output += `   📝 Created item with ID: ${results.tests.postRequest.data?.id || results.tests.postRequest.data?.trackingId}\n`;
    } else {
      output += `   ❌ POST request failed: ${results.tests.postRequest.error?.message || results.tests.postRequest.error}\n`;
    }
    output += '\n';

    output += '='.repeat(60) + '\n';
    output += 'LOG ENTRIES:\n';
    output += '='.repeat(60) + '\n';
    results.logs.forEach((log, index) => {
      output += `${index + 1}. [${log.category}] ${log.message}\n`;
      if (log.data) {
        output += `   Data: ${JSON.stringify(log.data, null, 2)}\n`;
      }
    });

    return output;
  }
}

// Export instance for use in popup
export const apiDebugger = new APIDebugger();

