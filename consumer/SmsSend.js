/* eslint no-underscore-dangle: [2, { "allow": ["_id"] }] */
/* eslint radix: ["error", "as-needed"] */


const dotenv = require('dotenv');

dotenv.config();

const config = require('../conf/config');

const serviceLocator = require('../conf/di');

const logger = serviceLocator.get('logger');

var SmsGateway = require('../gateway/sms');

const rabbitMQClient = serviceLocator.get('rabbitmq');

const sendSmsQueue = config.rabbit_mq.queues.send_sms;

logger.debug("Starting SEND_SMS_CONSUMER");


  rabbitMQClient.then((connection) => {
    connection.createChannel().then((Channel) => {
      Channel.prefetch(1);
      Channel.assertQueue(sendSmsQueue, { durable: true, noAck: false })
        .then(() => Channel.consume(sendSmsQueue, (messageObject) => {
          if (messageObject !== null) {
            const incomingMessage = messageObject.content.toString();
            logger.debug(`Message to consume: ${incomingMessage}`);
            const myQueueMessage = JSON.parse(incomingMessage);
  
            logger.debug(myQueueMessage);
  
            const options = myQueueMessage;
  
            // consumer import 
            msisdn = options.msisdn;
            operator = options.operator;
            short_code = options.short_code;
            message = options.message;
            dlr_mask = options.dlr_mask;
            dlr_url = options.dlr_url;
  
            request_dlr = (dlr_mask == '' || dlr_url == '') ? false : true;
            // ----------------------------------------------------------------------------------------------


            const feedback = SmsGateway.mt_request_async({
                "msisdn":msisdn,
                "message":message,
                "operator":operator,
                "short_code":short_code,
                "dlr_mask":dlr_mask,
                "dlr_url":dlr_url,
            });

          
            // -------------------------------------------------------------------------------------------------------
            Channel.ack(messageObject);
          }
          return null;
        }));
    });
  
  });
