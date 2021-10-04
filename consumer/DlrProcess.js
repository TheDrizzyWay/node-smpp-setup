/* eslint no-underscore-dangle: [2, { "allow": ["_id"] }] */
/* eslint radix: ["error", "as-needed"] */


const dotenv = require('dotenv');

dotenv.config();

const config = require('../conf/config');

var SmsGateway = require('../gateway/sms');

const serviceLocator = require('../conf/di');

const logger = serviceLocator.get('logger');

const rabbitMQClient = serviceLocator.get('rabbitmq');

const dlrProcessQueue = config.rabbit_mq.queues.dlr_pdu;

logger.debug("Starting DLR_PROCESSING_CONSUMER");

rabbitMQClient.then((connection) => {
    connection.createChannel().then((Channel) => {
    Channel.prefetch(1);
    Channel.assertQueue(dlrProcessQueue, { durable: true, noAck: false })
        .then(() => Channel.consume(dlrProcessQueue, (messageObject) => {

        if (messageObject !== null) {

            const incomingMessage = messageObject.content.toString();

            logger.debug(`Message to consume: ${incomingMessage}`);

            const pdu = JSON.parse(incomingMessage);

            SmsGateway.incoming_dlr_process(pdu);

            Channel.ack(messageObject);
        }
        }));
    });
});
