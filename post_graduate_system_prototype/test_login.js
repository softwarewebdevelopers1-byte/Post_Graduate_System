const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend/.env') });

const UserSchema = new mongoose.Schema({
  userNumber: String,
  password: { type: String, default: 'student123' },
  role: String
}, { collection: 'users' });

const UserModel = mongoose.model('User', UserSchema);

async function testLogin(userNumber, password) {
  try {
    await mongoose.connect(process.env.DATABASE_CONNECTION_STRING);
    console.log('Connected to DB');

    const user = await UserModel.findOne({ userNumber });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:', user.userNumber);
    console.log('Stored Hash:', user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

testLogin('staff/ru/001', 'staff123');
