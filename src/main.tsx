import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import { App } from "./App";

// Import Clerk publishable key from environment variables
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.error("Missing Clerk Publishable Key. Please add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file");
}

// Error component for missing configuration
const ConfigError = () => (
  <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
    <div className="max-w-md bg-white rounded-lg shadow-lg p-6">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
      <p className="text-gray-700 mb-4">
        Missing Clerk Publishable Key. Please add <code className="bg-gray-100 px-2 py-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> to your <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file.
      </p>
      <p className="text-sm text-gray-600">
        See the SETUP.md file for detailed configuration instructions.
      </p>
    </div>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {clerkPubKey ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <App />
      </ClerkProvider>
    ) : (
      <ConfigError />
    )}
  </StrictMode>
);
