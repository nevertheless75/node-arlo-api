"use strict";

//
// Wrapper for nodejs around Arlo's Event Stream based API
//

var Client = require('node-rest-client').Client;
var EventSource = require('EventSource');
var q = require('q');

var ffmpeg = require('fluent-ffmpeg');
var dateFormat = require('dateformat');

var debug = require('debug')('node-arlo-api')  

var uuid = require('node-uuid');

var client = new Client();

var eventStream;
var session;


function ArloApi(config) {
    this._config = config;
    this._config.ARLO_BASE_URL = "https://arlo.netgear.com/hmsweb/";
    this._config.LOGIN_URL = this._config.ARLO_BASE_URL + "login";
    this._config.LOGOUT_URL = this._config.ARLO_BASE_URL + "logout";
    this._config.SUBSCRIBE_URL = this._config.ARLO_BASE_URL + "client/subscribe?token=";
    this._config.UNSUBSCRIBE_URL = this._config.ARLO_BASE_URL + "client/unsubscribe";
    this._config.STREAM_URL = this._config.ARLO_BASE_URL + "users/devices/startStream?stream=";
    this._config.NOTIFY_URL = this._config.ARLO_BASE_URL + "users/devices/notify/${deviceId}";
}

module.exports = function (username, password) {
    var config = {
        "username" : username,
        "password" : password 
    };

    return new ArloApi(config);
};

ArloApi.prototype.login = function (deviceId, xCloudId) {
    return this._login();    
};

