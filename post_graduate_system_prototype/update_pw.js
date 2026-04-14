const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function updatePasswords() {
  try {
    await mongoose.connect(process.env.DATABASE_CONNECTION_STRING);
    console.log('Connected to DB');

    // The correct hash for 'staff123' using bcryptjs
    const correctHash = '$2b$10$iWZpsYpZ2qiYLZpa.TJ6Je1H1aYuHQ8MfquVsOx4QhJHYS4iFaQFm';

    const result = await mongoose.connection.collection('users').updateMany(
      { role: 'supervisor' },
      { $set: { password: correctHash } }
    );

    console.log('ModifiedCount:', result.modifiedCount);
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

updatePasswords();
