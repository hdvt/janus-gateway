'use strict';

function HashMap() {
    var e = [];
    return e.size = function () {
        return this.length
    }, e.isEmpty = function () {
        return 0 === this.length
    }, e.containsKey = function (e) {
        e += "";
        for (var t = 0; t < this.length; t++)
            if (this[t].key === e) return t;
        return -1
    }, e.get = function (e) {
        e += "";
        var t = this.containsKey(e);
        if (t > -1) return this[t].value
    }, e.put = function (e, t) {
        if (e += "", -1 !== this.containsKey(e)) return this.get(e);
        this.push({
            key: e,
            value: t
        })
    }, e.allKeys = function () {
        for (var e = [], t = 0; t < this.length; t++) e.push(this[t].key);
        return e
    }, e.allIntKeys = function () {
        for (var e = [], t = 0; t < this.length; t++) e.push(parseInt(this[t].key));
        return e
    }, e.remove = function (e) {
        e += "";
        var t = this.containsKey(e);
        t > -1 && this.splice(t, 1)
    }, e.clear = function () {
        for (var e = this.allKeys(), t = 0; t < e.length; t++) {
            var r = e[t];
            this.remove(r)
        }
    }, e
}

function randomString(len) {
    var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
        var randomPoz = Math.floor(Math.random() * charSet.length);
        randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
};

class WebSocketWrapper {
    constructor(server, protocol) {
        this.server = server;
        this.protocol = protocol;
        this.socket = null;
        this._onEvents = new HashMap();
        this.userDisconnect = false;
        this.reconnectMethod = null;
        this.reconnectInternal = 3e3;
        this.connectTimeout = 5e3;
        this.connectTimeoutMethod = null;
        this.connected = false;
    }
    connect() {
        var that = this;
        this.socket = new WebSocket(this.server, this.protocol);
        this.connectTimeoutMethod && clearTimeout(this.connectTimeoutMethod);
        this.connectTimeoutMethod = setTimeout(() => {
            console.debug("Connect timeout. Reconnecting...")
            that.socket.close();
        }, this.connectTimeout);
        let wsHandlers = {
            'open': function () {
                that.connected = true;
                that.connectTimeoutMethod && clearTimeout(that.connectTimeoutMethod);
                that._callOnEvent('connect');
            },
            'message': function (event) {
                that._callOnEvent('message', JSON.parse(event.data));
            },
            'error': function (err) {
                that._callOnEvent('error', err);
                that.connectTimeoutMethod && clearTimeout(that.connectTimeoutMethod);
                that.socket.close();
            },
            'close': function () {
                if (that.connected) {
                    that.connected = false;
                    that._callOnEvent('disconnect');
                }
                that.connectTimeoutMethod && clearTimeout(that.connectTimeoutMethod);
                if (!that.userDisconnect) {
                    that.reconnectMethod && clearTimeout(that.reconnectMethod);
                    that.reconnectMethod = setTimeout(() => {
                        that.connect();
                    }, that.reconnectInternal);
                }
            }
        };
        for (var eventName in wsHandlers) {
            this.socket.addEventListener(eventName, wsHandlers[eventName]);
        }
    }
    reconnect() {
        this.disconnect();
        this.userCallReconnect && clearTimeout(this.userCallReconnect);
        this.userCallReconnect = setTimeout(() => {
            that.connect();
        }, 1e3);
    }
    disconnect() {
        this.userDisconnect = true;
        this.socket.close();
    }
    send(data) {
        this.socket.send(JSON.stringify(data))
    }
    on(event, callback) {
        this._onEvents.put(event, callback);
    }
    _callOnEvent(event, data) {
        var callback = this._onEvents.get(event);
        callback ? data ? callback.call(this, data) : callback.call(this) : console.log("Please implement ComClient event: " + event);
    }

}

