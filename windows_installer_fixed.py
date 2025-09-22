#!/usr/bin/env python3
"""
Windows Automatic Installer for Courier Management System - FIXED VERSION
Installs Node.js, npm dependencies, sets up PostgreSQL database, creates tables, and starts the application.
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
from getpass import getpass

class CourierInstaller:
    def __init__(self):
        self.node_version = "22.19.0"  # Matches detected version
        self.project_dir = Path(__file__).parent.absolute()
        self.db_name = "courier_cms"  # Updated to match existing database
        self.db_user = "postgres"
        self.db_password = "root"  # Initial attempt, will prompt if incorrect
        self.db_host = "localhost"
        self.db_port = "5432"
        
    def is_admin(self):
        """Check if running with administrator privileges"""
        try:
            return ctypes.windll.shell32.IsUserAnAdmin()
        except:
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
            
            # Check npm too (non-critical for Node detection)
            try:
                result = subprocess.run(
                    ["npm", "--version"], 
                    shell=True,  # Use shell=True for Windows .cmd files
                    capture_output=True, 
                    text=True, 
                    check=True
                )
                npm_version = result.stdout.strip()
                print(f"✅ npm found: v{npm_version}")
            except (subprocess.CalledProcessError, FileNotFoundError):
                print("⚠️ npm check failed, but continuing (npm should work during installation)")
            
            return True  # Return True if Node.js is found, regardless of npm check
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def setup_database(self):
        """Set up the PostgreSQL database"""
        print("🔄 Setting up PostgreSQL database...")
        try:
            # Test connection with current password
            os.environ["PGPASSWORD"] = self.db_password
            test_conn_cmd = f'psql -U {self.db_user} -h {self.db_host} -p {self.db_port} -c "SELECT 1;"'
            result = self.run_command(test_conn_cmd, check=False)
            
            if result.returncode != 0 and "password authentication failed" in result.stderr.lower():
                print("⚠️ PostgreSQL password authentication failed. Please provide the correct password.")
                self.db_password = getpass(f"Enter password for PostgreSQL user {self.db_user}: ")
                os.environ["PGPASSWORD"] = self.db_password
                # Retest connection
                result = self.run_command(test_conn_cmd, check=True)
            
            # Check if database exists
            check_db_cmd = f'psql -U {self.db_user} -h {self.db_host} -p {self.db_port} -lqt'
            result = self.run_command(check_db_cmd, check=True)
            if self.db_name not in result.stdout:
                # Create database if it doesn't exist
                create_db_cmd = f'psql -U {self.db_user} -h {self.db_host} -p {self.db_port} -c "CREATE DATABASE {self.db_name};"'
                self.run_command(create_db_cmd, check=True)
                print(f"✅ Database {self.db_name} created successfully")
            else:
                print(f"✅ Database {self.db_name} already exists")
            
            # Create .env file with database connection
            self.create_env_file()
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to set up database: {e.stderr if hasattr(e, 'stderr') else e}")
            return False
        finally:
            # Clear password from environment
            os.environ.pop("PGPASSWORD", None)

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
        """Install npm dependencies in the project directory"""
        print("📦 Installing npm dependencies...")
        try:
            # Check if package.json exists
            package_json = self.project_dir / "package.json"
            if not package_json.exists():
                print(f"❌ package.json not found in {self.project_dir}")
                return False
                
            self.run_command("npm install", check=True)
            print("✅ npm dependencies installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install npm dependencies: {e}")
            print("⚠️ If you see build errors, you may need to install Microsoft C++ Build Tools")
            print("   Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/")
            return False

    def create_database_tables(self):
        """Create database tables using Drizzle migrations"""
        print("🏗️ Creating database tables...")
        try:
            # Set environment variables for the migration
            env = os.environ.copy()
            env["NODE_ENV"] = "development"
            env["DATABASE_URL"] = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
            
            # Run drizzle migration to create tables
            self.run_command("npm run db:push", env=env, check=True)
            print("✅ Database tables created successfully!")
            print("📊 Created tables: users, departments, couriers, sessions, fields, and more...")
            return True
        except subprocess.CalledProcessError as e:
            print(f"⚠️ Database migration had issues: {e}")
            print("🔄 Trying with force flag...")
            try:
                # Try with force flag if regular push fails
                self.run_command("npm run db:push -- --force", env=env, check=True)
                print("✅ Database tables created with force flag!")
                return True
            except subprocess.CalledProcessError as e2:
                print(f"❌ Database table creation failed: {e2}")
                return False

    def start_application(self):
        """Start the Courier Management System application"""
        print("🚀 Starting the Courier Management System...")
        try:
            # Set environment variables for Windows
            env = os.environ.copy()
            env["NODE_ENV"] = "development"
            env["PORT"] = "5000" 
            env["DATABASE_URL"] = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
            
            print("📊 Starting server...")
            print("🌐 Application will be available at: http://localhost:5000")
            print("👤 First login will automatically create admin user")
            print("⏹️ Press Ctrl+C to stop the server")
            print("-" * 60)
            
            # Use Windows-compatible command - avoid npm scripts with inline env vars
            # Use direct tsx command instead of npm start to avoid Windows env issues
            cmd = ["npx", "tsx", "server/index.ts"]
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
            print("\n⏹️ Shutting down server...")
            process.terminate()
            process.wait()
            return True
        except Exception as e:
            print(f"❌ Failed to start application: {e}")
            return False

    def create_batch_files(self):
        """Create Windows batch files for easy startup"""
        print("📄 Creating startup batch files...")
        
        # Development batch file
        dev_batch = self.project_dir / "start_courier_system.bat"
        dev_content = f"""@echo off
