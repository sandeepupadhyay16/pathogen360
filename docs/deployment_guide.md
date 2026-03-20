# Production Deployment Guide (AWS EC2)

This guide explains how to secure and deploy Medical 360 in a production environment.

## 1. Managing Secrets & API Keys

In production, you should **never** hardcode passwords or API keys. Pathogen 360 uses environment variables for all sensitive data.

### LLM & API Keys
The application (via `src/lib/llm.ts`) looks for the following environment variables:
- `LM_STUDIO_BASE_URL`: The URL of your local LLM server (if running on the same EC2 or a separate instance).
- `NVIDIA_API_KEY`: Your cloud fallback key.
- `LM_STUDIO_API_KEY`: API key for your local provider (if applicable).

### Database Credentials
The PostgreSQL database is configured via:
- `POSTGRES_USER`: Database username.
- `POSTGRES_PASSWORD`: Database password.
- `DATABASE_URL`: The full connection string used by the Next.js app.

---

## 2. Automated Deployment

We have provided a deployment script to handle the initial setup on your EC2 instance.

1. **Upload the project** to your EC2 instance.
2. **Make the script executable**:
   ```bash
   chmod +x scripts/deploy-prod.sh
   ```
3. **Run the script**:
   ```bash
   ./scripts/deploy-prod.sh
   ```
   *The script will prompt you for your database password and NVIDIA API key, then generate a secure `.env.production` file that is used by Docker.*

---

## 3. Deployment Logic

### Local machine vs Cloud
- **Local Machine**: You likely have `.env` with `localhost` URLs.
- **Cloud (EC2)**: You use the Docker network. In the `docker-compose.yml`, the database is referenced by the service name `db` (e.g., `postgresql://user:pass@db:5432/...`).

### Updating Credentials
To update your credentials in the future:
1. Edit the `.env.production` file on the server.
2. Restart the containers:
   ```bash
   docker-compose --env-file .env.production up -d --build
   ```
