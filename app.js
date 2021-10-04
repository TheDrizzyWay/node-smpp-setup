require('dotenv').config();

var UssdGateway = require('./gateway/ussd');

var SmsGateway = require('./gateway/sms');

var _config = require('./conf/config');

var express = require('express');


const redis = require('./lib/redis_wrapper');
redis.init();

const Oracle = require('./lib/oracle');
Oracle.init();

const moment = require('moment');


var app = express();

const rp = require('request-promise');

const serviceFinder = require('./conf/di');

const logger = serviceFinder.get('logger');

const status_handler = require('./lib/status_handler');

const EncryptedMSISDN = require('./lib/encrypted_msisdn');

if (!_config.smpp_prefix){
    logger.debug("_______________________ SMPP_PREFIX env var NOT SET ________________________");
    process.exit();
}


if (_config.debug_enabled == 'true'){
    logger.debug("_______________________ DEBUG ENABLED ________________________");
}


// Initializing Status Page Content
status_handler.save_general_config();
status_handler.save_ussd_config();
status_handler.save_sms_config();
// End of initialization

var bodyParser = require('body-parser');
 app.use(bodyParser.json()); // support json encoded bodies
 app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
 app.set('view engine', 'ejs');
 app.use(express.static('public'))

 app.get('/status', async (req, res) => {

    const categories = [
        {name: 'general', key: _config.configuration.general},
        {name: 'ussd', key: _config.configuration.ussd},
        {name: 'sms', key: _config.configuration.sms}
    ]

    for (category of categories){
        category.data = await redis.get_data_async(category.key);
    }

    res.render('status.ejs', {
        data: categories,
        moment
    });
});

 if (_config.ussd.activate == 'true'){

    logger.debug('---------------------');
    logger.debug('Initiating USSD');
    logger.debug('---------------------');

    let init_param = {
        host: _config.ussd.host,
        port: _config.ussd.port,
        username: _config.ussd.username,
        password: _config.ussd.password,
        allowed_shortcode: _config.ussd.shortcode,
        gateway: _config.ussd.gateway,
        operator: _config.ussd.operator,
        interval: _config.ussd.interval,
        character_length: _config.ussd.character_length,
        keep_alive_minute: _config.ussd.keep_alive_minute,
        debug:(_config.debug_enabled == 'true') ? true : false,
    }

    if (_config.ussd.source_addr_ton != '' && _config.ussd.source_addr_ton != null){
        init_param['source_addr_ton'] = parseInt(_config.ussd.source_addr_ton);
    }

    if (_config.ussd.source_addr_npi != '' && _config.ussd.source_addr_npi != null){
        init_param['source_addr_npi'] = parseInt(_config.ussd.source_addr_npi);
    }

    if (_config.ussd.dest_addr_ton != '' && _config.ussd.dest_addr_ton != null){
        init_param['dest_addr_ton'] = parseInt(_config.ussd.dest_addr_ton);
    }

    if (_config.ussd.dest_addr_npi != '' && _config.ussd.dest_addr_npi != null){
        init_param['dest_addr_npi'] = parseInt(_config.ussd.dest_addr_npi);
    }

    if (_config.ussd.system_type != '' && _config.ussd.system_type != null){
        init_param['system_type'] = _config.ussd.system_type;
    }

    if (_config.ussd.interface_version != '' && _config.ussd.interface_version != null){
        init_param['interface_version'] = _config.ussd.interface_version;
    }

    if (_config.ussd.bind_type != '' && _config.ussd.bind_type != null){
        init_param['bind_type'] = _config.ussd.bind_type;
    }

    if (_config.sms.service_type != '' && _config.sms.service_type != null){
        init_param['service_type'] = _config.sms.service_type;
    }

    UssdGateway.init(init_param);
}

