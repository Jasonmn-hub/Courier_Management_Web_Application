# Contributing to Courier Management System

## Quick Start for Contributors

### Setting up the Development Environment

1. **Fork the Repository** on GitHub
2. **Import to Replit**: 
   - Go to Replit and click "Import from GitHub"
   - Paste your fork's URL
   - Click "Import" - everything will setup automatically

3. **Start Development**: 
   - Click "Run" in Replit
   - The app will automatically install dependencies and setup the database
   - Start coding!

### Development Workflow

1. **Make Changes**: Edit files in the Replit editor
2. **Test Locally**: The development server auto-reloads
3. **Commit Changes**: Use Git commands in the Shell tab
4. **Push to GitHub**: `git push origin your-branch-name`
5. **Create Pull Request**: Submit your changes for review

### Project Structure for Contributors

```
courier-management-system/
├── client/                 # React frontend
│   ├── src/components/     # Reusable UI components
│   ├── src/pages/         # Application pages
│   ├── src/hooks/         # Custom React hooks
│   └── src/lib/           # Utilities
├── server/                # Express.js backend
│   ├── routes.ts          # API endpoints
│   ├── auth.ts           # Authentication
│   ├── storage.ts        # Database operations
│   └── index.ts          # Server entry
├── shared/               # Shared types and schemas
│   └── schema.ts         # Database schema
└── uploads/              # File storage
```

### Key Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Update database schema
npm run db:push

# Type checking
npm run check

# Build for production
npm run build
```

### Making Contributions

#### Types of Contributions Welcome
- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation improvements
- 🎨 UI/UX enhancements
- ⚡ Performance optimizations
- 🧪 Tests and test coverage

#### Contribution Guidelines

1. **Follow the existing code style**
   - Use TypeScript for type safety
   - Follow React best practices
   - Use TailwindCSS for styling
   - Follow the existing component patterns

2. **Write clear commit messages**
   ```
   feat: add text formatting options to authority letters
   fix: resolve date format conversion issue
   docs: update setup instructions
   ```

3. **Test your changes**
   - Verify the app runs without errors
   - Test all affected functionality
   - Check both desktop and mobile layouts

4. **Update documentation**
   - Update README.md if adding new features
   - Add comments for complex code
   - Update API documentation if needed

### Code Style Guidelines

#### Frontend (React/TypeScript)
- Use functional components with hooks
- Use TypeScript interfaces for type definitions
- Follow the existing component structure
- Use TailwindCSS utility classes
- Add data-testid attributes for user interactions

#### Backend (Node.js/Express)
- Use TypeScript for all server code
- Follow RESTful API conventions
- Use Drizzle ORM for database operations
- Add proper error handling
- Include authentication checks for protected routes

#### Database (PostgreSQL/Drizzle)
- Add new tables to `shared/schema.ts`
- Use proper foreign key relationships
- Run `npm run db:push` after schema changes
- Follow existing naming conventions

### Common Development Tasks

#### Adding a New Feature
1. Plan the feature and discuss in issues
2. Create database schema changes if needed
3. Implement backend API endpoints
4. Create frontend components
5. Add proper error handling
6. Test thoroughly
7. Update documentation

#### Fixing a Bug
1. Reproduce the issue
2. Identify the root cause
3. Write a test that reproduces the bug
4. Fix the issue
5. Verify the test passes
6. Test related functionality

#### Improving UI/UX
1. Follow the existing design patterns
2. Use the established color scheme
3. Ensure responsive design
4. Test on different screen sizes
5. Maintain accessibility standards

### Getting Help

- **Issues**: Check existing issues for similar problems
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Refer to README.md and SETUP.md
- **Code Examples**: Look at existing components for patterns

### Testing Your Changes

Before submitting a pull request:

1. **Functionality Testing**
   - Test all user roles (Admin, Manager, User)
   - Verify authentication works
   - Test file uploads and downloads
   - Check authority letter generation

2. **Browser Testing**
   - Test in different browsers
   - Verify mobile responsiveness
   - Check for console errors

3. **Database Testing**
   - Verify database operations work
   - Test with different data scenarios
   - Check data validation

### Pull Request Process

1. **Create a clear title**: Describe what your PR does
2. **Write a detailed description**: Explain the changes and why
3. **Link related issues**: Reference any issue numbers
4. **Request review**: Ask for feedback from maintainers
5. **Respond to feedback**: Make requested changes promptly

### Code Review Guidelines

When reviewing PRs:
- Check for code quality and consistency
- Verify functionality works as intended
- Look for potential security issues
- Ensure documentation is updated
- Test the changes locally

Thank you for contributing to the Courier Management System! 🚀