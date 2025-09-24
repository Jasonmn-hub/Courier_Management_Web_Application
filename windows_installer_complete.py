#!/usr/bin/env python3
"""
Complete Windows Automatic Installer for Courier Management System
Installs Node.js, PostgreSQL, creates database, sets environment variables, and starts the application.
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
import winreg
from pathlib import Path

class CourierInstaller:
    def __init__(self):
        self.node_version = "20.11.0"  # LTS version
        self.postgres_version = "16"  # PostgreSQL version
        self.project_dir = Path(__file__).parent.absolute()
        self.db_name = "LMF"
        self.db_user = "postgres"
        self.db_password = "Golightgo"  # Updated password
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
            print("⚠️  Administrator privileges required for installation")
            print("🔄 Requesting administrator privileges...")
            try:
                # Use proper argument quoting for paths with spaces
                args = ' '.join(f'"{arg}"' for arg in sys.argv)
                ctypes.windll.shell32.ShellExecuteW(
                    None, "runas", sys.executable, args, None, 1
                )
                print("🔄 Script will restart with elevated privileges...")
                return False
            except Exception as e:
                print(f"❌ Failed to elevate privileges: {e}")
                print("⚠️ Please run this script as an administrator manually")
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
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"⚠️ winget installation failed or winget not found: {e}")
            print("🔄 Attempting direct download of Node.js...")

            # Fallback to direct download
            node_url = f"https://nodejs.org/dist/v{self.node_version}/node-v{self.node_version}-win-x64.zip"
            temp_dir = tempfile.gettempdir()
            zip_path = os.path.join(temp_dir, "node.zip")
            extract_path = os.path.join(temp_dir, f"node-v{self.node_version}-win-x64")
            
            try:
                print(f"⬇️ Downloading Node.js v{self.node_version}...")
                urllib.request.urlretrieve(node_url, zip_path)
                
                print("📂 Extracting Node.js...")
                shutil.unpack_archive(zip_path, temp_dir)
                
                # Move to a permanent location (e.g., Program Files)
                install_path = os.path.join(os.environ.get("ProgramFiles"), "nodejs")
                if os.path.exists(install_path):
                    shutil.rmtree(install_path)
                shutil.move(extract_path, install_path)
                
                # Add Node.js to PATH
                self.add_to_path(install_path)
                
                print("✅ Node.js installed via direct download")
                return True
            except Exception as e:
                print(f"❌ Failed to install Node.js via direct download: {e}")
                return False
            finally:
                # Clean up
                if os.path.exists(zip_path):
                    os.remove(zip_path)

    def check_postgres_installed(self):
        """Check if PostgreSQL is installed"""
        try:
            result = subprocess.run(
                ["psql", "--version"], 
                capture_output=True, 
                text=True, 
                check=True
            )
            version = result.stdout.strip()
            print(f"✅ PostgreSQL found: {version}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def install_postgres_windows(self):
        """Install PostgreSQL on Windows"""
        print("📦 Installing PostgreSQL...")
        
        # Prompt user for password first
        print("\n📋 PostgreSQL Installation Setup:")
        print("You will be prompted to set a password for the PostgreSQL 'postgres' user.")
        password = input(f"Enter password for PostgreSQL (or press Enter for '{self.db_password}'): ").strip()
        if password:
            self.db_password = password
            print(f"✅ Using password: {self.db_password}")
        else:
            print(f"✅ Using default password: {self.db_password}")
        
        # Try winget first
        try:
            result = subprocess.run(
                ["winget", "install", "-e", "--id", "PostgreSQL.PostgreSQL", "--accept-source-agreements", "--accept-package-agreements"],
                check=True,
                capture_output=True,
                text=True
            )
            print("✅ PostgreSQL installed via winget")
            
            # Detect PostgreSQL installation path dynamically
            postgres_path = self.find_postgres_bin_path()
            if postgres_path:
                self.add_to_path(postgres_path)
                print(f"✅ Added PostgreSQL to PATH: {postgres_path}")
            else:
                print("⚠️ Could not find PostgreSQL installation path")
            
            return True
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"⚠️ winget installation failed: {e}")
            print("📋 Please install PostgreSQL manually:")
            print("  1. Download from https://www.postgresql.org/download/windows/")
            print("  2. Run the installer")
            print(f"  3. Set password to: {self.db_password}")
            print("  4. Re-run this script")
            return False

    def find_postgres_bin_path(self):
        """Find PostgreSQL bin directory dynamically"""
        # Common PostgreSQL installation paths
        base_paths = [
            "C:\\Program Files\\PostgreSQL",
            "C:\\Program Files (x86)\\PostgreSQL"
        ]
        
        for base_path in base_paths:
            if os.path.exists(base_path):
                # Find version directories
                try:
                    versions = [d for d in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, d))]
                    # Sort versions and get the latest
                    versions.sort(reverse=True)
                    for version in versions:
                        bin_path = os.path.join(base_path, version, "bin")
                        if os.path.exists(bin_path) and os.path.exists(os.path.join(bin_path, "psql.exe")):
                            return bin_path
                except (OSError, PermissionError):
                    continue
        
        return None
    
    def add_to_path(self, path):
        """Add path to system PATH"""
        try:
            # Get current PATH
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
                              "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment") as key:
                current_path, _ = winreg.QueryValueEx(key, "PATH")
            
            if path not in current_path:
                new_path = f"{current_path};{path}"
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
                                  "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment", 
                                  0, winreg.KEY_SET_VALUE) as key:
                    winreg.SetValueEx(key, "PATH", 0, winreg.REG_EXPAND_SZ, new_path)
                
                # Also update current session
                os.environ["PATH"] = f"{os.environ['PATH']};{path}"
                print(f"✅ Added {path} to PATH")
        except Exception as e:
            print(f"⚠️ Failed to add to PATH: {e}")

    def setup_database(self):
        """Create database and user"""
        print("📊 Setting up PostgreSQL database...")
        
        try:
            # Wait for PostgreSQL service to start
            print("⏳ Waiting for PostgreSQL service...")
            time.sleep(10)
            
            # Create database
            print(f"🗄️ Creating database '{self.db_name}'...")
            create_db_cmd = f'createdb -U postgres -h {self.db_host} -p {self.db_port} {self.db_name}'
            
            env = os.environ.copy()
            env['PGPASSWORD'] = self.db_password
            
            result = self.run_command(create_db_cmd, check=False, env=env)
            if result.returncode == 0:
                print(f"✅ Database '{self.db_name}' created successfully")
            else:
                print(f"⚠️ Database might already exist: {result.stderr}")
            
            return True
        except Exception as e:
            print(f"❌ Failed to setup database: {e}")
            return False

    def set_environment_variables(self):
        """Set up environment variables"""
        print("🔧 Setting up environment variables...")
        
        # Create DATABASE_URL
        database_url = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
        
        # Create .env file for local development
        env_file_path = self.project_dir / ".env"
        env_content = f"""# Local Development Environment Variables
