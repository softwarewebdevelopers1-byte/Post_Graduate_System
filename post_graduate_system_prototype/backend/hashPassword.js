import bcrypt from "bcrypt"
async function hashPassword() {
    const password = 'student123';
    const saltRounds = 10;

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('Password:', password);
        console.log('Hash:', hash);

        // Verify it works
        const isValid = await bcrypt.compare(password, hash);
        console.log('Verification:', isValid ? '✓ Success' : '✗ Failed');
    } catch (error) {
        console.error('Error:', error);
    }
}

hashPassword();