if (_config.sms.activate == 'true'){

    logger.debug('---------------------');
    logger.debug('Initiating SMS');
    logger.debug('---------------------');

    let init_param = {
        host: _config.sms.host,
        port: _config.sms.port,
        username: _config.sms.username,
        password: _config.sms.password,
        allowed_shortcode: _config.sms.shortcode,
        gateway: _config.sms.gateway,
        operator: _config.sms.operator,
        interval: _config.sms.interval,
        interval: _config.sms.interval,
        keep_alive_minute: _config.sms.keep_alive_minute,
        debug:(_config.debug_enabled == 'true') ? true : false,
        alpha_tag: (_config.alpha_tag == 'true') ? true : false,
    }

    if (_config.sms.source_addr_ton != '' && _config.sms.source_addr_ton != null){
        init_param['source_addr_ton'] = parseInt(_config.sms.source_addr_ton);
    }

    if (_config.sms.source_addr_npi != '' && _config.sms.source_addr_npi != null){
        init_param['source_addr_npi'] = parseInt(_config.sms.source_addr_npi);
    }

    if (_config.sms.dest_addr_ton != '' && _config.sms.dest_addr_ton != null){
        init_param['dest_addr_ton'] = parseInt(_config.sms.dest_addr_ton);
    }

    if (_config.sms.dest_addr_npi != '' && _config.sms.dest_addr_npi != null){
        init_param['dest_addr_npi'] = parseInt(_config.sms.dest_addr_npi);
    }

    if (_config.sms.system_type != '' && _config.sms.system_type != null){
        init_param['system_type'] = _config.sms.system_type;
    }

    if (_config.sms.interface_version != '' && _config.sms.interface_version != null){
        init_param['interface_version'] = _config.sms.interface_version;
    }

    if (_config.sms.bind_type != '' && _config.sms.bind_type != null){
        init_param['bind_type'] = _config.sms.bind_type;
    }

    if (_config.sms.service_type != '' && _config.sms.service_type != null){
        init_param['service_type'] = _config.sms.service_type;
    }

    SmsGateway.init(init_param);
    // Initiate Consumer
    var SmsSendConsumer = require('./consumer/SmsSend'); // Start up ConsumerSmsSend
    var DlrProcessConsumer = require('./consumer/DlrProcess'); // Start up ConsumerDlrProcess
}


const processInput = (req, res, mt_type, send_direct=false) => {

    var msisdn = !req.body.msisdn ? '' : req.body.msisdn;
    var message = !req.body.message ? '' : req.body.message;
    var operator = !req.body.operator ? '' : req.body.operator;
    var short_code = !req.body.short_code ? '' : req.body.short_code;

    if (msisdn == ''){
        return res.send({
            'error' :true,
            'message' :'Incomplete request',
            'data' :['Provide msisdn'],
            'code' :400,
        });
    }

    if (message == ''){
        return res.send({
            'error' :true,
            'message' :'Incomplete request',
            'data' :['Provide message'],
            'code' :400
        });
    }

    if (operator == ''){
        return res.send({
            'error' :true,
            'message' :'Incomplete request',
            'data' :['Provide operator'],
            'code' :400
        });
    }

    // decrypt msisdn

    if(mt_type == 'ussd'){
        var app_id = !req.body.app_id ? '' : req.body.app_id;
        if (app_id == ''){
            return res.send({
                'error' :true,
                'message' :'Incomplete request',
                'data' :['Provide app_id'],
                'code' :400
            });
        }
    }

    if (short_code == ''){
        return res.send({
            'error' :true,
            'message' :'Incomplete request',
            'data' :['Provide short_code'],
            'code' :400
        });
    }

    switch(mt_type){
        case "ussd":

            if (_config.ussd.activate != 'true'){
                return res.send({
                    'error' :true,
                    'message' :'USSD not supported',
                    'data' :['USSD not supported'],
                    'code' :400,
                });
            }else{
                return UssdGateway.mt_request({
                    "msisdn":msisdn,
                    "message":message,
                    "operator":operator,
                    "app_id":app_id,
                    "short_code":short_code
                }, res);
            }

        break;
        case "sms":
        if (_config.sms.activate != 'true'){
            return res.send({
                'error' :true,
                'message' :'SMS not supported',
                'data' :['SMS not supported'],
                'code' :400,
            });
        }else{
            var dlr_mask = !req.body['dlr-mask'] ? '' : req.body['dlr-mask'];
            var dlr_url = !req.body['dlr-url'] ? '' : req.body['dlr-url'];


            console.log('c---------------',send_direct);

            if(send_direct == true){
                return SmsGateway.mt_direct_request({
                    "msisdn":msisdn,
                    "message":message,
                    "operator":operator,
                    "app_id":app_id,
                    "short_code":short_code,
                    "dlr_mask":dlr_mask,
                    "dlr_url":dlr_url,
                }, res);
            }else{
                return SmsGateway.mt_request({
                    "msisdn":msisdn,
                    "message":message,
                    "operator":operator,
                    "app_id":app_id,
                    "short_code":short_code,
                    "dlr_mask":dlr_mask,
                    "dlr_url":dlr_url,
                }, res);
            }
        }
        break;
        default:
            return res.send({
                'error' :true,
                'message' :'Invalid request type',
                'data' :['Provide short_code'],
                'code' :400
            });
        break;
    }
}

