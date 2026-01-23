# Production Deployment Guide

This document provides instructions for deploying the Zone-D LandLord Management Application to production.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account and project
- EmailJS account (for email functionality)
- WhatsApp Business Account (for WhatsApp functionality, optional)

## Environment Configuration

Create a `.env.production` file with the following variables:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# EmailJS Configuration (Required for email functionality)
VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
VITE_EMAILJS_TEMPLATE_RECEIPT=your_receipt_template_id
VITE_EMAILJS_TEMPLATE_CELEBRATION=your_celebration_template_id
VITE_EMAILJS_TEMPLATE_NOTIFICATION=your_notification_template_id
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key

# WhatsApp Cloud API Configuration (Optional)
VITE_WHATSAPP_API_URL=https://graph.facebook.com/v17.0
VITE_WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
VITE_WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token

# Estate Configuration
ESTATE_NAME=Your Estate Name
ESTATE_ZONE=Your Estate Zone
```

## Supabase Edge Functions Configuration

If using WhatsApp functionality, configure these secrets in your Supabase project:

```bash
# Navigate to your Supabase project dashboard
# Go to Database > Settings > Environment variables

# For WhatsApp functionality:
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
```

## Build Process

### 1. Install Dependencies
```bash
npm install
```

### 2. Build for Production
```bash
npm run build
```

The build output will be in the `dist/` directory.

### 3. Verify Build
```bash
# Preview the production build locally
npm run preview
```

## Deployment Options

### Option 1: Static Hosting (Netlify, Vercel, GitHub Pages)

1. Build the application: `npm run build`
2. Deploy the `dist/` folder contents to your static hosting provider
3. Ensure your hosting provider serves the site with proper routing for SPA behavior

### Option 2: Self-Hosting with Nginx

1. Build the application: `npm run build`
2. Copy contents of `dist/` folder to your web server directory
3. Configure Nginx with proper routing for SPA:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

### Option 3: Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t zone-d-landlord-app .
docker run -p 80:80 -d zone-d-landlord-app
```

## Post-Deployment Steps

### 1. Verify Environment Variables
Ensure all required environment variables are set in your production environment.

### 2. Test Core Functionality
- User authentication
- Payment processing
- Receipt generation
- Email/WhatsApp notifications (if configured)

### 3. Set Up Monitoring
Consider setting up monitoring for:
- Application uptime
- Error tracking
- Performance metrics
- Database connections

## Security Best Practices

### Environment Variables
- Never commit actual credentials to version control
- Use environment-specific configuration
- Rotate credentials regularly

### SSL/TLS
- Ensure HTTPS is enabled in production
- Use strong TLS configuration
- Regularly update certificates

### Supabase Security
- Review Row Level Security (RLS) policies
- Limit database permissions to minimum required
- Enable audit logging

### Regular Maintenance
- Keep dependencies updated
- Monitor for security vulnerabilities
- Regular backups of critical data

## Troubleshooting

### Common Issues

#### Environment Variables Not Loading
- Verify variables are prefixed with `VITE_`
- Restart development server after changing environment variables
- Check that production environment has correct variables set

#### Email/WhatsApp Not Working
- Verify service credentials are correctly configured
- Check that Supabase Edge Functions have proper secrets set
- Test connectivity to external services

#### Build Failures
- Ensure all dependencies are installed
- Check for syntax errors in code
- Verify environment variables are properly formatted

## Rollback Procedure

If issues occur after deployment:

1. Identify the problematic changes
2. Revert to the previous stable build
3. Test functionality
4. Investigate and fix the issue
5. Redeploy the corrected version