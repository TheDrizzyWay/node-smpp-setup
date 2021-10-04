var redis = require('./redis_wrapper');
var config = require('../conf/config');

redis.init();
       
var status_handler = {
    save_ussd_config : function () {

        const ussd_redis_key = config.configuration.ussd;
        
        // USSD
        // const bindName: 'mtn',
        // bindStatus: 'active',
        // dlrSent: '300433',


        const activated = config.ussd.activate;
        const operator = config.ussd.operator;
        const systemType = config.ussd.system_type;
        const bindHost = config.ussd.host;
        const bindPort = config.ussd.port;
        const bindUser = config.ussd.username;
        const Charaterlenght = config.ussd.character_length;
        const AllowShortCode = config.ussd.shortcode;
        const AlphaTag = config.alpha_tag;

        redis.save_to_set(ussd_redis_key,"activated",activated, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"operator",operator, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"systemType",systemType, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"bindHost",bindHost, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"bindPort",bindPort, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"bindUser",bindUser, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"Charaterlenght",Charaterlenght, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"AllowShortCode",AllowShortCode, function(err, reply){
        })
        redis.save_to_set(ussd_redis_key,"AlphaTag",AlphaTag, function(err, reply){
        })

    },

    save_sms_config : function () {
        
        const sms_redis_key = config.configuration.sms;
        
        // SMS ---------------------------------------------------------
        // const bindName: 'mtn',
        // bindStatus: 'active',
        // dlrSent: '300433',

        const activated = config.sms.activate;
        const operator = config.sms.operator;
        const systemType = config.sms.system_type;
        const bindHost = config.sms.host;
        const bindPort = config.sms.port;
        const bindUser = config.sms.username;
        const Charaterlenght = config.sms.character_length;
        const AllowShortCode = config.sms.shortcode;
        const AlphaTag = config.alpha_tag;

        redis.save_to_set(sms_redis_key,"activated",activated, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"operator",operator, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"systemType",systemType, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"bindHost",bindHost, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"bindPort",bindPort, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"bindUser",bindUser, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"Charaterlenght",Charaterlenght, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"AllowShortCode",AllowShortCode, function(err, reply){
        })
        redis.save_to_set(sms_redis_key,"AlphaTag",AlphaTag, function(err, reply){
        })
    },

    save_general_config : function () {

        const general_redis_key = config.configuration.general;
        let payload = {}
        
        // General
        const smpp_prefix = config.smpp_prefix;
        const debugActivated = config.debug_enabled;
        const rabbitmqHost = config.rabbit_mq.host;
        const rabbitmqPort =  config.rabbit_mq.port;

        redis.save_to_set(general_redis_key,"smpp_prefix",smpp_prefix, function(err, reply){
        })
        redis.save_to_set(general_redis_key,"debugActivated",debugActivated, function(err, reply){
        })
        redis.save_to_set(general_redis_key,"rabbitmqHost",rabbitmqHost, function(err, reply){
        })
        redis.save_to_set(general_redis_key,"rabbitmqPort",rabbitmqPort, function(err, reply){
        })

    },




}
module.exports = status_handler;