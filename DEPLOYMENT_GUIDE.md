# Digibook Deployment Guide

## 🚀 **Overview**

This guide covers the complete deployment process for Digibook, including build optimization, environment configuration, and deployment strategies.

## 📋 **Pre-Deployment Checklist**

### **Quality Assurance**
- [ ] All tests passing (`npm run test:run`)
- [ ] Code quality checks passing (`npm run lint`)
- [ ] Code formatting consistent (`npm run format:check`)
- [ ] Performance benchmarks met
- [ ] Accessibility compliance verified
- [ ] Security audit completed
- [ ] Documentation updated

### **Build Verification**
- [ ] Production build successful (`npm run build`)
- [ ] Build size optimized
- [ ] No console errors in production
- [ ] All assets loading correctly
- [ ] Performance metrics acceptable

## 🏗️ **Build Process**

### **Production Build**
```bash
# Clean previous builds
rm -rf dist/

# Install dependencies
npm ci

# Run quality checks
npm run quality

# Build for production
npm run build

# Verify build
npm run preview
```

### **Build Optimization**
- **Tree Shaking**: Unused code automatically removed
- **Code Splitting**: Automatic route-based splitting
- **Asset Optimization**: Images and fonts optimized
- **Bundle Analysis**: Use `npm run build -- --analyze` for bundle analysis

### **Environment Configuration**
```bash
# Production environment
VITE_APP_ENV=production
VITE_APP_DEBUG=false
VITE_APP_LOG_LEVEL=error

# Staging environment
VITE_APP_ENV=staging
VITE_APP_DEBUG=true
VITE_APP_LOG_LEVEL=warn
```

## 🌐 **Deployment Options**

### **Static Hosting (Recommended)**

#### **Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Environment variables
vercel env add VITE_APP_ENV production
```

#### **Netlify**
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist

# Environment variables
netlify env:set VITE_APP_ENV production
```

#### **GitHub Pages**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### **CDN Deployment**

#### **AWS S3 + CloudFront**
```bash
# Install AWS CLI
aws configure

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

#### **Google Cloud Storage**
```bash
# Install gcloud CLI
gcloud auth login

# Upload to GCS
gsutil -m rsync -r -d dist/ gs://your-bucket-name

# Set public access
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

## 🔧 **Server Configuration**

### **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/digibook/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### **Apache Configuration**
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/digibook/dist

    # Enable compression
    LoadModule deflate_module modules/mod_deflate.so
    <Location />
        SetOutputFilter DEFLATE
        SetEnvIfNoCase Request_URI \
            \.(?:gif|jpe?g|png)$ no-gzip dont-vary
        SetEnvIfNoCase Request_URI \
            \.(?:exe|t?gz|zip|bz2|sit|rar)$ no-gzip dont-vary
    </Location>

    # Cache static assets
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
        Header append Cache-Control "public, immutable"
    </LocationMatch>

    # Handle client-side routing
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]

    # Security headers
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</VirtualHost>
```

## 🔒 **Security Configuration**

### **Content Security Policy**
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

### **Security Headers**
```javascript
// vite.config.js
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-XSS-Protection', '1; mode=block');
          res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
          next();
        });
      }
    }
  ]
});
```

## 📊 **Performance Optimization**

### **Build Optimization**
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          utils: ['dexie', 'zustand']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

### **Runtime Optimization**
- **Service Worker**: Offline functionality
- **Lazy Loading**: Route-based code splitting
- **Image Optimization**: WebP format with fallbacks
- **Font Optimization**: Preload critical fonts

## 🔍 **Monitoring & Analytics**

### **Error Tracking**
```javascript
// Error boundary with reporting
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Report to Sentry, LogRocket, etc.
    }
  }
}
```

### **Performance Monitoring**
```javascript
// Performance monitoring
if (process.env.NODE_ENV === 'production') {
  // Web Vitals monitoring
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  });
}
```

## 🚨 **Rollback Strategy**

### **Automated Rollback**
```bash
#!/bin/bash
# rollback.sh

PREVIOUS_VERSION=$1
if [ -z "$PREVIOUS_VERSION" ]; then
    echo "Usage: ./rollback.sh <version>"
    exit 1
fi

# Deploy previous version
aws s3 sync s3://your-bucket-name/$PREVIOUS_VERSION/ s3://your-bucket-name/ --delete

# Invalidate CDN
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"

echo "Rolled back to version: $PREVIOUS_VERSION"
```

### **Manual Rollback**
1. **Identify Issue**: Check monitoring dashboards
2. **Assess Impact**: Determine severity and scope
3. **Execute Rollback**: Deploy previous stable version
4. **Verify Fix**: Confirm issue is resolved
5. **Post-Mortem**: Document and analyze root cause

## 📋 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Code review completed
- [ ] Tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Backup created

### **Deployment**
- [ ] Environment variables configured
- [ ] Build successful
- [ ] Deployment successful
- [ ] Health checks passing
- [ ] Monitoring configured

### **Post-Deployment**
- [ ] Smoke tests passing
- [ ] Performance metrics acceptable
- [ ] Error rates normal
- [ ] User feedback positive
- [ ] Documentation updated

## 🆘 **Troubleshooting**

### **Common Issues**

#### **Build Failures**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### **Runtime Errors**
- Check browser console for errors
- Verify environment variables
- Check network connectivity
- Validate data integrity

#### **Performance Issues**
- Analyze bundle size
- Check for memory leaks
- Optimize images and assets
- Review database queries

### **Emergency Procedures**
1. **Immediate Rollback**: Deploy previous version
2. **Issue Isolation**: Identify affected components
3. **Communication**: Notify stakeholders
4. **Resolution**: Fix and redeploy
5. **Documentation**: Update runbooks

---

*This guide should be reviewed and updated with each deployment.*
