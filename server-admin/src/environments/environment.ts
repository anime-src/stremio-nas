export const environment = {
  production: false,
  // Option 1: Use relative URL with proxy (recommended - configured in proxy.conf.json)
  // This proxies /api requests to http://localhost:3001
  apiUrl: '/api',

  // Option 2: Use absolute URL (uncomment and set your backend URL)
  // apiUrl: 'http://localhost:3001/api',
};
