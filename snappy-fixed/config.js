// ─── Snappy Configuration ────────────────────────────────────────────────────
// All Azure credentials come from the backend's .env file.
// The frontend only needs to know the backend URL and the Blob SAS token
// (since uploads go directly from browser → Azure Blob, bypassing the backend).
//
// CHANGE THESE TWO VALUES:
const SNAPPY_CONFIG = {
  // Your Node.js backend URL (no trailing slash)
  // Local:      "http://localhost:3000"
  // Production: "https://your-backend.azurewebsites.net"
  backendUrl: "http://localhost:3000",

  // Azure Blob Storage — generate a new SAS token in Azure Portal
  // Storage Account → Shared access signature → Generate SAS and connection string
  blob: {
    accountName: "snappystorage2026",
    containerName: "media",
    // Paste your new SAS token here (starts with sv=...)
    sasToken: "sv=2025-11-05&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2026-09-05T07:27:10Z&st=2026-05-02T23:12:10Z&spr=https&sig=gYCkIa2ryxX9Eu7cdJ18oAdlfUc2s1bGd4GYNR8BQis%3D",
  }
};
