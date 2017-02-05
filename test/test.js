var ArloApi     = require('../node-arlo-api').ArloApi;
var PropertiesReader = require('properties-reader');
var assert = require('assert');
var q = require('q');

var properties = PropertiesReader(__dirname + '/test.properties');

var u = properties.get("username");
var p = properties.get("password");

var arlo = new ArloApi(u, p);

describe('ArloApi', function() {
    describe('#login()', function() {
        it('should return a valid token', function(done) {
            arlo.login().then(function (data){
                if (data.success && data.data.token){
                    done();
                }else{
                    done(new Error("no valid token returned"));
                }
            }).fail( function(error){
                done(error);
            });
        });  
    });
});

describe('ArloApi', function() {

    describe('#getBaseStation()', function() {
        it('should return information about the base station', function(done) {
            setup().then(function (arloSystem){
                arlo.getBaseStation(arloSystem.deviceId, arloSystem.xCloudId).then(function (data){
                    if (data && data.properties.state == "idle"){
                        done();
                    }else{
                        done(new Error("no correct information returned"));
                    }   
                }).fail( function(error){
                    done(error);
                });           
            });
        });
    });
});

describe('ArloApi', function() {

    describe('#getCameras()', function() {
        it('should return information about registered cameras', function(done) {
            setup().then(function (arloSystem){
                arlo.getCameras(arloSystem.deviceId, arloSystem.xCloudId).then(function (data){
                    for (var i=0; i<data.properties.length; i++){
                        if (!contains(arloSystem.cameras, "serialNumber", data.properties[i].serialNumber)){
                            done(new Error("no correct information returned"));
                        }
                    }
                    done();   
                }).fail( function(error){
                    done(error);
                });           
            });
        }.bind(this));
    }.bind(this));

    describe('#getRules()', function() {
         it('should return information about defined rules', function(done) {
             setup().then(function (arloSystem){
                arlo.getRules(arloSystem.deviceId, arloSystem.xCloudId).then(function (data){                  
                    if (data.properties.rules){
                        for (var i=0; i<data.properties.rules.length; i++){
                            if (data.properties.rules[i].name.startsWith("**_DEFAULT_RULE_**")){
                                done();
                                break;
                            }
                        }
                    }else{
                        done(new Error("no correct result returned"));
                    }   
                }).fail( function(error){
                    done(error);
                });           
            });
        });
    });

    describe('#getModes()', function() {
         it('should return information about defined modes', function(done) {
             setup().then(function (arloSystem){
                arlo.getModes(arloSystem.deviceId, arloSystem.xCloudId).then(function (data){                  
                    if (data.properties.active == "mode0"){
                        for (var i=0; i<data.properties.modes.length; i++){
                            if (data.properties.modes[i].name.startsWith("*****_DEFAULT_MODE_ARMED_*****")){
                                done();
                                break;
                            }
                        }
                    }else{
                        done(new Error("no correct result returned"));
                    }   
                }).fail( function(error){
                    done(error);
                });           
            });
        });
    });
});

