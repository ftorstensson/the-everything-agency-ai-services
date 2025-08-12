# Stage 1: Build the application
# Use the official Node.js 20 image as a builder.
FROM node:20-slim as builder

# Set the working directory in the container.
WORKDIR /app

# Copy the dependency manifests.
COPY package.json package-lock.json ./

# Install dependencies cleanly and deterministically.
# This uses the --omit=dev flag to avoid installing devDependencies
# in the final production image.
RUN npm ci --omit=dev

# Copy the rest of the source code.
COPY . .

# Compile the TypeScript code into JavaScript.
RUN npm run build

# Stage 2: Create the final, minimal production image
# Use a minimal Node.js image for the final container to reduce size and attack surface.
FROM node:20-slim

# Set the working directory.
WORKDIR /app

# Create a non-root user for security, as recommended by the expert.
RUN useradd -r -s /bin/false appuser && chown -R appuser:appuser /app

# Switch to the non-root user.
USER appuser

# Copy the installed dependencies and the compiled code from the 'builder' stage.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose the port that Cloud Run will listen on.
EXPOSE 8080

# The command to run when the container starts.
CMD ["node", "dist/index.js"]