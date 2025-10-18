# Contributing to Rising-AMP

Thank you for your interest in contributing to Rising-AMP! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites
- Node.js 18.17.0 or higher
- npm or yarn package manager
- Git

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/Rising-AMP.git
   cd Rising-AMP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Firebase and API keys
   ```

4. **Start development server**
   ```bash
   npm start
   ```

## Development Guidelines

### Code Style
- Use ESLint and Prettier for consistent formatting
- Follow React best practices
- Use functional components with hooks
- Implement proper error boundaries
- Write meaningful commit messages

### File Structure
```
src/
├── components/          # React components
├── context/            # React context providers
├── firebase/           # Firebase configuration and services
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── utils/              # Utility functions
└── styles/             # CSS and styling files
```

### Component Guidelines
- Use TypeScript for type safety (when available)
- Implement proper prop validation
- Use React.memo for performance optimization
- Follow single responsibility principle
- Keep components small and focused

### Firebase Guidelines
- Use environment variables for all configuration
- Implement proper error handling
- Use batch operations for multiple writes
- Follow Firebase security best practices
- Test with Firebase emulator when possible

## Testing

### Running Tests
```bash
npm test
```

### Test Coverage
- Aim for >80% test coverage
- Test user interactions
- Test error scenarios
- Test Firebase operations

### Manual Testing
- Test all expense categories
- Test OCR functionality
- Test data export/import
- Test responsive design

## Pull Request Process

### Before Submitting
1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow coding guidelines
   - Add tests if applicable
   - Update documentation

3. **Test your changes**
   ```bash
   npm test
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Pull Request Guidelines
- Provide a clear description of changes
- Include screenshots for UI changes
- Reference any related issues
- Ensure all checks pass
- Request review from maintainers

### Commit Message Format
```
type(scope): description

feat(ocr): add enhanced text extraction
fix(firebase): resolve data sync issues
docs(readme): update installation instructions
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Security Considerations

### Before Contributing
- Never commit API keys or secrets
- Use environment variables for all configuration
- Follow security best practices
- Test with Firebase emulator

### Code Review Checklist
- [ ] No hardcoded secrets
- [ ] Proper error handling
- [ ] Input validation
- [ ] Security considerations addressed
- [ ] Tests included

## Documentation

### Updating Documentation
- Keep README.md up to date
- Document new features
- Update API documentation
- Include usage examples

### Code Comments
- Comment complex logic
- Document function parameters
- Explain business logic
- Use JSDoc for functions

## Issue Reporting

### Bug Reports
Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Screenshots if applicable

### Feature Requests
Include:
- Clear description of the feature
- Use case and benefits
- Implementation suggestions
- Mockups or examples

## Release Process

### Version Numbering
We use semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Version bumped
- [ ] Changelog updated
- [ ] Security audit completed

## Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow the golden rule

### Getting Help
- Check existing issues and discussions
- Ask questions in GitHub discussions
- Join our community chat (if available)
- Read the documentation thoroughly

## License

By contributing to Rising-AMP, you agree that your contributions will be licensed under the same license as the project.

## Thank You

Thank you for contributing to Rising-AMP! Your contributions help make this project better for everyone.
