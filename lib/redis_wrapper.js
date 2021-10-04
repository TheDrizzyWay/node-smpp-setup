var _config = require('../conf/config');

var redis_wrapper = {

    _error_message : "Connection to Service Gateway Failed!",

    client: null,

    connected: false,

    options : {
        host: '',
        port: '',
        db: '',
        password: '',
    },

    init : function(){

        var redis = require("redis");

        redis_wrapper.options = redis_wrapper.extend({}, redis_wrapper.options, {
            host: _config.database.redis.host,
            port: _config.database.redis.port,
            db: _config.database.redis.db,
            password: _config.database.redis.password,
        });

        redis_wrapper.client = redis.createClient(redis_wrapper.options);

        redis_wrapper.connected = true;
    },

    extend : function (target) {
        var sources = [].slice.call(arguments, 1);
        sources.forEach(function (source) {
            for (var prop in source) {
                target[prop] = source[prop];
            }
        });
        return target;
    },

    save_data : function (key, data, callback) {
        redis_wrapper.client.hmset(key, data, function (err, reply) {
            if (callback != undefined){
                return callback(err, reply);
            } 
        });
    },

    save_to_set : function (key, field, value, callback) {
        redis_wrapper.client.hset(key, field, value, function (err, reply) {
            if (callback != undefined){
                return callback(err, reply);
            } 
        });
    },

    get_from_set : function (key, field, callback) {
        redis_wrapper.client.hget(key, field, function (err, reply) {
            if (callback != undefined){
                return callback(err, reply);
            } 
        });
    },

     
    increase_count : function (key, field, callback) {
        redis_wrapper.client.hget(key, field, function (err, data) {
            if (callback != undefined){
                if (data != null){
                    data = parseInt(data)
                    data = data + 1
                    console.log("Data to save", data);
                    redis_wrapper.client.hset(key, field, data, function (err, reply) {
                        if (callback != undefined){
                            // return callback(err, reply);
                        } 
                    });
                    
                }else{
                    // Not Yet set
                    redis_wrapper.client.hset(key, field, "1", function (err, reply) {
                        if (callback != undefined){
                            // return callback(err, reply);
                        } 
                    });
                }
                return callback(err, data);
            } 
        });
    },


    set : function (key, data, callback) {
        redis_wrapper.client.set(key, data, function (err, reply) {
            if (callback != undefined){
                return callback(err, reply);
            } 
        });
    },

    set_async : function (key, data) {
        return new Promise((resolve, reject) => {
            redis_wrapper.client.set(key, data, function (err, reply) {
                if (err){
                    reject(err);
                } else {
                    resolve(reply);
                }
            });
        });
    },

    get : function (key, callback) {
        redis_wrapper.client.get(key, function (err, reply, data) {
            if (callback != undefined){
                return callback(err, reply, data);
            } 
        });
    },

    get_async : function (key) {
        return new Promise((resolve, reject) => {
            redis_wrapper.client.get(key, function (err, reply) {
                if (err)
                    reject(err);
                else 
                    resolve(reply);
            });
        });  
    },

    get_data : function (key, callback) {
        redis_wrapper.client.hgetall(key, function (err, reply, data) {
            if (callback != undefined){
                return callback(err, reply, data);
            } 
        });
    },

    get_data_async(key) {
        return new Promise((resolve, reject) => {
            redis_wrapper.get_data(key, function (err, obj) {
                if (err)
                    reject(err);
                else 
                    resolve(obj);
            });
        });  
    },

    expire : function (key, ttl, callback) {
        redis_wrapper.client.expire(key, ttl,function (err, reply) {
            if (callback != undefined){
                return callback(err, reply);
            } 
        });
    },

    delete : function (key, callback) {
        redis_wrapper.client.del(key,function (err, reply) {
            if (callback != undefined){
                return callback(err, reply);
            } 
        });
    },

    exist : function (key, callback) {
        redis_wrapper.client.exists(key,function (err, reply) {
            if (callback != undefined){
                return callback(err, reply);
            } 
        });
    },
}

module.exports = redis_wrapper;