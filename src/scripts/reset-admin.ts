import bcrypt from 'bcrypt';
import pool from '../config/database.js';

async function resetAdminAccount() {
  try {
    console.log('🔄 Resetting admin account...\n');

    // Admin credentials
    const adminEmail = 'admin@clinicamind.com';
    const adminPassword = 'Admin@123';
    const adminName = 'System Administrator';
    const adminPhone = '+237600000000';
    const adminReferralCode = 'ADMIN001';

    // Hash the password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Check if admin exists
    const checkResult = await pool.query(
      'SELECT id, email FROM ambassadors WHERE email = $1',
      [adminEmail]
    );

    if (checkResult.rows.length > 0) {
      // Update existing admin
      await pool.query(
        `UPDATE ambassadors 
         SET password_hash = $1, 
             name = $2, 
             phone = $3,
             referral_code = $4,
             status = 'active',
             updated_at = NOW()
         WHERE email = $5`,
        [passwordHash, adminName, adminPhone, adminReferralCode, adminEmail]
      );
      console.log('✅ Admin account updated successfully!');
    } else {
      // Create new admin
      await pool.query(
        `INSERT INTO ambassadors (
          name, email, phone, password_hash, referral_code, status
        ) VALUES ($1, $2, $3, $4, $5, 'active')`,
        [adminName, adminEmail, adminPhone, passwordHash, adminReferralCode]
      );
      console.log('✅ Admin account created successfully!');
    }

    console.log('\n📋 Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🌐 Login at: http://localhost:3000/login\n');

  } catch (error) {
    console.error('❌ Error resetting admin account:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
resetAdminAccount()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
