require('dotenv').config({ path: 'C:/Users/Windows/AppData/Roaming/DataBridgePro/.env' });
const { brokerManager } = require('./dist/services/BrokerManager');
const { pendingLogins } = require('./dist/routes/brokers');
console.log('pendingLogins defined?', pendingLogins !== undefined);
brokerManager.on('auth_required', (id) => console.log('TEST CAUGHT:', id));
brokerManager.emit('auth_required', 'test');
