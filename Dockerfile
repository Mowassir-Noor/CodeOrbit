# Stage 1: Build Frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM maven:3.9.6-eclipse-temurin-21 AS build-backend
WORKDIR /app
COPY pom.xml ./
# Go offline to cache dependencies
RUN mvn dependency:go-offline || true
COPY src ./src
# Create static directory and copy frontend build output into Spring Boot
# Note: Vite outDir in this project points to '../src/main/resources/static/dist'
RUN mkdir -p src/main/resources/static/dist
COPY --from=build-frontend /app/src/main/resources/static/dist ./src/main/resources/static/dist
# Package the application (skipping tests for faster production builds)
RUN mvn clean package -DskipTests

# Stage 3: Production Runtime Environment
FROM eclipse-temurin:21-jdk-jammy
WORKDIR /app

# Install execution dependencies (Python 3, GCC/G++, Go)
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    python3 \
    golang \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 and TypeScript (for TS execution)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g typescript ts-node \
    && rm -rf /var/lib/apt/lists/*

# Install Rust for all users
ENV RUSTUP_HOME=/opt/rust
ENV CARGO_HOME=/opt/cargo
ENV PATH="/opt/cargo/bin:${PATH}"
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path \
    && chmod -R a+w /opt/rust /opt/cargo

# Create a non-root user for security
RUN useradd -ms /bin/bash codeorbit

COPY --from=build-backend /app/target/*.jar app.jar
RUN chown codeorbit:codeorbit app.jar

# Switch to the non-root user
USER codeorbit

# Expose Spring Boot default port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
