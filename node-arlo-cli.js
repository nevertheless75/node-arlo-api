var ArloApi     = require('./node-arlo-api').ArloApi;

var inquirer    = require('inquirer');
var clui        = require('clui');
var argv        = require('minimist')(process.argv.slice(2));

var uParam = "";
if (argv.u && argv.u !== ""){
    uParam = argv.u;
}

var pParam = "";
if (argv.p && argv.p !== ""){
    pParam = argv.p;
}

inquirer.prompt([
{
    type: 'input',
    message: 'Enter your Arlo username:',
    name: 'username',
    default: uParam
},
{
    type: 'password',
    message: 'Enter your Arlo password:',
    name: 'password',
    default: pParam
}]).then(function (answers) {
 
    var username, password;

    if (answers.username && answers.username !== ""){
        username = answers.username;
    }

    if (answers.password && answers.password !== ""){
        password = answers.password;
    }

    var arlo = new ArloApi(username, password);
    
    var Spinner = clui.Spinner;
    var ls = new Spinner("Creating Arlo session ...");
    ls.start();

    var self = this;
    self.ls = ls;
    self.arlo = arlo;
    initSession.bind(self);

    arlo.getDevices()
        .then(initSession)
        .fail(function(error){
            ls.stop();
            console.error("Failed creating session: " + error.message);
            process.exit(0);
        });
});

var operations = [
{
    type: 'list',
    name: 'operation',
    message: 'What do you want to do?',
    choices: ['Arm', 'Disarm', 'Cameras', 'Basestation', 'Modes']
}];

var anotherOperation = [
{
    type: 'confirm',
    name: 'promptAgain',
    message: 'Do you want to do something else?',
    default: true
}];

function promptAgain() {
    inquirer.prompt(anotherOperation).then(function (answers) {
        if (answers.promptAgain) {
            prompt();
        }else{
            process.exit(0);
        }
    }); 
}

function prompt() {
    inquirer.prompt(operations).then(function (answers) {
        if (answers.operation == "Arm"){
            this.arlo.arm(this.deviceId, this.xCloudId).then(promptAgain);
        }
        if (answers.operation == "Disarm"){
            this.arlo.disarm(this.deviceId, this.xCloudId).then(promptAgain);
        }
        if (answers.operation == "Modes"){
            this.arlo.getModes(this.deviceId, this.xCloudId).then(print).then(promptAgain);
        }
        if (answers.operation == "Basestation"){
            this.arlo.getBaseStation(this.deviceId, this.xCloudId).then(print).then(promptAgain);
        }s
        if (answers.operation == "Cameras"){
            this.arlo.getCameras(this.deviceId, this.xCloudId).then(print).then(promptAgain);
        }
    });
}

function initSession(devices){
    ls.stop();
    for (var i = 0; i < devices.length; i++){
        if (devices[i].deviceType == "basestation"){
            var deviceId = devices[i].deviceId;
            var xCloudId = devices[i].xCloudId;
            
            console.log("Basestation found with device ID: " + deviceId);
            console.log("X-Cloud ID: " + xCloudId);

            var self = this;
            self.arlo = arlo;
            self.deviceId = deviceId;
            self.xCloudId = xCloudId;
            prompt.bind(self);
            prompt();
        }
    }
}

function print(data){
    console.log(data);
}