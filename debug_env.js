// Debug Environment Variables
console.log('='.repeat(50));
console.log('🔍 DEBUG: Environment Variables');
console.log('='.repeat(50));

// Check if .env file exists
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
console.log('📁 Current directory:', process.cwd());
console.log('📄 .env file path:', envPath);

if (fs.existsSync(envPath)) {
    console.log('✅ .env file exists');
    
    // Read and display .env content (without sensitive data)
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('📝 .env file content:');
    const lines = envContent.split('\n');
    lines.forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
            const [key, value] = line.split('=');
            if (key === 'DATABASE_URL') {
                // Mask password in DATABASE_URL for security
                const maskedValue = value ? value.replace(/:([^:@]+)@/, ':***@') : 'NOT_SET';
                console.log(`   ${key}=${maskedValue}`);
            } else {
                console.log(`   ${key}=${value || 'NOT_SET'}`);
            }
        }
    });
} else {
    console.log('❌ .env file does NOT exist');
    console.log('💡 You need to create a .env file with DATABASE_URL');
}

console.log('\n🔧 Environment Variables (from process.env):');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('PGHOST:', process.env.PGHOST || 'NOT SET');
console.log('PGPORT:', process.env.PGPORT || 'NOT SET');
console.log('PGUSER:', process.env.PGUSER || 'NOT SET');
console.log('PGDATABASE:', process.env.PGDATABASE || 'NOT SET');

console.log('\n💡 Next steps:');
if (!fs.existsSync(envPath)) {
    console.log('1. Create .env file with your database credentials');
    console.log('2. Run your Python installer again to create .env file');
} else if (!process.env.DATABASE_URL) {
    console.log('1. Install and configure dotenv: npm install dotenv');
    console.log('2. Load .env file in your application');
} else {
    console.log('✅ Environment setup looks good!');
}
console.log('='.repeat(50));