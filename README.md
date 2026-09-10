# VDA Admin Portal (`vda-ui`)

Enterprise administration and clinical observability dashboard for the **Virtual Diagnostic Assistant (VDA) Health Platform**.

[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-a855f7.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ed.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

---

## 1. Overview

The **VDA Admin Portal** provides healthcare administrators, clinical reviewers, and platform operators with full visibility into the AI health-navigation engine. It tracks live database telemetry, monitors patient safety escalations, manages public healthcare facilities, governs clinical knowledge guidelines in vector storage, and evaluates retrieval-augmented generation (RAG) metrics.

### Live Production Endpoints
- **Production Admin URL:** [https://vda-admin.mdtlabs.org](https://vda-admin.mdtlabs.org)
- **Production Backend API:** [https://vda-api.mdtlabs.org](https://vda-api.mdtlabs.org)
- **Health Diagnostic:** [https://vda-api.mdtlabs.org/api/v1/health](https://vda-api.mdtlabs.org/api/v1/health)

---

## 2. Key Features

- **Executive Telemetry Dashboard:** Real-time counters for synthetic patient cohorts, active medications, prescriptions, adherence events, public facilities, and safety escalations.
- **Knowledge Asset Governance:** View, upload, approve, and publish national clinical guidelines into PostgreSQL `pgvector` embeddings (`all-MiniLM-L6-v2`, 384 dimensions).
- **Synthetic Patient Registry:** Browse and inspect high-fidelity synthetic ABDM / FHIR R4 clinical profiles, longitudinal encounters, diagnostic panels, and prescriptions.
- **Clinical Escalation Queue:** Review clinical red-flag triggers, monitor tele-triage routing to eSanjeevani, and conduct clinician message interventions.
- **RAG Quality Evaluation:** Inspect automated RAGAS quality benchmarks (faithfulness, context recall, answer relevancy, context precision).
- **Universal HTTP Resilience:** Integrated `generateUUID()` fallback polyfill guaranteeing flawless crypto operations across both HTTPS and development HTTP environments.

---

## 3. Technology Stack

- **Frontend:** React 19, TypeScript, Vite
- **Icons & Styling:** Lucide React, Modern Vanilla CSS / Flexbox Grid
- **API Client:** Native `fetch` wrapper with automatic Bearer dev token authentication and correlation tracing (`X-Correlation-Id`)
- **Web Server:** Nginx Alpine (Reverse Proxy & Static Asset Server)
- **Containerization:** Multi-stage Docker build

---

## 4. Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- Docker (for containerized deployment)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Medtronic-LABS/vda-ui.git
   cd vda-ui
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file based on `.env.example`:
   ```env
   # In development pointing to local NestJS backend:
   VITE_API_BASE_URL=http://localhost:3000/api/v1

   # Or pointing to remote production backend:
   # VITE_API_BASE_URL=https://vda-api.mdtlabs.org/api/v1
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The portal will be available at `http://localhost:5173`.

---

## 5. Production Docker Deployment

The application includes a production-ready multi-stage [Dockerfile](Dockerfile) and [nginx.conf](nginx.conf) for containerized deployment.

### Build and Run Docker Container

```bash
# Build the Docker container with the target API URL
docker build -t vda-ui:latest \
  --build-arg VITE_API_BASE_URL=/api/v1 \
  --build-arg VITE_DEV_DEMO_MODE=true \
  --build-arg VITE_DEV_AUTH_TOKEN=vda-pilot-secret-dev-token-2026 .

# Run container mapped to port 8080
docker run -d \
  --name vda_ui_dev \
  --restart unless-stopped \
  -p 8080:80 \
  vda-ui:latest
```

### Nginx Host Configuration (Reverse Proxy & SSL)

When deploying behind host Nginx with Let's Encrypt SSL:

```nginx
server {
    server_name vda-admin.mdtlabs.org;
    client_max_body_size 50M;

    # Admin UI React SPA container
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Proxy for Admin UI requests
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/vda-admin.mdtlabs.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vda-admin.mdtlabs.org/privkey.pem;
}
```

---

## 6. Repository Links

- **Medtronic LABS Organization:** [https://github.com/Medtronic-LABS/vda-ui](https://github.com/Medtronic-LABS/vda-ui)
- **Personal Repository:** [https://github.com/paras0602/vda-ui](https://github.com/paras0602/vda-ui)
