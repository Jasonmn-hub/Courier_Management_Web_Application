# Courier Management System

## Overview

A comprehensive full-stack Courier Management Web Application built with Node.js (Express.js), PostgreSQL, and React with TailwindCSS. The system provides role-based access control for managing courier operations across departments, with features including courier tracking, email notifications, dashboard analytics, and administrative controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety
- **UI Library**: Comprehensive component library using Radix UI primitives with shadcn/ui styling
- **Styling**: TailwindCSS with CSS variables for theming and consistent design system
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod schema validation for type-safe form handling
- **Charts**: Recharts for dashboard data visualization

### Backend Architecture
- **Runtime**: Node.js with Express.js framework using ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: OpenID Connect integration with Replit Auth for secure user authentication
- **Session Management**: Express sessions with PostgreSQL store for persistent user sessions
- **File Handling**: Multer middleware for file uploads (POD documents)
- **API Design**: RESTful API structure with consistent error handling

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database interactions
- **Schema Structure**: Comprehensive relational schema including:
  - Users with role-based permissions (admin, manager, user)
  - Departments for organizational structure
  - Couriers with status tracking (on_the_way, completed, deleted)
  - Custom fields with department-specific configurations
  - SMTP settings for email notifications
  - Audit logs for action tracking
  - Session storage for authentication state

### Role-Based Access Control
- **Admin**: Full system access including user management, department configuration, and system settings
- **Manager**: Department-specific courier management with delete/restore capabilities
- **User**: Limited to adding and editing couriers within their assigned department

### State Management Pattern
- **Client State**: React Hook Form for form state management
- **Server State**: TanStack React Query with optimistic updates and automatic cache invalidation
- **Authentication State**: Centralized auth hook with automatic route protection

### File Storage Strategy
- **Local Storage**: File uploads stored locally with organized directory structure
- **File Validation**: Strict file type validation (PDF, PNG, JPG) with size limits
- **Path Management**: Secure file path handling to prevent directory traversal

## External Dependencies

### Core Backend Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Replit Authentication**: OpenID Connect provider for secure user authentication
- **SMTP Service**: Configurable email service for courier notifications (admin-configurable)

### Development and Build Tools
- **Vite**: Modern build tool with hot module replacement and optimized bundling
- **TypeScript**: Type safety across the entire application stack
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer for browser compatibility

### UI and Component Libraries
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Lucide React**: Consistent icon library for visual elements
- **TailwindCSS**: Utility-first CSS framework with custom design tokens

### Data Visualization
- **Recharts**: React charting library for dashboard analytics and courier statistics

### Form and Validation
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation for runtime type checking
- **Hookform Resolvers**: Integration between React Hook Form and Zod schemas