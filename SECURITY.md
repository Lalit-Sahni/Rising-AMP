# Security Policy

## Supported Versions

We currently support the following versions of Rising-AMP:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Rising-AMP, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [your-email@domain.com]
3. Include as much detail as possible about the vulnerability
4. Allow reasonable time for response before public disclosure

## Security Best Practices

### Environment Variables
- Never commit `.env.local` or any file containing API keys
- Use `.env.example` as a template for required variables
- Rotate API keys regularly
- Use different keys for development and production

### Firebase Security
- Keep Firebase security rules up to date
- Use proper authentication and authorization
- Regularly audit Firestore access patterns
- Monitor for unusual data access

### API Keys
- Google Cloud Vision API keys should be restricted to specific domains
- Firebase API keys are safe to expose in client-side code
- Never expose server-side API keys in client code

### Data Protection
- All business data is stored securely in Firebase
- Regular backups are created automatically
- Data is encrypted in transit and at rest
- Access is controlled through Firebase security rules

## Security Checklist

Before deploying to production:

- [ ] All API keys moved to environment variables
- [ ] No hardcoded secrets in source code
- [ ] Firebase security rules properly configured
- [ ] Environment variables properly set
- [ ] Security audit completed (`npm audit`)
- [ ] Dependencies updated to latest secure versions
- [ ] Backup system tested and working

## Known Security Considerations

### OCR Processing
- Images are processed client-side for OCR
- No images are stored permanently
- OCR API calls are made directly from client
- Consider implementing server-side OCR for sensitive documents

### Data Access
- Current implementation uses access codes for data isolation
- Consider implementing proper user authentication
- Regular access code rotation recommended

## Contact

For security-related questions or to report vulnerabilities, please contact:
- Email: [your-email@domain.com]
- GitHub: [your-github-username]

## Acknowledgments

We appreciate the security research community and responsible disclosure practices.