app.post('/ussd/identifier/send', function(req, res, next) {

    const startDate = new Date();
    var identifier = !req.body.identifier ? '' : req.body.identifier;

    if (identifier == ''){
        return res.send({
            'error' :true,
            'message' :'Incomplete request',
            'data' :['Provide identifier'],
            'code' :400,
        });
    }

    const encrypted_msisdn = new EncryptedMSISDN(identifier, true);



    encrypted_msisdn.getMsisdn(identifier)
    .then((response) => {
        
        req.body.msisdn = response;
        // req.body.operator = response.response.operator;
       
        processInput(req, res, 'ussd');

        const endDate = new Date();
        
        logger.debug('start time to send to ', identifier, " ", startDate);
        logger.debug('end time to send to ', identifier, " ", endDate);

    })
    .catch((error) => {
        return res.send({
            'error' :true,
            'message' :'Error getting MSISDN',
            'data' :{},
            'code' :404
        });
    });
});

app.post('/sms/identifier/send', function(req, res, next) {

    const startDate = new Date();
    var identifier = !req.body.identifier ? '' : req.body.identifier;

    if (identifier == ''){
        return res.send({
            'error' :true,
            'message' :'Incomplete request',
            'data' :['Provide identifier'],
            'code' :400,
        });
    }

    const encrypted_msisdn = new EncryptedMSISDN(identifier, true);



    encrypted_msisdn.getMsisdn(identifier)
    .then((response) => {
        
        req.body.msisdn = response;

        const processStart = new Date();
        processInput(req, res, 'sms');
        const processEnd = new Date();

        const endDate = new Date();
        
        logger.debug('start time to send to ', identifier, " ", startDate);
        logger.debug('end time to send to ', identifier, " ", endDate);
        logger.debug('process took '+ (processEnd.getTime() - processStart.getTime())/1000 + " seconds");
    })
    .catch((error) => {
        console.error(error);
        return res.send({
            'error' :true,
            'message' :'Error getting MSISDN',
            'data' :{},
            'code' :404
        });
    });




});


app.post('/ussd/msisdn/send', function(req, res, next) {
    return processInput(req, res, 'ussd');
});



app.post('/sms/msisdn/send', function(req, res, next) {
    return processInput(req, res, 'sms');
});

app.post('/sms/msisdn/direct_send', function(req, res, next) {
    return processInput(req, res, 'sms', true);
});

// global error handler in case an error is not handled
app.use(function (err, req, res, next) {
    logger.error(err.stack)
    res.status(500).send('Unable to handle request');
});


app.listen(_config.app_port);
logger.debug("listening on port ",_config.app_port);

