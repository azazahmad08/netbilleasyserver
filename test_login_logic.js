const fs = require('fs');
const path = require('path');

const DB_FILE = 'c:\\Users\\User\\Desktop\\ispbilling\\server\\src\\db.json';
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

const username = '01316124535';
const password = 'azaz0011';

const user = db.users.find(u => {
    const usernameMatch = (
        (u.username && u.username === username) ||
        (u.phone && u.phone === username) ||
        (u.mobile && u.mobile === username) ||
        (u.name && u.name === username)
    );
    const passwordMatch = (u.password && u.password === password);
    return usernameMatch && passwordMatch;
});

console.log('User found:', user ? user.name : 'NotFound');
if (user) {
    console.log('Role:', user.role);
    console.log('Status:', user.status);
}