describe('ArloApi', function() {
    
    describe('#arm()', function() {
        it('should arm the system', function(done) {
            setup().then(function (arloSystem){
                arlo.arm(arloSystem.deviceId, arloSystem.xCloudId).then(function (data){
                    if (data.properties.active === "mode1"){
                        done();
                    }else{
                        done(new Error("no correct result returned"));
                    }   
                }).fail( function(error){
                    done(error);
                });           
            });
        });
    });

    describe('#disarm()', function() {
        it('should disarm the system', function(done) {
            setup().then(function (arloSystem){
                arlo.disarm(arloSystem.deviceId, arloSystem.xCloudId).then(function (data){
                    if (data.properties.active === "mode0"){
                        done();
                    }else{
                        done(new Error("no correct result returned"));
                    }   
                }).fail( function(error){
                    done(error);
                });           
            });
        });
    });

    describe('#toggleCamera()', function() {
        it('should toggle (on) a camera in the system', function(done) {
            setup().then(function (arloSystem){
                
                var cameraId = arloSystem.cameras[0].deviceId;
                var serialNumber = arloSystem.cameras[0].serialNumber;
                var self = this;
                self.serialNumber = serialNumber;
                
                arlo.toggleCamera(arloSystem.deviceId, arloSystem.xCloudId, cameraId, true).then(function(data){
                        
                        var self = this;
                        self.serialNumber = serialNumber;

                        if (data.properties.privacyActive === true){        
                              
                            arlo.getCameras(arloSystem.deviceId, arloSystem.xCloudId).then(function (cameras){
                                for (var i = 0; i < cameras.properties.length; i++){
                                    if (cameras.properties[i].serialNumber == this.serialNumber 
                                        && cameras.properties[i].privacyActive == true){
                                       done(); 
                                       break;
                                    }
                                }
                            }.bind(self));
                        }else{
                            done(new Error("no correct result returned"));
                        }   
                }.bind(self)).fail( function(error){
                    done(error);
                });           
            });
        });
    });

    describe('#toggleCamera()', function() {
        it('should toggle (off) a camera in the system', function(done) {
            setup().then(function (arloSystem){
                
                var cameraId = arloSystem.cameras[0].deviceId;
                var serialNumber = arloSystem.cameras[0].serialNumber;
                var self = this;
                self.serialNumber = serialNumber;
                
                arlo.toggleCamera(arloSystem.deviceId, arloSystem.xCloudId, cameraId, false).then(function(data){
                        
                        var self = this;
                        self.serialNumber = serialNumber;

                        if (data.properties.privacyActive === false){        
                              
                            arlo.getCameras(arloSystem.deviceId, arloSystem.xCloudId).then(function (cameras){
                                for (var i = 0; i < cameras.properties.length; i++){
                                    if (cameras.properties[i].serialNumber == this.serialNumber 
                                        && cameras.properties[i].privacyActive == false){
                                       done(); 
                                       break;
                                    }
                                }
                            }.bind(self));
                        }else{
                            done(new Error("no correct result returned"));
                        }   
                }.bind(self)).fail( function(error){
                    done(error);
                });           
            });
        });
    });

});

describe('ArloApi', function() {

    describe('#addRule()', function() {
        it('should return information about the base station', function(done) {
            setup().then(function (arloSystem){
                
                var properties = 
                {
                    "name":"Record video on Floor 1 Level if Floor 1 Level detects motion",
                    "id":"ruleNewTest",
                    "triggers":[
                        {
                            "type":"pirMotionActive",
                            "deviceId":arloSystem.devices,
                            "sensitivity":80
                        }
                    ],
                    "actions":[
                        {
                            "deviceId":arloSystem.devices,
                            "type":"recordVideo",
                            "stopCondition":{
                            "type":"timeout",
                            "timeout":10
                            }
                        },
                        {
                            "type":"pushNotification"
                        },
                        {
                            "type":"sendEmailAlert",
                            "recipients":[
                            "__OWNER_EMAIL__"
                            ]
                        }
                    ]
                };

                arlo.addRule(arloSystem.deviceId, arloSystem.xCloudId, properties).then(function (data){
                    console.log(data);
                    if (data){
                        done();
                    }else{
                        done(new Error("no correct information returned"));
                    }   
                }).fail( function(error){
                    done(error);
                });           
            });
        });
    });
});

function contains(anArray, key, value){
    for (var i=0; i<anArray.length; i++){
        anArray[i].key = value;
        return true;
    }
    return false;
}
function setup(){
    var deferred = q.defer();

    arlo.getDevices().then(function (devices){

        var arloSystem = {};
        arloSystem.cameras = [];

        for (var i = 0; i < devices.length; i++){
            if (devices[i].deviceType == "basestation"){
                arloSystem.deviceId = devices[i].deviceId;
                arloSystem.xCloudId = devices[i].xCloudId;
                arloSystem.serialNumber = devices[i].properties.serialNumber;
            }
            else if (devices[i].deviceType == "camera"){
                var camera = {};
                camera.deviceId = devices[i].deviceId;
                camera.xCloudId = devices[i].xCloudId;
                camera.serialNumber = devices[i].properties.serialNumber;
                arloSystem.cameras.push(camera);
            }
        }
        deferred.resolve(arloSystem);
    });

    return deferred.promise;
}