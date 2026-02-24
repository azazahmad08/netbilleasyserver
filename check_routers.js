const db = require('./src/db');
db.findAllRouters().then(routers => {
    console.log('Routers:', JSON.stringify(routers, null, 2));
    process.exit();
});