DATABASE_URL={database_url}
NODE_ENV=development
PGHOST={self.db_host}
PGPORT={self.db_port}
PGUSER={self.db_user}
PGPASSWORD={self.db_password}
PGDATABASE={self.db_name}
"""
        
        try:
            with open(env_file_path, 'w') as f:
                f.write(env_content)
            print(f"✅ Created .env file at {env_file_path}")
            
            # Also set for current session
            os.environ['DATABASE_URL'] = database_url
            os.environ['NODE_ENV'] = 'development'
            
            return True
        except Exception as e:
            print(f"❌ Failed to create .env file: {e}")
            return False

    def install_dependencies(self):
        """Install npm dependencies"""
        print("📦 Installing npm dependencies...")
        try:
            self.run_command("npm install", cwd=self.project_dir)
            print("✅ npm dependencies installed")
            return True
        except Exception as e:
            print(f"❌ Failed to install dependencies: {e}")
            return False

    def setup_database_schema(self):
        """Push database schema using Drizzle"""
        print("🗄️ Setting up database schema...")
        try:
            # Load environment variables from .env file
            env = os.environ.copy()
            database_url = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
            env['DATABASE_URL'] = database_url
            
            self.run_command("npm run db:push", env=env, cwd=self.project_dir)
            print("✅ Database schema created")
            return True
        except Exception as e:
            print(f"❌ Failed to setup database schema: {e}")
            return False

    def start_application(self):
        """Start the application"""
        print("🚀 Starting the application...")
        try:
            # Set environment variables for the session
            env = os.environ.copy()
            database_url = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
            env['DATABASE_URL'] = database_url
            env['NODE_ENV'] = 'development'
            
            print("✅ Application is starting...")
            print("🌐 Open your browser to http://localhost:5000")
            print("📝 Use Ctrl+C to stop the application")
            
            # Start the application (this will run continuously)
            self.run_command("npm run dev", env=env, cwd=self.project_dir)
            
        except KeyboardInterrupt:
            print("\n🛑 Application stopped by user")
        except Exception as e:
            print(f"❌ Failed to start application: {e}")

    def run_installation(self):
        """Run the complete installation process"""
        print("🚀 Starting Courier Management System Installation...")
        print("=" * 60)
        
        # Check and install Node.js
        if not self.check_node_installed():
            if not self.install_node_windows():
                print("❌ Node.js installation failed. Exiting...")
                return False
        
        # Check and install PostgreSQL
        if not self.check_postgres_installed():
            if not self.install_postgres_windows():
                print("❌ PostgreSQL installation failed. Exiting...")
                return False
        
        # Setup database
        if not self.setup_database():
            print("❌ Database setup failed. Exiting...")
            return False
        
        # Set environment variables
        if not self.set_environment_variables():
            print("❌ Environment setup failed. Exiting...")
            return False
        
        # Install dependencies
        if not self.install_dependencies():
            print("❌ Dependency installation failed. Exiting...")
            return False
        
        # Setup database schema
        if not self.setup_database_schema():
            print("❌ Database schema setup failed. Exiting...")
            return False
        
        print("=" * 60)
        print("✅ Installation completed successfully!")
        print("=" * 60)
        
        # Ask user if they want to start the application
        try:
            start_now = input("\n🤔 Do you want to start the application now? (y/n): ").lower().strip()
            if start_now in ['y', 'yes']:
                self.start_application()
        except KeyboardInterrupt:
            print("\n👋 Installation complete. You can start the application later with: npm run dev")
        
        return True

if __name__ == "__main__":
    installer = CourierInstaller()
    
    if not installer.run_as_admin():
        sys.exit(1)
    
    if installer.run_installation():
        print("\n✅ Setup completed successfully!")
        print("📋 To start the application in the future, run: npm run dev")
    else:
        print("\n❌ Installation failed. Please check the errors above.")
        sys.exit(1)