class ComClient {
    constructor() {
        this.server = "ws://" + window.location.hostname + ":8188"
        this.socket = null;
        this.connected = false;
        this.comCalls = [];
        this.session_id = null;
        this.handle_id = null;

        this._onEvents = new HashMap();
        this._callbacks = new HashMap();

        this.keepAlivePeriod = 25000;
        this.wsKeepaliveInternalId = null;
    }

    connect(token) {
        if (this.connected) {
            console.log("Already connected!");
            return;
        }
        var that = this;
        this.socket = new WebSocketWrapper(this.server, 'janus-protocol');
        this.socket.on('connect', () => {
            if (!that.session_id) {
                var request = { "janus": "create", "token": token };
                that.sendMessage(request, function (res) {
                    if (res["janus"] === "success") {
                        console.log("Server connected. ID " + res.data["session_id"]);
                        that.connected = true;
                        that.session_id = res.data["session_id"];
                        that.handle_id = res.data["handle_id"];
                        that.wsKeepaliveInternalId && clearInterval(that.wsKeepaliveInternalId);
                        that.wsKeepaliveInternalId = setInterval(() => {
                            if (!that.connected) {
                                clearInterval(that.wsKeepaliveInternalId);
                                return;
                            }
                            var request = { "janus": "keepalive", "session_id": that.session_id };
                            that.sendMessage(request, function (res) {
                                console.debug("Keepalive on session " + that.session_id);
                            })
                        }, that.keepAlivePeriod);
                        that._callOnEvent('connect', res.data);
                    }   
                });
            }
            else {
                var request = { "janus": "claim", "session_id": that.session_id };
                that.sendMessage(request, function (res) {
                    if (res["janus"] === "success") {
                        console.log("Server reconnected. ID " + res.data["session_id"]);
                        that.connected = true;
                        clearTimeout(that.wsKeepaliveTimeoutId);
                        that.wsKeepaliveTimeoutId = setTimeout(() => {
                            if (!that.connected)
                                return;
                            this.wsKeepaliveTimeoutId = setTimeout(that._keepAlive, that.keepAlivePeriod);
                            var request = { "janus": "keepalive", "session_id": that.session_id };
                            that.sendMessage(request, function (res) {
                                console.debug("Keepalive on session " + that.session_id);
                            })
                        }, that.keepAlivePeriod);
                    }
                    else {
                        console.debug("Counld not claim the session. Create new session");
                        that.session_id = null;
                        that.handle_id = null;
                        that.connect(token);
                    }
                });
            }
        });
        this.socket.on('disconnect', () => {
            console.log("Socket disconnect!");
            that.connected = false;
            that._callOnEvent('disconnect');
        });
        this.socket.on('message', (data) => {
            that._handleEvent(data);
        });
        this.socket.on('error', (err) => {
            console.error('Socket error: ', err);
        });
        this.socket.connect();
    }
    disconnect() {
        this.connected && this.socket && this.socket.close();
    }
    sendMessage(data, callback) {
        data.transaction = data.transaction ? data.transaction : randomString(12);
        this._pushCallback(data.transaction, callback);
        console.debug("sendMessage: ", data);
        this.socket.send(data);
    }
    on(event, callback) {
        this._onEvents.put(event, callback);
    }
    // private 

    _handleEvent(data) {
        console.debug("_handleEvent: ", data);
        if (data.transaction) {
            this._callCallback(data.transaction, data);
        }
    }
    _findCallById(callId) {
        let call = this.comCalls.find((call => call.call_id === callId))
        return call ? call : null;
    }
    _callOnEvent(event, data) {
        var callback = this._onEvents.get(event);
        callback ? data ? callback.call(this, data) : callback.call(this) : console.log("Please implement ComClient event: " + event);
    }
    _pushCallback(requestId, callback) {
        if (callback) {
            this._callbacks.put(requestId, callback);
        }
    }
    _callCallback(requestId, data) {
        var callback = this._callbacks.get(requestId);
        if (callback) {
            this._callbacks.pop();
            callback.call(this, data);
        }
    }
}

class ComCall {
    constructor(client) {
        this.client = comClient;
    }
}
