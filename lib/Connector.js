

const config = require('../conf/config');

const serviceFinder = require('../conf/di');
const logger = serviceFinder.get('logger');
var Connector = {

    rabbit: null,
    rabbit_start: null,

    publish: function( data, queue, callback ) {
        if (
            !Connector.rabbit ||
            (
                Connector.rabbit &&
                Connector.rabbit == null &&
                Connector.rabbit_start == null
            )
        ) {
            if(config.ussd.debug == 'true'){
                logger.debug('Starting connection to Rabbit mq');
            }
            Connector.rabbit_start = true;
            var rabbit = require('amqplib/callback_api');

            var rabbit_user = config.rabbit_mq.user;
            var rabbit_pass = config.rabbit_mq.pass;
            var rabbit_host = config.rabbit_mq.host;
            var rabbit_port = config.rabbit_mq.port;
            
            rabbit.connect('amqp://' + rabbit_user + ':' + rabbit_pass + '@' + rabbit_host + ':' + rabbit_port,
                function(err, conn) {
                    if (err) {
                        if(config.ussd.debug == 'true'){
                            console.error("[AMQP] push error:", err.message);
                        }
                        try {
                            if (Connector.rabbit != null) {
                                Connector.rabbit.close();
                            }
                        } catch (e) {
                            if(config.ussd.debug == 'true'){
                                console.error("ERROR CLOSING CONNECTION", e);
                            }
                        }
                        Connector.rabbit = null;
                        Connector.rabbit_start = null;
                        return;
                    }
                    conn.on("error", function(err) {
                        if (err.message !== "Connection closing") {
                            try {
                                if (Connector.rabbit != null) {
                                    Connector.rabbit.close();
                                }
                            } catch (e) {
                                if(config.ussd.debug == 'true'){
                                    console.error("ERROR CLOSING CONNECTION", e);
                                }
                            }
                            Connector.rabbit = null;
                            Connector.rabbit_start = null;
                            if(config.ussd.debug == 'true'){
                                console.error("[AMQP] conn error:", err.message);
                            }
                        }
                    });
                    conn.on("close", function() {
                        if(config.ussd.debug == 'true'){
                            console.error("[AMQP] reconnecting");
                        }
                        Connector.rabbit = null;
                        Connector.rabbit_start = null;
                        return;
                    });
                    Connector.rabbit = conn;
                    Connector.rmq_publish(queue, data, callback);
                    if(config.ussd.debug == 'true'){
                        logger.debug("[AMQP] connected to rabbit mq");
                    }
                });
        } else {
            if (Connector.rabbit != null) {
                Connector.rmq_publish(queue, data, callback);
            } else {
                if(config.ussd.debug == 'true'){
                    logger.debug("started ", Connector.rabbit_start);
                }
            }
        }
        return Connector.rabbit;
    },

    rmq_closeOnErr: function(err) {
        if (!err) return false;
        if(config.ussd.debug == 'true'){
            console.error("[AMQP] error", err);
        }
        try {
            Connector.rabbit.close();
        } catch (e) {
            if(config.ussd.debug == 'true'){
                console.error("ERROR CLOSING CONNECTION", e);
            }
        }
        Connector.rabbit = null;
        Connector.rabbit_start = null;
        return true;
    },

    rmq_publish: function(queue, data, callback) {
        Connector.rabbit.createChannel(function(err, channel) {
            if (Connector.rmq_closeOnErr(err)) {
                return;
            }
            channel.on("error", function(err) {
                if(config.ussd.debug == 'true'){
                    console.error("[AMQP] channel error", err.message);
                } 
            });
            channel.on("close", function() {
                if(config.ussd.debug == 'true'){
                    logger.debug("[AMQP] channel closed");
                }
            });
            // channel.prefetch(10);
            channel.assertQueue(queue, { durable: true, noAck: false }, function(err, _ok) {
                if (Connector.rmq_closeOnErr(err)) return;
                // return callback(response);
                // logger.debug('data', data);
                var response = channel.sendToQueue(queue, new Buffer(JSON.stringify(data)));

                channel.close(function(err) { });
            });
        })
    }
}
module.exports = Connector;