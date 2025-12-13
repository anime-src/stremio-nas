// This can be overridden at build time using environment variables
// Example: docker build --build-arg API_URL=http://api.example.com/api -t server-admin .
export const environment = {
  production: true,
  apiUrl: '/api', // Default to relative URL (nginx proxy handles it)
};
