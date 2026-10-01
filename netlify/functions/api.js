import serverless from 'serverless-http';
import app from '../../server/app.js';

// Depending on how the request arrives, the path may carry the function
// prefix; strip it so Express always sees /api/...
const handle = serverless(app);
export const handler = (event, context) => {
  if (event.path?.startsWith('/.netlify/functions/api')) {
    event.path = event.path.slice('/.netlify/functions/api'.length) || '/';
  }
  return handle(event, context);
};
