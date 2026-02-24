const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const RosClient = require('routeros-client').RosClient;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes Placeholder
app.get('/', (req, res) => {
    res.send('NetFee ISP Billing API is running stable.');
});

// Routes
const clientRoutes = require('./routes/clientRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const areaRoutes = require('./routes/areaRoutes');
const mikrotikRoutes = require('./routes/mikrotikRoutes');
const userRoutes = require('./routes/userRoutes');
const smsRoutes = require('./routes/smsRoutes');

app.use('/api/clients', clientRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/mikrotik', mikrotikRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sms', smsRoutes);

// Database Connection (Optional fallback to JSON DB)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/isp_billing';

if (process.env.USE_MONGODB === 'true') {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('MongoDB connected successfully'))
        .catch(err => {
            console.error('MongoDB connection error. Using local JSON DB instead.');
        });
} else {
    console.log('Running in light-mode with local JSON database.');
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
