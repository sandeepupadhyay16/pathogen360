#!/bin/bash

# Pathogen 360 - Production Deployment Script
# This script helps set up the environment and deploy the containers on EC2.

set -e

# 1. Environment Variable Setup
# Create a .env file if it doesn't exist. 
# Prompt the user for sensitive credentials.

ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
    echo "--- Initial Production Environment Setup ---"
    read -p "Enter Database Username [pathogen_user]: " DB_USER
    DB_USER=${DB_USER:-pathogen_user}
    
    read -sp "Enter Database Password: " DB_PASS
    echo ""
    
    read -sp "Enter NVIDIA API Key (Cloud Fallback): " NVIDIA_KEY
    echo ""
    
    read -p "Enter Local LLM Base URL [http://localhost:1234/v1]: " LLM_URL
    LLM_URL=${LLM_URL:-http://localhost:1234/v1}

    cat <<EOF > $ENV_FILE
# Database Credentials
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=pathogen360

# Database Connection URL (for the app container)
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@db:5432/pathogen360?schema=public

# LLM Configuration
NVIDIA_API_KEY=$NVIDIA_KEY
LM_STUDIO_BASE_URL=$LLM_URL
LM_STUDIO_API_KEY=na

# Models
LOCAL_LLM_MODEL=google/gemma-3-4b
CLOUD_LLM_MODEL=Qwen/Qwen2.5-72B-Instruct
LOCAL_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5
CLOUD_EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5
EOF
    echo "Success: $ENV_FILE created."
else
    echo "Using existing $ENV_FILE"
fi

# 2. Deploy using Docker Compose
echo "Starting deployment..."
docker-compose --env-file $ENV_FILE up -d --build

echo "---"
echo "Deployment Complete!"
echo "App is running at http://localhost:3000"
echo "Database is running on internal network."
