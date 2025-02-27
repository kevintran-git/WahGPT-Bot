FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Create a non-root user and switch to it
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Create required directories with proper permissions (if they don't exist)
RUN mkdir -p /usr/src/app/logs /usr/src/app/session && \
    chmod 777 /usr/src/app/logs /usr/src/app/session

# Switch to non-root user
USER nodejs

# Command to run the app
CMD ["node", "src/index.js", "--whatsapp", "--production"]