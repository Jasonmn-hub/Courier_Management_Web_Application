# Courier Management System

A comprehensive full-stack Courier Management Web Application built with Node.js, Express.js, PostgreSQL, and React. Features include department management, courier tracking, user authentication, role-based access control, and authority letter generation with Word document templates.

## 🚀 Quick Start on Replit

1. **Fork this Repl** or **Import from GitHub**
2. **Run the application** - Click the "Run" button or use the Start application workflow
3. **The app will automatically:**
   - Install all dependencies
   - Set up the PostgreSQL database
   - Run database migrations
   - Start the development server

## 🔧 Manual Setup (if needed)

If automatic setup doesn't work, run these commands in the Shell:

```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Start the application
npm run dev
```

## 📋 Requirements

- **Node.js**: 18.0.0 or higher
- **PostgreSQL**: Provided automatically by Replit
- **Environment**: Replit handles all environment variables automatically

## 🌟 Features

### 🔐 Authentication & Authorization
- **Replit Authentication**: Seamless login with Replit accounts
- **Role-based Access**: Admin, Manager, and User roles
- **Department-based Permissions**: Users restricted to their departments

### 📦 Courier Management
- **Courier Tracking**: Complete lifecycle management (on_the_way, completed, deleted)
- **Department Organization**: Couriers organized by departments
- **Custom Fields**: Configurable fields per department
- **POD Management**: Proof of Delivery document uploads

### 📄 Authority Letter System
- **Word Template Processing**: Upload .docx templates with ##placeholder## format
- **Dynamic Field Generation**: Create custom fields for each department
- **Text Formatting Options**:
  - UPPERCASE
  - Capitalize Each Word
  - tOGGLE cASE
  - Normal formatting
- **Real-time Preview**: See letter content before generation
- **Date Format Conversion**: Automatic YYYY-MM-DD to DD-MM-YYYY conversion

### 👥 User Management
- **Multi-role Support**: Admin, Manager, User roles
- **Department Assignment**: Users linked to specific departments
- **Activity Audit**: Complete audit trail of user actions

### 📊 Dashboard & Analytics
- **Real-time Statistics**: Courier counts and status tracking
- **Monthly Charts**: Visual data representation
- **Department Insights**: Performance metrics per department

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **TailwindCSS** with custom design system
- **Radix UI** components for accessibility
- **TanStack React Query** for state management
- **Wouter** for routing
- **React Hook Form** with Zod validation
- **Recharts** for data visualization

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **Drizzle ORM** with PostgreSQL
- **JWT Authentication** with session management
- **Multer** for file uploads
- **Docxtemplater** for Word document generation

### Database
- **PostgreSQL** with Drizzle ORM
- **Automatic Migrations** via drizzle-kit
- **Seeded Data** for development

## 📁 Project Structure

```
courier-management-system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and configurations
├── server/                # Express.js backend
│   ├── routes.ts          # API endpoints
│   ├── auth.ts           # Authentication logic
│   ├── storage.ts        # Database operations
│   └── index.ts          # Server entry point
├── shared/               # Shared types and schemas
│   └── schema.ts         # Database schema and types
└── uploads/              # File storage directory
```

## 🔒 Environment Variables

Replit automatically provides these variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REPL_ID` - Replit application ID
- `REPLIT_DOMAINS` - Application domain
- `JWT_SECRET` - Token signing secret
- `SESSION_SECRET` - Session encryption secret

## 🚀 Deployment

### Replit Deployment
1. Click "Deploy" in your Repl
2. Choose deployment type (Autoscale recommended)
3. Your app will be live at `your-repl-name.your-username.repl.co`

### Manual Deployment
```bash
# Build the application
npm run build

# Start production server
npm start
```

## 📖 Usage Guide

### For Administrators
1. **User Management**: Create and manage user accounts
2. **Department Setup**: Configure departments and custom fields
3. **Authority Templates**: Upload Word document templates
4. **System Settings**: Configure SMTP and audit settings

### For Managers
1. **Department Couriers**: Manage couriers within your department
2. **Authority Letters**: Generate official documents
3. **Team Oversight**: Monitor department performance

### For Users
1. **Courier Entry**: Add and track courier shipments
2. **Document Upload**: Attach POD documents
3. **Status Updates**: Update courier status and information

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database schema
npm run db:push

# Check database connection
# Check the Console tab for connection logs
```

### Environment Issues
```bash
# Verify environment variables are set
# Check the Secrets tab in Replit
```

### Build Issues
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Documentation**: [Project Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)
- **Replit Template**: [Fork This Repl](link-to-repl)

---

**Built with ❤️ for efficient courier management**