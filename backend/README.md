# Signature Backend (Node.js + Express)

## Prerequisites
- Node.js 18+
- PostgreSQL 13+
- A signing tool (e.g., `libresign`) available in PATH, or adjust `SIGN_COMMAND_TEMPLATE`

## Setup
1. Copy env example and edit values:
   - Windows PowerShell:
     ```powershell
     Copy-Item backend/env.example backend/.env
     ```
   - macOS/Linux:
     ```bash
     cp backend/env.example backend/.env
     ```

2. Create database and user, then apply schema:
   - See `backend/sql/README.md`

3. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

## Run
```bash
npm start
```
Server listens on `http://localhost:3000` by default.

## API
- POST `/api/docs/upload`
  - multipart/form-data; field name: `document`
  - returns: `{ id: number }`
- POST `/api/docs/sign`
  - json: `{ "documentId": number }`
  - returns: `{ message: string, signedPath: string }`

### cURL Examples
```bash
# Upload
curl -X POST -F "document=@/path/to/document.pdf" http://localhost:3000/api/docs/upload

# Sign (replace <id>)
curl -X POST -H "Content-Type: application/json" \
  -d '{"documentId": <id>}' \
  http://localhost:3000/api/docs/sign
```

## Nginx
Example config in `infra/nginx.conf`. After deploying HTTPS with Let's Encrypt:
```bash
sudo certbot --nginx -d yourdomain.com
```

## Notes
- Uploaded files are stored under `backend/uploads` (configurable via `UPLOAD_DIR`).
- The signing command can be customized using `SIGN_COMMAND_TEMPLATE` in `.env`.