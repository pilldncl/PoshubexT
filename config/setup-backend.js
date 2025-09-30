// Backend Setup Configuration for TrackHub
// Update these values with your actual backend information

export const BACKEND_SETUP = {
  // Replace with your actual backend URL
  baseUrl: 'https://your-backend-api.com',
  
  // Your backend should have these endpoints:
  requiredEndpoints: {
    login: 'POST /api/auth/login',
    register: 'POST /api/auth/register', 
    userProfile: 'GET /api/user/profile',
    refreshToken: 'POST /api/auth/refresh',
    logout: 'POST /api/auth/logout'
  },
  
  // Expected request/response formats
  apiFormats: {
    login: {
      request: {
        email: 'string',
        password: 'string'
      },
      response: {
        success: true,
        user: {
          id: 'string',
          email: 'string', 
          name: 'string'
        },
        accessToken: 'string',
        refreshToken: 'string',
        expiresIn: 'number'
      }
    },
    
    register: {
      request: {
        email: 'string',
        password: 'string',
        name: 'string'
      },
      response: {
        success: true,
        user: {
          id: 'string',
          email: 'string',
          name: 'string'
        },
        accessToken: 'string',
        refreshToken: 'string',
        expiresIn: 'number'
      }
    }
  }
};

// Helper function to update backend URL
export function updateBackendUrl(newUrl) {
  // Update the auth service config
  const authServiceConfig = {
    baseUrl: newUrl,
    endpoints: {
      login: '/api/auth/login',
      register: '/api/auth/register',
      userProfile: '/api/user/profile',
      refreshToken: '/api/auth/refresh',
      logout: '/api/auth/logout'
    }
  };
  
  console.log('Backend URL updated to:', newUrl);
  return authServiceConfig;
}

// Helper function to test backend connection
export async function testBackendConnection(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('Backend connection successful');
      return true;
    } else {
      console.log('Backend connection failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Backend connection error:', error);
    return false;
  }
}
