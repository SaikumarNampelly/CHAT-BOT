# 🤖 Telugu AI Companion (Soul Bot)

An interactive, responsive full-stack chatbot designed for Telugu and Tanglish speakers, featuring real-time message streaming, persona-based companions, and secure user authentication.

🌐 **Live Application:** [https://soul-bot-rcuu.onrender.com](https://soul-bot-rcuu.onrender.com)

---

## 🚀 Key Features

* **Telugu & Tanglish Conversations:** Intelligent and natural chat processing tailored for Telugu speakers, using advanced prompting with Gemini.
* **Persona/Companion Selection:** Chat with multiple distinct companions, each with unique roles, characteristics, and backgrounds.
* **Real-time SSE Streaming:** Experience lightning-fast responses with Server-Sent Events (SSE) token streaming.
* **Secure Authentication:** User signup and login powered by Supabase with JSON Web Tokens (JWT).
* **Persistent Message History:** Save and load previous chat sessions dynamically.
* **Production Ready:** Pre-configured for deployment on Render with automatic CORS resolution.

---

## 📂 Project Structure

```text
CHAT-BOT/
├── backend/            # Express.js API Server
│   ├── src/
│   │   ├── routes/     # Auth, Companion, and Chat routes
│   │   └── services/   # Gemini API and Supabase clients
│   └── server.js       # Entry point
├── frontend/           # React + Vite Client
│   ├── src/
│   │   ├── api/        # Axios clients and streaming handlers
│   │   ├── components/ # Reusable UI elements
│   │   ├── pages/      # Chat, Login, Register, Companion select pages
│   │   └── store/      # Zustand auth and chat stores
│   └── index.html      # Entry page
├── render.yaml         # Render Blueprint configuration
└── README.md           # Project documentation
```

---

## 💻 Local Development Setup

### Prerequisites
* Node.js (v18 or higher)
* Supabase Account
* Google Gemini API Key

### 1. Clone the repository
```bash
git clone https://github.com/SaikumarNampelly/CHAT-BOT.git
cd CHAT-BOT
```

### 2. Configure Environment Variables
Create a `.env` file inside the `backend/` directory:
```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_jwt_signing_secret
```

### 3. Run the Backend Server
```bash
cd backend
npm install
npm run dev
```

### 4. Run the Frontend App
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ☁️ Deployment on Render

This repository includes a `render.yaml` blueprint configuration. To deploy:
1. Go to your **Render Dashboard**.
2. Click **New** -> **Blueprint**.
3. Connect this GitHub repository.
4. Input your environment variables when prompted.
5. Click deploy. Render will automatically configure both the static frontend and the backend API server.