ArloApi.prototype.getBaseStation = function (deviceId, xCloudId) {
    var body = {"action":"get","resource":"basestation","publishResponse":"false"};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.getCameras = function (deviceId, xCloudId) {
    var body = {"action":"get","resource":"cameras","publishResponse":"false"};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.getRules = function (deviceId, xCloudId) {
    var body = {"action":"get","resource":"rules","publishResponse":"false"};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.getModes = function (deviceId, xCloudId) {
    var body = {"action":"get","resource":"modes","publishResponse":"false"};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.arm = function (deviceId, xCloudId) {
    var body = {"action":"set","resource":"modes","publishResponse":"true","properties":{"active":"mode1"}};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.disarm = function (deviceId, xCloudId) {
    var body = {"action":"set","resource":"modes","publishResponse":"true","properties":{"active":"mode0"}};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.calendar = function (deviceId, xCloudId) {
    var body = {"action":"set","resource":"schedule","publishResponse":"true","properties":{"active":"true"}};
    this._requestAndResponse(deviceId, xCloudId, body);
};

/**
 *  {
 *      "name":"Record video on Floor 1 Level if Floor 1 Level detects motion",
 *      "id":"ruleNew",
 *      "triggers":[
 *      {
 *          "type":"pirMotionActive",
 *          "deviceId":"XYZ",
 *          "sensitivity":80
 *      }],
 *      "actions":[
 *      {
 *          "deviceId":"XYZ",
 *          "type":"recordVideo",
 *          "stopCondition":{
 *              "type":"timeout",
 *              "timeout":10
 *          }
 *      },
 *      {
 *          "type":"pushNotification"
 *      },
 *      {
 *          "type":"sendEmailAlert",
 *           "recipients":[
 *              "__OWNER_EMAIL__"
 *           ]
 *       }]
 *  }
 **/
ArloApi.prototype.addRule = function (deviceId, xCloudId, properties) {
    var body = {"action":"add","resource":"rules","publishResponse":"true","properties":properties};
    console.log(body);
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.addMode = function (deviceId, xCloudId, name, rule) {
    var body = {"action":"add","resource":"rules","publishResponse":"true","properties":{"name":name,"rules":[rule]}};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.customMode = function (deviceId, xCloudId, mode) {
    var body = {"action":"set","resource":"modes","publishResponse":"true","properties":{"active":mode}};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.deleteMode = function (deviceId, xCloudId, mode) { // TODO
    var body = {"action":"delete","resource":"modes/","publishResponse":"true"};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.toggleCamera = function (deviceId, xCloudId, cameraId, privacyActive) {
    var body = {"action":"set","resource":"cameras/" + cameraId,"publishResponse":"true","properties":{"privacyActive":privacyActive}};
    return this._requestAndResponse(deviceId, xCloudId, body);
};	



// Streaming

ArloApi.prototype.startStream = function (deviceId, xCloudId, cameraId) {
    
    var self = {};
    self.config = this._config;

    var body = {"action":"set","resource":"cameras/" + cameraId,"publishResponse":"true","properties":{"activeState":"startPositionStream"}};;

    self.deviceId = deviceId;
    self.xCloudId = xCloudId;
    self.cameraId = cameraId;
    self.body = body;
    
    this._login.bind(self);

    this._login().then(
        this._prepare.bind(self)).then(
            this._stream.bind(self)).done();
   
};	

// TODO : Does this API exist at all?
ArloApi.prototype.stopStream = function (deviceId, xCloudId, cameraId) {
    var body = {"action":"set","resource":"cameras/" + cameraId,"publishResponse":"true","properties":{"activeState":"idle"}};
    return this._requestAndResponse(deviceId, xCloudId, body);
};

ArloApi.prototype.getServiceLevel = function () {
    return this._request(this._config.ARLO_BASE_URL + "users/serviceLevel", client.get, {});
}

ArloApi.prototype.getPaymentOffers = function () {
    return this._request(this._config.ARLO_BASE_URL + "users/payment/offers", client.get, {});
}

ArloApi.prototype.getProfile = function () {
    return this._request(this._config.ARLO_BASE_URL + "users/profile", client.get, {});
}

ArloApi.prototype.getFriends = function () {
    return this._request(this._config.ARLO_BASE_URL + "users/friends", client.get, {});
}

ArloApi.prototype.getLocations = function () {
    return this._request(this._config.ARLO_BASE_URL + "users/locations", client.get, {});
}

ArloApi.prototype.getLibrary = function (dateFrom, dateTo) {

    if (!dateFrom){
        var now = new Date();
        dateFrom = dateFormat(now, "yyyymmdd");
    }
        
    if (!dateTo){
        var now = new Date();
        dateTo = dateFormat(now, "yyyymmdd");
    }

    return this._request(this._config.ARLO_BASE_URL + "users/library", client.post, {"dateFrom":dateFrom,"dateTo":dateTo}); 
}

ArloApi.prototype.getLibraryMetaData = function (dateFrom, dateTo) {

    if (!dateFrom){
        var now = new Date();
        dateFrom = dateFormat(now, "yyyymmdd");
    }
        
    if (!dateTo){
        var now = new Date();
        dateTo = dateFormat(now, "yyyymmdd");
    }

    return this._request(this._config.ARLO_BASE_URL + "users/library/metadata", client.post, {"dateFrom":dateFrom,"dateTo":dateTo}); 
}

ArloApi.prototype.getDevices = function () {
    return this._request(this._config.ARLO_BASE_URL + "users/devices", client.get, {}); 
};	

ArloApi.prototype.updateProfile = function (firstname, lastname) {
    return this._request(this._config.ARLO_BASE_URL + "users/profile", client.put, {"firstName":firstname,"lastName":lastname}); 
};

ArloApi.prototype.updatePassword = function (password) {
    var self = this;
    self.newPassword = password;

    var promise = this._request(this._config.ARLO_BASE_URL + "users/changePassword", client.post, {"currentPassword":this._config.password,"newPassword":password}); 
    
    promise.then( function (){
        this._config.password = this.newPassword;
    }.bind(this));
    
    return promise; 
};	

/**
 *  Example structure of body parameter:
 * 
 *  {
 *      "firstName":<FIRSTNAME>,
 *      "lastName":<LASTNAME>,
 *      "devices":
 *      {
 *	        <SERIALNUMBER>:<NAME1>,
 *	        <SERIALNUMBER>:<NAME2>
 *      },
 *      "lastModified":<DATEINMS>,
 *      "adminUser":true,
 *      "email":"<EMAIL>",
 *      "id":"<ID>"
 *  } 
 */
ArloApi.prototype.updateFriends = function (body) {
    return this._request(this._config.ARLO_BASE_URL + "users/friends", client.put, body); 
};

ArloApi.prototype.updateDeviceName = function (parentId, deviceId, name) {
    var body = {"deviceId" : deviceId, "deviceName" : name, "parentId" : parentId};
    return this._request(this._config.ARLO_BASE_URL + "users/devices/renameDevice", client.put, body); 
};

/**
 *  Example structure of body parameter:
 * 
 *  {
 *      "devices":
 *      {
 *	        <SERIALNUMBER>:1,
 *	        <SERIALNUMBER>:2
 *      },
 *   } 
 */
ArloApi.prototype.updateDisplayOrder = function (body) {
    return this._request(this._config.ARLO_BASE_URL + "users/devices/displayOrder", client.post, body); 
};

ArloApi.prototype._getConfig = function () {
    return this._config;
};

ArloApi.prototype.deleteRecording = function (createDate, utcCreatedDate, deviceId) {
    var body = {"data" : [ { "createdDate" : createDate, "utcCreatedDate" : utcCreatedDate, "deviceId" : deviceId} ] };
    return this._request(this._config.ARLO_BASE_URL + "users/library/recycle", client.post, body); 
};

ArloApi.prototype._request = function (url, httpMethod, body) {

    var deferred = q.defer();

    var self = {};
    self.deferred = deferred;
    self.url = url;
    self.httpMethod = httpMethod; 
    self.config = this._config;
    self.body = body;

    this._login.bind(self);

    this._login()
        .then(this._prepare.bind(self))
        .then(this._send.bind(self))
        .fail( function(error){
            deferred.reject(error);
        });
            
    return deferred.promise;
}

ArloApi.prototype._requestAndResponse = function (deviceId, xCloudId, body) {

    var deferred = q.defer();

    var self = {};
    self.config = this._config;
 
    var transId = uuid.v1();

    self.transId = transId; 
    self.deviceId = deviceId;
    self.xCloudId = xCloudId;
    self.body = body;

    self.rnrDeferred = deferred;

    self.notify = this._notify;
  
    this._login.bind(self);

    this._login()
        .then(this._subscribe.bind(self))
        .then(this._register.bind(self))
        .then(this._invoke.bind(self))
        .then(this._confirm.bind(self))
        .fail( function(error){
            deferred.reject(error);
        });

    return deferred.promise;
} 

ArloApi.prototype._login = function () {

    var deferred = q.defer();

    if (session){
        deferred.resolve();
        return deferred.promise;
    }
    
    var args = 
    {
        data: { "email" : this._config.username, "password" : this._config.password },
        headers: { "Content-Type": "application/json", "User-Agent": "" }
    };

    client.post(this._config.LOGIN_URL, args, function (data, resp){
        if (data.success){
            session = {};
            session.userId = data.data.userId;
            session.token = data.data.token;
            session.setcookie = resp.headers["set-cookie"];
            session.transactions = [];      
            deferred.resolve(data);
        }else{
            var error = new Error();
            error.message = data.data.reason;
            deferred.reject(error);
        }
    });

    return deferred.promise;
};

ArloApi.prototype._prepare = function () {
    this.body.transId = uuid.v1();
    if (this.xCloudId)
        this.body.xCloudId = this.xCloudId;
    
    this.body.from = session.userId + "_web";
    if (this.deviceId)
        this.body.to = this.deviceId;
}

ArloApi.prototype._send = function () {

    var self = this;
    var args = {};

    args.headers = 
    { 
        "Content-Type" : "application/json",
        "User-Agent" : "web", 
        "Authorization" : session.token, 
        "Cookie" : session.setcookie.join( "; " )
    };

    if (this.xCloudId)
        args.headers.xCloudId = this.xCloudId;

    if (this.body)
        args.data = this.body;
    
    this.httpMethod(this.url, args, function (data, resp){
        if (data.success){
            this.deferred.resolve(data.data);
        }else{
            var error = new Error();
            error.message = data.data.reason;
            this.deferred.reject(error);
        }
    }.bind(self));
}

ArloApi.prototype._stream = function () {

    var deferred = q.defer();

    var args = {};

    args.headers = 
    { 
        "Content-Type" : "application/json",
        "User-Agent" : "web", 
        "Authorization" : session.token, 
        "xCloudId" : this.xCloudId, 
        "Cookie" : session.setcookie.join( "; " )
    };

    args.data = this.body;
    
    client.post(this.config.STREAM_URL, args, function (data, resp){
        
        debug("_stream callback: " + data);
        
        if (data.success){
            var command = ffmpeg(data.data.url);
        }
    })

    return deferred.promise;
}

ArloApi.prototype._subscribe = function () {

    var deferred = q.defer();

    if (session.subscribed){
        deferred.resolve();
        return deferred.promise;
    }

    var args = 
    { 
        headers : { "Content-Type" : "text/event-stream", "Cookie" : session.setcookie.join( "; " ), "Last-Event-ID" : this.transId } 
    };
    
    var eventSource = new EventSource(this.config.SUBSCRIBE_URL + session.token, args);
    
    eventStream = {};
    eventStream.userId = session.userId;
    eventStream.eventSource = eventSource;
   
    eventSource.onopen = function (event) {
        if (event) {
            debug("Event stream opened.");
        }
    };

    eventSource.onmessage = function (event) {
        if (event) {

            var data = JSON.parse(event.data);

            if (event.type === "message" && data.action === "logout"){
                session = {};
                // TODO : unsubscribe and logout
                debug(data.reason);
            } else if (event.type === "message" && data.status === "connected"){
                eventStream.connected = true;
                debug("Event stream connected (" + eventStream.userId + ").");
                session.subscribed = true;
                deferred.resolve(data);
            } else if (event.type === "message" && data.action === "is"){
                
                if (session){
                    for (var i=0; i<session.transactions.length; i++){
                        if (session.transactions[i].transId === data.transId){
                            session.transactions[i].promise.resolve(data);
                            session.transactions.splice(i, 1);
                            debug("Unbound event to transaction " + data.transId + ".");
                            debug(event);
                            deferred.resolve(data);
                            return;
                        }
                    }
                }

                debug("No transaction for event with transaction ID " + data.transId + " found");
                debug(event);

            } else {
                debug(event);
            }
        }
    };

    eventSource.onerror = function (err) {
        if (err) {
            if (err.status === 401 || err.status === 403) {
                console.err('not authorized');
            }
        }
    };

    return deferred.promise;
};

ArloApi.prototype._register = function () {

    var deferred = q.defer();

    var transIdReg = this.transId + "_reg";
    
    if (session.registered){
        deferred.resolve();
        return deferred.promise;
    }

    session.transactions.push({"transId" : transIdReg, "promise" : deferred});
    debug("Bound transaction " + transIdReg + " to session.");

    var body = 
    {
        "action" : "set",
        "resource" : "subscriptions/" + session.userId + "_web",
        "publishResponse" : "false",
        "properties" : { "devices" : [ this.deviceId  ] } 
    };
 
    this.notify(body, transIdReg, this.xCloudId, this.deviceId, deferred, function (data, resp) {
        if (data.success){
            session.registered = true;
            // do nothing since response will arrive asynchrnously
        }else{
            var error = new Error();
            error.message = data.data.reason;
            deferred.reject(error);
        }
    });
}

ArloApi.prototype._invoke = function () {
    var deferred = q.defer();

    session.transactions.push({"transId" : this.transId, "promise" : deferred});
    debug("Bound transaction " + this.transId + " to session.");

    this.notify(this.body, this.transId, this.xCloudId, this.deviceId, deferred, function (data, resp){ 
        if (data.success){
             // do nothing since response will arrive asynchrnously
        }else{
            var error = new Error();
            error.message = data.data.reason;
            deferred.reject(error);
        }
    });

    return deferred.promise;
}

ArloApi.prototype._confirm = function (data) {
    debug("Returnung data: " + data);
    this.rnrDeferred.resolve(data);
}

ArloApi.prototype._notify = function (body, transId, xCloudId, deviceId, deferred, callback) {
    
    var self = {};
    
    self.deferred = deferred;

    body.transId = transId;
    body.xCloudId = xCloudId;
    body.from = session.userId + "_web";
    body.to = deviceId;
    
    var args = { "data" : body };
    
    args.path = { "deviceId" : deviceId }; 
    
    args.headers = 
    { 
        "Content-Type" : "application/json", 
        "Authorization" : session.token, 
        "xCloudId" : xCloudId , 
        "Last-Event-ID" : transId,
        "Cookie" : session.setcookie.join( "; " )
    };
    
    client.post(this.config.NOTIFY_URL, args, callback.bind(self));
    
    return deferred.promise;
}