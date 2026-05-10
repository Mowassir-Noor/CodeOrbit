# ─────────────────────────────────────────────
# Stage 1: Build Frontend + Backend together
# Vite outDir '../src/main/resources/static/dist' requires both
# frontend/ and src/ to be siblings — handled here naturally.
# ─────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Install Node.js 20 for frontend build
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Cache Maven dependencies
COPY pom.xml ./
RUN mvn dependency:go-offline -q || true

# Build frontend (outDir resolves to /app/src/main/resources/static/dist)
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Build backend (frontend assets already in place)
COPY src ./src
RUN mvn clean package -DskipTests -q

# ─────────────────────────────────────────────
# Stage 3: Production Runtime
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Install code execution dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    build-essential \
    python3 \
    python3-pip \
    golang-go \
    default-jdk \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 + TypeScript/ts-node (for JS/TS execution)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g typescript ts-node \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (system-wide, non-interactive)
ENV RUSTUP_HOME=/opt/rust \
    CARGO_HOME=/opt/cargo \
    PATH="/opt/cargo/bin:${PATH}"
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --no-modify-path --profile minimal \
    && chmod -R a+rx /opt/rust /opt/cargo

# Create a non-root user for security
RUN useradd -ms /bin/bash codeorbit

COPY --from=build /app/target/*.jar app.jar
RUN chown codeorbit:codeorbit app.jar

USER codeorbit

# JVM tuning for container environments
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

# Runtime environment variables (override at docker run / platform dashboard)
ENV PORT=8080 \
    SPRING_DATASOURCE_URL="" \
    SPRING_DATASOURCE_USERNAME="" \
    SPRING_DATASOURCE_PASSWORD="" \
    JWT_SECRET="" \
    JWT_EXPIRATION=86400000 \
    GOOGLE_CLIENT_ID="" \
    GOOGLE_CLIENT_SECRET=""

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:${PORT}/login || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
