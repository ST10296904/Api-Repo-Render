import express from "express";
import cors from "cors";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// Load Firebase service account from environment variables
let serviceAccount;
try {
  // For production, use environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log("Firebase service account loaded from environment variable");
  } else {
    // For local development, use file
    const serviceAccountPath = path.resolve("./serviceAccountKey.json");
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    console.log("Firebase service account loaded from file");
  }
} catch (error) {
  console.error("Error loading Firebase service account key:");
  console.error("For production: Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable");
  console.error("For development: Make sure 'serviceAccountKey.json' exists");
  process.exit(1);
}

const app = express();

// Add request logging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase
let db;
try {
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase:", error.message);
  process.exit(1);
}

// Simple test page
app.get("/", (req, res) => {
  console.log("Serving root page");
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Messaging API Test</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
        button { padding: 10px 15px; margin: 5px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 4px; }
        input { padding: 8px; margin: 5px; border: 1px solid #ccc; border-radius: 4px; width: 200px; }
        .result { background: #f8f9fa; padding: 10px; margin: 10px 0; border-left: 3px solid #007bff; white-space: pre-wrap; }
        .success { border-left-color: #28a745; }
        .error { border-left-color: #dc3545; }
      </style>
    </head>
    <body>
      <h1>Messaging API Test Interface</h1>
      <p>Server is running! Firebase is connected.</p>
      
      <h3>Quick Test</h3>
      <div>
        <label>Project ID:</label><br>
        <input type="text" id="projectId" value="test-123" />
      </div>
      <div>
        <label>Your Name:</label><br>
        <input type="text" id="senderId" value="TestUser" />
      </div>
      <div>
        <label>Message:</label><br>
        <input type="text" id="message" value="Hello from the API!" />
      </div>
      <br>
      <button onclick="sendTestMessage()">Send Test Message</button>
      <button onclick="getMessages()">Get Messages</button>
      <button onclick="getParticipants()">Get Participants</button>
      <button onclick="clearResult()">Clear Results</button>
      
      <div id="result" class="result">
        <strong>Results will appear here...</strong><br>
        Click "Send Test Message" to create a project and send your first message!
      </div>
      
      <h3>Available API Endpoints</h3>
      <ul>
        <li><a href="/health" target="_blank">GET /health</a> - Health check</li>
        <li>POST /projects/{projectId}/messages - Send a message</li>
        <li>GET /projects/{projectId}/messages - Get messages</li>
        <li>GET /projects/{projectId}/participants - Get participants</li>
        <li>POST /projects/{projectId}/init - Initialize test project</li>
      </ul>
      
      <script>
        function showResult(data, isError = false) {
          const resultDiv = document.getElementById('result');
          resultDiv.className = 'result ' + (isError ? 'error' : 'success');
          resultDiv.innerHTML = JSON.stringify(data, null, 2);
        }
        
        function clearResult() {
          const resultDiv = document.getElementById('result');
          resultDiv.className = 'result';
          resultDiv.innerHTML = '<strong>Results cleared.</strong>';
        }
        
        async function sendTestMessage() {
          const projectId = document.getElementById('projectId').value;
          const senderId = document.getElementById('senderId').value;
          const content = document.getElementById('message').value;
          
          try {
            const response = await fetch(\`/projects/\${projectId}/messages\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ senderId, content })
            });
            const data = await response.json();
            showResult({
              action: 'Send Message',
              status: response.status,
              success: response.ok,
              data: data
            }, !response.ok);
          } catch (err) {
            showResult({
              action: 'Send Message',
              error: err.message
            }, true);
          }
        }
        
        async function getMessages() {
          const projectId = document.getElementById('projectId').value;
          try {
            const response = await fetch(\`/projects/\${projectId}/messages\`);
            const data = await response.json();
            showResult({
              action: 'Get Messages',
              status: response.status,
              success: response.ok,
              messageCount: Array.isArray(data) ? data.length : 0,
              data: data
            }, !response.ok);
          } catch (err) {
            showResult({
              action: 'Get Messages',
              error: err.message
            }, true);
          }
        }
        
        async function getParticipants() {
          const projectId = document.getElementById('projectId').value;
          try {
            const response = await fetch(\`/projects/\${projectId}/participants\`);
            const data = await response.json();
            showResult({
              action: 'Get Participants',
              status: response.status,
              success: response.ok,
              data: data
            }, !response.ok);
          } catch (err) {
            showResult({
              action: 'Get Participants',
              error: err.message
            }, true);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("Health check requested");
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    firebase: "Connected",
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get participants in project
app.get("/projects/:projectId/participants", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId || projectId.trim() === "") {
      return res.status(400).json({ error: "Project ID is required" });
    }
    
    console.log(`Loading participants for project: ${projectId}`);
    const projectDoc = await db.collection("projects").doc(projectId).get();

    if (!projectDoc.exists) {
      console.log(`Project not found: ${projectId}`);
      return res.status(404).json({ 
        error: "Project not found. Make sure the project exists in Firestore." 
      });
    }

    const projectData = projectDoc.data();
    const participants = projectData.participants || [];
    
    console.log(`Found ${participants.length} participants`);
    res.json({ participants });
  } catch (err) {
    console.error("Error loading participants:", err);
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Get messages in project
app.get("/projects/:projectId/messages", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId || projectId.trim() === "") {
      return res.status(400).json({ error: "Project ID is required" });
    }
    
    console.log(`Loading messages for project: ${projectId}`);
    
    // First check if project exists
    const projectDoc = await db.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) {
      console.log(`Project not found: ${projectId}`);
      return res.status(404).json({ 
        error: "Project not found. Make sure the project exists in Firestore." 
      });
    }
    
    const snapshot = await db.collection("projects").doc(projectId)
      .collection("messages").orderBy("timestamp", "asc").get();

    const messages = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    console.log(`Found ${messages.length} messages`);
    res.json(messages);
  } catch (err) {
    console.error("Error loading messages:", err);
    
    // Handle specific Firestore errors
    if (err.code === 9) {
      res.status(500).json({ 
        error: "Database index required. Check Firestore console for index creation link." 
      });
    } else {
      res.status(500).json({ error: `Server error: ${err.message}` });
    }
  }
});

// Add a new message
app.post("/projects/:projectId/messages", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { senderId, content } = req.body;
    
    // Validation
    if (!projectId || projectId.trim() === "") {
      return res.status(400).json({ error: "Project ID is required" });
    }
    
    if (!senderId || senderId.trim() === "") {
      return res.status(400).json({ error: "Sender ID is required" });
    }
    
    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Message content is required" });
    }
    
    console.log(`Adding message to project: ${projectId} from: ${senderId}`);
    
    // Check if project exists, if not create it
    const projectRef = db.collection("projects").doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      console.log(`Creating new project: ${projectId}`);
      await projectRef.set({
        participants: [senderId],
        createdAt: new Date()
      });
    } else {
      // Add sender to participants if not already there
      const projectData = projectDoc.data();
      const participants = projectData.participants || [];
      if (!participants.includes(senderId)) {
        await projectRef.update({
          participants: [...participants, senderId]
        });
      }
    }

    const newMsg = { 
      senderId: senderId.trim(), 
      content: content.trim(), 
      timestamp: new Date() 
    };
    
    const docRef = await db.collection("projects").doc(projectId)
      .collection("messages").add(newMsg);

    console.log(`Message added with ID: ${docRef.id}`);
    res.json({ id: docRef.id, ...newMsg });
  } catch (err) {
    console.error("Error adding message:", err);
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Create a test project
app.post("/projects/:projectId/init", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { participants = [] } = req.body;
    
    if (!projectId || projectId.trim() === "") {
      return res.status(400).json({ error: "Project ID is required" });
    }
    
    console.log(`Initializing test project: ${projectId}`);
    
    const projectRef = db.collection("projects").doc(projectId);
    await projectRef.set({
      participants: participants.length > 0 ? participants : ["user1", "user2", "admin"],
      createdAt: new Date(),
      description: "Test project created via API"
    });
    
    console.log(`Test project created: ${projectId}`);
    res.json({ 
      message: "Project initialized successfully", 
      projectId,
      participants: participants.length > 0 ? participants : ["user1", "user2", "admin"]
    });
  } catch (err) {
    console.error("Error creating test project:", err);
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    method: req.method,
    url: req.url,
    availableEndpoints: ['/health', '/projects/:projectId/messages', '/projects/:projectId/participants']
  });
});

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log("Messaging API Server Started");
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

console.log("Server startup complete - waiting for connections...");