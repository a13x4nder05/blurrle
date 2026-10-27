import { createApp } from "../server/app.js";
import { createCloudCatalog } from "../server/cloud.js";

// Vercel hosts the built frontend separately and invokes Express per request.
export default createApp({ cloud: createCloudCatalog(), serveClient: false });
