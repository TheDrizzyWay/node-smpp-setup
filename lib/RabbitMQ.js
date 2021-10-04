
var Connector = require('./Connector');

var RabbitMQ = {
    publish: function( data, queue, callback) {
        Connector.publish( data, queue, callback);
    }
};
module.exports = RabbitMQ;