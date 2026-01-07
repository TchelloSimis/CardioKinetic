# Contributing to CardioKinetic

Thanks for your interest in contributing! CardioKinetic is a community-driven project and we welcome contributions of all kinds.

## Ways to Contribute

### Bug Reports
Found a bug? [Open an issue](https://github.com/TchelloSimis/CardioKinetic/issues/new?template=bug_report.md) with:
- Device and Android version
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable

### Feature Requests
Have an idea? [Open a feature request](https://github.com/TchelloSimis/CardioKinetic/issues/new?template=feature_request.md) describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Code Contributions

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/CardioKinetic.git
   cd CardioKinetic
   npm install
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow existing code style (TypeScript, React patterns)
   - Add tests for new functionality
   - Run `npm run test` to verify

4. **Submit PR**
   - Describe what you changed and why
   - Link related issues
   - Include screenshots for UI changes

### Documentation
Help improve docs, fix typos, add examples, or translate content.

### Testing
- Try new features and report issues
- Test on different Android devices
- Validate training templates

## Development Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Android build
npx cap sync android
```

## Code Style

- TypeScript strict mode enabled
- Functional React components with hooks
- Descriptive variable/function names
- Comments for complex algorithms

## Questions?

Open a [Discussion](https://github.com/TchelloSimis/CardioKinetic/discussions) for general questions or ideas.

---

**Thank you for making CardioKinetic better!**