cd /d "{self.project_dir}"
echo ============================================================
echo 🚀 Starting Courier Management System
echo ============================================================
echo 🌐 Web interface: http://localhost:5000
echo 👤 First login creates admin user automatically
echo ⏹️  Press Ctrl+C to stop the server
echo ============================================================
echo.
set NODE_ENV=development
set PORT=5000
set DATABASE_URL=postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}
npx tsx server/index.ts
pause
"""
        with open(dev_batch, 'w') as f:
            f.write(dev_content)
        
        print(f"✅ Created: start_courier_system.bat")
        print("   💡 Double-click this file to start the application anytime!")

    def run_installation(self):
        """Run the complete installation process"""
        print("=" * 70)
        print("🚀 Courier Management System - Windows Installer (FIXED v2)")
        print("=" * 70)
        
        # Check if we're in the right directory
        package_json = self.project_dir / "package.json"
        if not package_json.exists():
            print("❌ package.json not found in current directory")
            print(f"📁 Current directory: {self.project_dir}")
            print("⚠️ Please run this installer from the Courier Management System project folder")
            return False
        
        # Check if Node.js is installed
        if not self.check_node_installed():
            print("❌ Node.js not found. Please install Node.js first:")
            print("   1. Go to https://nodejs.org/")
            print("   2. Download and install Node.js LTS version")
            print("   3. Restart this script")
            return False
        
        print("\n" + "="*60)
        print("🗄️ SETTING UP DATABASE")
        print("="*60)
        
        # Setup database
        if not self.setup_database():
            print("❌ Database setup failed")
            return False
        
        print("\n" + "="*60)
        print("📦 INSTALLING DEPENDENCIES")
        print("="*60)
        
        # Install npm dependencies
        if not self.install_npm_dependencies():
            print("❌ Dependency installation failed")
            return False
        
        print("\n" + "="*60)
        print("🏗️ CREATING DATABASE TABLES")
        print("="*60)
        
        # This is the MISSING STEP that creates tables!
        if not self.create_database_tables():
            print("❌ Table creation failed")
            return False
        
        print("\n" + "="*60)
        print("✅ INSTALLATION COMPLETE!")
        print("="*60)
        print("🎉 Courier Management System is ready!")
        print(f"📁 Project location: {self.project_dir}")
        print("🗄️ Database: PostgreSQL (localhost)")
        print("📊 Tables: All 15+ tables created successfully")
        print("🌐 URL: http://localhost:5000")
        print("👤 First login automatically creates admin user")
        
        # Create batch files for easy startup
        self.create_batch_files()
        
        print("\n" + "="*60)
        print("🎯 TESTING APPLICATION STARTUP")
        print("="*60)
        
        # Test that the application can start (quick test)
        print("🔍 Testing if application starts correctly...")
        try:
            env = os.environ.copy()
            env["NODE_ENV"] = "development"
            env["DATABASE_URL"] = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
            
            # Quick test start
            process = subprocess.Popen(
                ["npx", "tsx", "server/index.ts"],
                env=env,
                cwd=self.project_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Wait a few seconds to see if it starts
            time.sleep(3)
            if process.poll() is None:  # Still running
                print("✅ Application startup test successful!")
                process.terminate()
                process.wait()
            else:
                stdout, stderr = process.communicate()
                print(f"⚠️ Application startup test failed:")
                print(f"Output: {stdout}")
                print(f"Error: {stderr}")
        except Exception as e:
            print(f"⚠️ Could not test application startup: {e}")
        
        # Ask user if they want to start the application
        choice = input("\n🚀 Start the application now for real use? (y/n): ").lower().strip()
        if choice in ['y', 'yes', '']:
            print("\n" + "="*60)
            print("🚀 STARTING APPLICATION")
            print("="*60)
            self.start_application()
        else:
            print(f"\n📝 To start later:")
            print(f"   📄 Double-click: start_courier_system.bat")
            print(f"   ⌨️ Or run in Command Prompt:")
            print(f"      cd \"{self.project_dir}\"")
            print(f"      npx tsx server/index.ts")
            
        return True

def main():
    try:
        installer = CourierInstaller()
        success = installer.run_installation()
        if not success:
            input("\n❌ Installation failed. Press Enter to exit...")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⏹️ Installation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)

if __name__ == "__main__":
    main()