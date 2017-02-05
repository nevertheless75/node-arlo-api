"use strict";

var EventSource = require('EventSource');

var userId;
var eventSource;

var token;
var cookieset;

function ArloStream(userId, eventSource) {
    this.userId = userId;
    this.eventSource = eventSource;
}

module.exports = function (userId, eventSource) {
    return new ArloStream(userId, eventSource);
};