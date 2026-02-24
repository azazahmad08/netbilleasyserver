const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Client = require('./models/Client');
const Ticket = require('./models/Ticket');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/isp_billing';

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing data
        await Client.deleteMany({});
        await Ticket.deleteMany({});

        // Create Clients
        const clients = await Client.insertMany([
            { name: 'Rahat Khan', phone: '01712000001', username: 'rahat.net', zone: 'Sector 4', status: 'Active', package: '10 Mbps', price: 1000 },
            { name: 'Anisur Rahman', phone: '01823000002', username: 'anis.45', zone: 'Sector 7', status: 'Active', package: '20 Mbps', price: 1500 },
            { name: 'Sabbir Ahmed', phone: '01911000003', username: 'sabbir_isp', zone: 'Uttara', status: 'Inactive', package: '5 Mbps', price: 500 },
        ]);

        console.log('Clients seeded!');

        // Create Tickets
        await Ticket.insertMany([
            { clientId: clients[0]._id, subject: 'Internet slow', description: 'Getting only 2Mbps on 10Mbps package', status: 'Open', priority: 'High', category: 'Speed' },
            { clientId: clients[1]._id, subject: 'Bill payment query', description: 'When is the last date for payment?', status: 'Resolved', priority: 'Low', category: 'Billing' },
        ]);

        console.log('Tickets seeded!');
        process.exit();
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedData();
