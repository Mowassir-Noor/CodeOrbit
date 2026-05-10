# CodeOrbit Render Deployment Guide

This guide outlines the steps to deploy the CodeOrbit application on Render as a Docker-containerized Web Service.

## Prerequisites
- A Render account (render.com)
- Your project pushed to a Git repository (GitHub/GitLab) connected to Render
- A remote PostgreSQL database (like your Aiven instance)

## Step 1: Create a New Web Service on Render

1. Go to the **Render Dashboard** and click **New+** > **Web Service**.
2. Connect your Git repository containing CodeOrbit.
3. In the setup form, provide the following details:
   - **Name**: `codeorbit`
   - **Environment**: `Docker`
   - **Region**: Select the region closest to your database
   - **Branch**: `main` (or whichever branch you want to deploy)

## Step 2: Environment Variables

Render allows you to inject environment variables securely. Add the following environment variables to your Web Service:

| Key | Value | Description |
|-----|-------|-------------|
| `PORT` | `8080` | Port for Spring Boot (Render auto-routes this) |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://nebula-sobannoor01-ddf3.h.aivencloud.com:23519/defaultdb?sslmode=require` | Your Aiven DB connection string |
| `SPRING_DATASOURCE_USERNAME` | `avnadmin` | Your database user |
| `SPRING_DATASOURCE_PASSWORD` | `YOUR_SECRET_PASSWORD` | Your database password |
| `JWT_SECRET` | `generate-a-secure-random-base64-string-here` | Secret key for JWT signing |
| `JWT_EXPIRATION` | `86400000` | Token expiration in ms (86400000 = 1 day) |
| `GOOGLE_CLIENT_ID` | `your-google-client-id` | OAuth2 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `your-google-client-secret` | OAuth2 Client Secret from Google Cloud Console |

> **Note:** The `Dockerfile` multi-stage build will automatically bundle the React application into the Spring Boot `.jar` and spin up the production container.

> **Google OAuth Setup:** In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client IDs, add `https://<your-service>.onrender.com/login/oauth2/code/google` as an **Authorised redirect URI**. All frontend links use relative URLs so no hardcoded host is needed.

## Architecture & Compatibility

- **WebContainers Support:** The `WebContainerFilterConfig` ensures the exact `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers are sent. Render will proxy these accurately, allowing `SharedArrayBuffer` and the terminal `WebContainer` to function seamlessly.
- **WebSockets:** Render supports WebSockets natively. STOMP and SockJS traffic will route automatically. No extra configuration is needed.
- **Image Storage:** Since you use PostgreSQL `BYTEA` (BLOB) for profile image storage, images will survive container redeploys and scaling events. No persistent disk is required on Render.
- **Code Execution:** The runtime stage is based on `eclipse-temurin:21-jre-jammy` and installs Node.js 20, Python 3, GCC/G++, Go, Rust, and the JDK for user code execution. All tools run as the non-root `codeorbit` user for security.

## Deployment Trigger
Once the service is created, Render will automatically detect the `Dockerfile` and begin building:
1. `build` stage: Installs Node.js, runs `npm run build` (Vite outputs directly into `src/main/resources/static/dist`), then packages the Spring Boot JAR with Maven.
2. `runtime` stage: Installs all execution language runtimes (Node.js, Python 3, GCC/G++, Go, Rust, Java), copies the JAR, and starts the Spring server on port 8080 as the non-root `codeorbit` user.

After the build succeeds, CodeOrbit will be accessible via your generated `.onrender.com` URL.
