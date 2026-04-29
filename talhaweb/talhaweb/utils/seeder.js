/**
 * OMNI DATABASE SEEDER (Supabase)
 * Run once: node utils/seeder.js
 * Seeds: default categories, admin user, store settings
 */
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ADMIN_EMAIL    = 'admin@omnistore.pk';
const ADMIN_PASSWORD = 'OmniAdmin@2025';  // CHANGE THIS after first login!
const ADMIN_PHONE    = '03037971616';

const DEFAULT_CATEGORIES = [
  { name: 'Electronics', icon: '⚡', slug: 'electronics' },
  { name: 'Fashion',     icon: '👗', slug: 'fashion' },
  { name: 'Home',        icon: '🏡', slug: 'home' },
  { name: 'Beauty',      icon: '💄', slug: 'beauty' },
  { name: 'Sports',      icon: '🏃', slug: 'sports' },
  { name: 'Books',       icon: '📚', slug: 'books' },
];

const seedDatabase = async () => {
  try {
    console.log('✅ Connected to Supabase');

    // ── CATEGORIES ────────────────────────────────────────────
    console.log('\n📦 Seeding categories...');
    for (const cat of DEFAULT_CATEGORIES) {
      const { data: exists } = await supabase.from('categories').select('id').eq('name', cat.name).maybeSingle();
      if (!exists) {
        const { error } = await supabase.from('categories').insert(cat);
        if (error) {
          console.log(`   ⚠️  Error creating ${cat.name}: ${error.message}`);
        } else {
          console.log(`   ✅ Created: ${cat.icon} ${cat.name}`);
        }
      } else {
        console.log(`   ⏭️  Exists: ${cat.name}`);
      }
    }

    // ── ADMIN USER ────────────────────────────────────────────
    console.log('\n👤 Seeding admin user...');
    const { data: existingAdmin } = await supabase.from('users').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      const { error } = await supabase.from('users').insert({
        first_name: 'Omni',
        last_name: 'Admin',
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        password_hash: passwordHash,
        role: 'admin',
        is_verified: true,
      });
      if (error) {
        console.log(`   ⚠️  Error creating admin: ${error.message}`);
      } else {
        console.log(`   ✅ Admin created: ${ADMIN_EMAIL}`);
        console.log(`   🔑 Password: ${ADMIN_PASSWORD}  ← CHANGE THIS!`);
      }
    } else {
      console.log(`   ⏭️  Admin already exists: ${ADMIN_EMAIL}`);
    }

    // ── SETTINGS ──────────────────────────────────────────────
    console.log('\n⚙️  Seeding store settings...');
    const { data: existingSettings } = await supabase.from('settings').select('id').limit(1).maybeSingle();
    if (!existingSettings) {
      const { error } = await supabase.from('settings').insert({
        store_name: 'Omni Store',
        store_email: 'hello@omnistore.pk',
        whatsapp_number: '923037971616',
        jazzcash_number: '03037971616',
        easypaisa_number: '03152139898',
        delivery_charge: 250,
        free_shipping_above: 2000,
        delivery_days: '2-5 working days',
      });
      if (error) {
        console.log(`   ⚠️  Error creating settings: ${error.message}`);
      } else {
        console.log('   ✅ Default settings created');
      }
    } else {
      console.log('   ⏭️  Settings already exist');
    }

    console.log('\n🎉 Seeding complete!\n');
    console.log('═══════════════════════════════════════');
    console.log('  Admin Login Credentials:');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('  ⚠️  Change password after first login!');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeder error:', error.message);
    process.exit(1);
  }
};

seedDatabase();
