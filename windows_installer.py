#!/usr/bin/env python3
"""
Windows Automatic Installer for Courier Management System
Installs Node.js, npm dependencies, sets up PostgreSQL database, and starts the application.
"""

import os
import sys
import subprocess
import json
import urllib.request
import tempfile
import shutil
import ctypes
import time
import secrets
import string
from pathlib import Path

class CourierInstaller:
    def __init__(self):
        self.node_version = "20.11.0"  # LTS version
        self.project_dir = Path(__file__).parent.absolute()
        self.db_name = "LMF"
        self.db_user = "postgres"
        self.db_password = "root"
        self.db_host = "localhost"
        self.db_port = "5432"
        
    def is_admin(self):
        """Check if running with administrator privileges"""
        try:
            return ctypes.windll.shell32.IsUserAnAdmin()
        except:
            return False
    
    def run_as_admin(self):
        """Re-run the script with administrator privileges"""
        if self.is_admin():
            return True
        else:
            print("⚠️  Administrator privileges required for Node.js installation")
            print("🔄 Restarting with administrator privileges...")
            ctypes.windll.shell32.ShellExecuteW(
                None, "runas", sys.executable, " ".join(sys.argv), None, 1
            )
            return False

    def run_command(self, cmd, check=True, shell=True, env=None, cwd=None):
        """Run a command and handle errors"""
        try:
            if env is None:
                env = os.environ.copy()
            
            print(f"🔄 Running: {cmd}")
            result = subprocess.run(
                cmd, 
                shell=shell, 
                check=check, 
                capture_output=True, 
                text=True,
                env=env,
                cwd=cwd or self.project_dir
            )
            if result.stdout.strip():
                print(f"✅ {result.stdout.strip()}")
            return result
        except subprocess.CalledProcessError as e:
            print(f"❌ Command failed: {cmd}")
            print(f"Error: {e.stderr}")
            if check:
                raise
            return e

    def check_node_installed(self):
        """Check if Node.js is installed and get version"""
        try:
            result = subprocess.run(
                ["node", "--version"], 
                capture_output=True, 
                text=True, 
                check=True
            )
            version = result.stdout.strip()
            print(f"✅ Node.js found: {version}")
            
            # Check npm too
            result = subprocess.run(
                ["npm", "--version"], 
                capture_output=True, 
                text=True, 
                check=True
            )
            npm_version = result.stdout.strip()
            print(f"✅ npm found: v{npm_version}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def install_node_windows(self):
        """Install Node.js on Windows using winget or direct download"""
        print("📦 Installing Node.js...")
        
        # Try winget first (Windows 10 1709+)
        try:
            result = subprocess.run(
                ["winget", "install", "-e", "--id", "OpenJS.NodeJS.LTS", "--accept-source-agreements", "--accept-package-agreements"],
                check=True,
                capture_output=True,
                text=True
            )
            print("✅ Node.js installed via winget")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("⚠️  winget not available, downloading Node.js MSI...")
            
        # Download and install MSI
        try:
            node_url = f"https://nodejs.org/dist/v{self.node_version}/node-v{self.node_version}-x64.msi"
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".msi") as tmp_file:
                print(f"📥 Downloading Node.js v{self.node_version}...")
                urllib.request.urlretrieve(node_url, tmp_file.name)
                msi_path = tmp_file.name
            
            # Install MSI silently
            print("📦 Installing Node.js...")
            subprocess.run([
                "msiexec", "/i", msi_path, 
                "/quiet", "/norestart",
                "ADDLOCAL=ALL"
            ], check=True)
            
            # Clean up
            os.unlink(msi_path)
            
            print("✅ Node.js installed successfully")
            print("🔄 PATH has been updated. Please close this window and run the installer again in a NEW command prompt.")
            print("   (This is required so Windows recognizes the new Node.js installation)")
            input("Press Enter to exit. Then reopen Command Prompt and run this script again...")
            sys.exit(0)
            
        except Exception as e:
            print(f"❌ Failed to install Node.js: {e}")
            return False

    def install_python_postgres_lib(self):
        """Install psycopg2-binary for database operations"""
        try:
            print("📦 Installing Python PostgreSQL library...")
            subprocess.run([
                sys.executable, "-m", "pip", "install", "psycopg2-binary"
            ], check=True)
            print("✅ PostgreSQL library installed")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install PostgreSQL library: {e}")
            return False

    def setup_database(self):
        """Create database if it doesn't exist"""
        print(f"🔧 Setting up PostgreSQL database '{self.db_name}'...")
        
        try:
            import psycopg2
            from psycopg2 import sql
            from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
        except ImportError:
            if not self.install_python_postgres_lib():
                print("❌ Cannot setup database without PostgreSQL library")
                return False
            import psycopg2
            from psycopg2 import sql
            from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

        try:
            # Connect to PostgreSQL server (postgres database)
            # Try different connection string formats for compatibility
            conn_params = {
                'host': self.db_host,
                'port': self.db_port,
                'user': self.db_user,
                'password': self.db_password,
                'database': 'postgres'
            }
            conn = psycopg2.connect(**conn_params)
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cursor = conn.cursor()
            
            # Check if database exists
            cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (self.db_name,))
            exists = cursor.fetchone()
            
            if not exists:
                print(f"📦 Creating database '{self.db_name}'...")
                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(self.db_name)))
                print(f"✅ Database '{self.db_name}' created successfully")
            else:
                print(f"✅ Database '{self.db_name}' already exists")
                
            cursor.close()
            conn.close()
            
            return True
            
        except psycopg2.Error as e:
            print(f"❌ Database setup failed: {e}")
            print("⚠️  Please ensure:")
            print(f"   ✓ PostgreSQL service is running")
            print(f"   ✓ Host: {self.db_host}:{self.db_port}")
            print(f"   ✓ User: {self.db_user}")
            print(f"   ✓ Password: {self.db_password}")
            print("   ✓ User has database creation privileges")
            print("\n🔧 Common solutions:")
            print("   - Check Windows Services for 'postgresql' service")
            print("   - Verify credentials in pgAdmin or psql")
            print("   - Ensure PostgreSQL is accepting connections on localhost")
            return False

    def create_env_file(self):
        """Create .env file with database configuration"""
        print("📝 Creating environment configuration...")
        
        # Generate secure session secret
        session_secret = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(64))
        
        env_content = f"""# Database Configuration
DATABASE_URL=postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}

# Server Configuration
PORT=5000
NODE_ENV=development

# Session Configuration
SESSION_SECRET={session_secret}

# Optional Email Configuration (configure in admin settings)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
"""
        
        env_path = self.project_dir / ".env"
        with open(env_path, 'w') as f:
            f.write(env_content)
        
        print(f"✅ Environment file created: {env_path}")
        return True

    def install_npm_dependencies(self):
        """Install npm dependencies"""
        print("📦 Installing application dependencies...")
        
        # Check if package.json exists
        package_json = self.project_dir / "package.json"
        if not package_json.exists():
            print(f"❌ package.json not found in {self.project_dir}")
            return False
        
        # Install dependencies
        try:
            # Try npm ci first (faster, more reliable)
            if (self.project_dir / "package-lock.json").exists():
                self.run_command("npm ci")
            else:
                self.run_command("npm install")
            
            print("✅ Dependencies installed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            print("❌ Dependency installation failed")
            print("⚠️  If you see build errors, you may need to install Microsoft C++ Build Tools")
            print("   Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/")
            return False

    def run_database_migration(self):
        """Run database migrations to create tables"""
        print("🔧 Setting up database tables...")
        
        try:
            env = os.environ.copy()
            env["NODE_ENV"] = "development"
            
            # Use drizzle-kit to push schema to database
            self.run_command("npm run db:push", env=env)
            print("✅ Database tables created successfully")
            return True
            
        except subprocess.CalledProcessError:
            print("⚠️  Database migration may have failed, but continuing...")
            return True  # Continue anyway, app will seed on startup

    def build_application(self):
        """Build the application for production"""
        print("🔨 Building application...")
        
        try:
            env = os.environ.copy()
            env["NODE_ENV"] = "production"
            
            self.run_command("npm run build", env=env)
            print("✅ Application built successfully")
            return True
            
        except subprocess.CalledProcessError:
            print("❌ Build failed")
            return False

    def start_application(self, production=False):
        """Start the application"""
        if production:
            print("🚀 Starting application in production mode...")
            cmd = ["node", "dist/index.js"]
            env_vars = {"NODE_ENV": "production"}
        else:
            print("🚀 Starting application in development mode...")
            # Try npx tsx first, fallback to node with loader
            try:
                subprocess.run(["npx", "--version"], capture_output=True, check=True)
                cmd = ["npx", "tsx", "server/index.ts"]
            except (subprocess.CalledProcessError, FileNotFoundError):
                cmd = ["node", "--loader", "tsx", "server/index.ts"]
            env_vars = {"NODE_ENV": "development"}
        
        # Prepare environment
        env = os.environ.copy()
        env.update(env_vars)
        env["PORT"] = "5000"
        
        print("📊 Starting server...")
        print("🌐 Application will be available at: http://localhost:5000")
        print("⏹️  Press Ctrl+C to stop the server")
        print("-" * 50)
        
        try:
            # Use subprocess.Popen to avoid shell=True issues on Windows
            process = subprocess.Popen(
                cmd,
                env=env,
                cwd=self.project_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            # Stream output in real-time
            for line in process.stdout:
                print(line.rstrip())
                
        except KeyboardInterrupt:
            print("\n⏹️  Shutting down server...")
            process.terminate()
            process.wait()

    def run_installation(self):
        """Run the complete installation process"""
        print("=" * 60)
        print("🚀 Courier Management System - Windows Installer")
        print("=" * 60)
        
        # Check admin privileges for Node.js installation
        if not self.check_node_installed():
            if not self.run_as_admin():
                return False
            
            if not self.install_node_windows():
                return False
                
            # Verify installation
            if not self.check_node_installed():
                print("❌ Node.js installation verification failed")
                print("🔄 Please restart in a new command prompt and run this script again")
                input("Press Enter to exit...")
                return False
        
        print("\n" + "="*50)
        print("📦 INSTALLING DEPENDENCIES")
        print("="*50)
        
        # Install npm dependencies
        if not self.install_npm_dependencies():
            print("❌ Installation failed at dependency installation")
            return False
        
        print("\n" + "="*50)
        print("🗄️  SETTING UP DATABASE")
        print("="*50)
        
        # Setup database
        if not self.setup_database():
            print("❌ Installation failed at database setup")
            return False
        
        # Create environment file
        if not self.create_env_file():
            print("❌ Installation failed at environment configuration")
            return False
        
        # Run database migrations
        if not self.run_database_migration():
            print("⚠️  Database migration had issues, but continuing...")
        
        print("\n" + "="*50)
        print("🔨 BUILDING APPLICATION")
        print("="*50)
        
        # Build application
        if not self.build_application():
            print("⚠️  Build failed, starting in development mode...")
            production = False
        else:
            production = True
        
        print("\n" + "="*50)
        print("✅ INSTALLATION COMPLETE!")
        print("="*50)
        print("🎉 Courier Management System is ready!")
        print(f"📁 Project location: {self.project_dir}")
        print("🗄️  Database: PostgreSQL (localhost)")
        print("🌐 URL: http://localhost:5000")
        print("\nFirst login will automatically create admin user")
        
        # Ask user if they want to start the application
        choice = input("\n🚀 Start the application now? (y/n): ").lower().strip()
        if choice in ['y', 'yes', '']:
            print("\n" + "="*50)
            print("🚀 STARTING APPLICATION")
            print("="*50)
            self.start_application(production=production)
        else:
            print(f"\n📝 To start the application later:")
            print(f"   📁 Open Command Prompt in: {self.project_dir}")
            print(f"   🚀 For development mode:")
            print(f"      npx tsx server/index.ts")
            print(f"   🏭 For production mode (after building):")
            print(f"      node dist/index.js")
            print(f"   📊 Or use these batch files:")
            self.create_batch_files(production)
            
        return True

    def create_batch_files(self, production_ready=False):
        """Create Windows batch files for easy startup"""
        # Development batch file
        dev_batch = self.project_dir / "start_dev.bat"
        dev_content = f"""@echo off
cd /d "{self.project_dir}"
echo Starting Courier Management System in Development Mode...
echo Web interface will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
set NODE_ENV=development
set PORT=5000
npx tsx server/index.ts
pause
"""
        with open(dev_batch, 'w') as f:
            f.write(dev_content)
        
        # Production batch file (only if built)
        if production_ready:
            prod_batch = self.project_dir / "start_prod.bat"
            prod_content = f"""@echo off
cd /d "{self.project_dir}"
echo Starting Courier Management System in Production Mode...
echo Web interface will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
set NODE_ENV=production
set PORT=5000
node dist/index.js
pause
"""
            with open(prod_batch, 'w') as f:
                f.write(prod_content)
        
        print(f"   📄 start_dev.bat - Double-click to start development server")
        if production_ready:
            print(f"   📄 start_prod.bat - Double-click to start production server")

def main():
    try:
        installer = CourierInstaller()
        success = installer.run_installation()
        if not success:
            input("\n❌ Installation failed. Press Enter to exit...")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⏹️  Installation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)

if __name__ == "__main__":
    main()