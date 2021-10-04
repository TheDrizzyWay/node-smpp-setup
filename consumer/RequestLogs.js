require('dotenv').config();

const amqp = require('amqplib/callback_api');

const config = require('../conf/config');

const serviceFinder = require('../conf/di');

const es = serviceFinder.get('elasticSearch');

const logger = serviceFinder.get('logger');

const es_data=config.database.elasticSearch.documents.smppLogs;
function processFeedback() {
    const rabbit = `amqp://${config.rabbit_mq.user}:${config.rabbit_mq.pass}@${config.rabbit_mq.host}:${config.rabbit_mq.port}`;
    amqp.connect(rabbit, (connectErr, conn) => {
        conn.createChannel((channelErr, ch) => {
            const ussdRequestQueue = config.rabbit_mq.queues.request_log;
            logger.debug(' [*] Waiting for messages in ' +ussdRequestQueue+ '. To exit press CTRL+C');
            ch.prefetch(1); // how many objects at a time
            ch.assertQueue(ussdRequestQueue, { durable: true, noAck: false }, () => {
                ch.consume(ussdRequestQueue, (msg) => {
                    if (msg !== null) {
                        
                        console.log(config.logging.type)
                        try {
                            const message = msg.content.toString();

            
                            if (config.logging.type == 'file'){
                                logger.info(message);
                                ch.ack(msg);
                            } else {
                                logToES(message);
                                ch.ack(msg);
                            }


                        } catch (e) {
                           ch.ack(msg);
                            logger.error('Acked : unknown input', new Date());
                            logger.error(e);
                        } // end of catch
                    } 
                });
            });
        });
    });
}

function logToES(message){
    if (config.debug_enabled == 'true'){
        console.log("Saving to Logs to Elasticsearch");
        console.log(message);
    }
    const messageJson = JSON.parse(message);
  
    return es.then(client=>{
        client.index({
            index: es_data['index'],
            type:  es_data['type'],
            body: messageJson
        }).then(function(value) {
            logger.debug("Saved");
            logger.debug(`Acked : ${message}`, new Date());
        }).catch((err)=>{
            if(err.status === 404){
                logger.error("Unable to save to db");
            }
        });
    }).catch(error => {
        logger.error(error); 
    });
}
processFeedback();