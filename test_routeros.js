const routeros = require('routeros-client');
console.log('Exports:', Object.keys(routeros));
if (routeros.RosClient) {
    console.log('RosClient exists');
}
if (routeros.RouterDotNet) {
    console.log('RouterDotNet exists');
}
