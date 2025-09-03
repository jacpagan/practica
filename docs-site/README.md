# Practika Documentation Site

A professional documentation hub for the Practika movement training platform.

## 🚀 Quick Deploy

### Option 1: AWS S3 + CloudFront (Recommended)
```bash
cd docs-site
./deploy.sh
# Choose option 1
# Enter your subdomain (e.g., docs.jpagan.com)
```

### Option 2: Netlify (Free)
```bash
cd docs-site
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### Option 3: Vercel (Free)
```bash
cd docs-site
npm install -g vercel
vercel login
vercel --prod
```

### Option 4: Local Development
```bash
cd docs-site
./deploy.sh
# Choose option 5
# Visit http://localhost:8000
```

## 📁 Site Structure

```
docs-site/
├── index.html                 # Main documentation homepage
├── interactive-diagrams.html   # Interactive Mermaid diagrams
├── deploy.sh                  # Deployment script
├── README.md                  # This file
├── architecture/              # Architecture documentation
├── flows/                     # User flow documentation
├── database/                  # Database documentation
└── api/                       # API documentation
```

## 🎨 Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Interactive Diagrams**: Mermaid.js powered visualizations
- **Role-Based Navigation**: Different sections for PMs, Devs, and DevOps
- **Modern UI**: Tailwind CSS with smooth animations
- **Fast Loading**: Optimized for performance

## 🔧 Customization

### Adding New Documentation
1. Create your markdown file in the appropriate subdirectory
2. Convert to HTML with Mermaid support
3. Add link to the main navigation in `index.html`

### Styling
- Uses Tailwind CSS for styling
- Custom CSS in the `<style>` section of each HTML file
- Font Awesome icons for visual elements

### Interactive Diagrams
- All diagrams use Mermaid.js
- Diagrams are embedded directly in HTML files
- Supports flowcharts, sequence diagrams, ERDs, and journey maps

## 🌐 Subdomain Ideas

Here are some cool subdomain options for your documentation:

- `docs.jpagan.com` - Simple and professional
- `practika.docs.jpagan.com` - Branded subdomain
- `docs.practika.jpagan.com` - Alternative branded approach
- `tech.jpagan.com` - General tech documentation
- `build.jpagan.com` - Development-focused
- `ship.jpagan.com` - Product-focused

## 📊 Analytics & Monitoring

Consider adding:
- Google Analytics for visitor tracking
- Hotjar for user behavior analysis
- Uptime monitoring (UptimeRobot, Pingdom)
- Error tracking (Sentry)

## 🔒 Security

- HTTPS enforcement
- Content Security Policy headers
- Regular security updates
- Access logging and monitoring

## 🚀 Performance Tips

- Enable CloudFront compression
- Use appropriate cache headers
- Optimize images and assets
- Consider CDN for global distribution
- Monitor Core Web Vitals

---

*Built with ❤️ for the Practika team*
