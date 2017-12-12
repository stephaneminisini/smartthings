/**
 *  Tivo Plugin
 *
 *  Author: stephane.minisini@gmail.com
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 * This is based on the generic device provided by redloro@gmail.com
 *
 */
var express = require('express');
var app = express();
var net = require('net');
var nconf = require('nconf');
var notify;

var logger = function (str) {
    mod = 'tivo';
    console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
    res.status(200).json({ status: 'Tivo plugin running' });
});

app.get('/watchnetflix', function (req, res) {
    tivo.watchnetflix();
    res.end()
});

app.get('/watchfootball', function (req, res) {
    tivo.watchfootball();
    res.end();
});

app.get('/search/:cmd', function (req, res) {
    tivo.search(req.params.cmd);
    res.end();
});

module.exports = function (f) {
    notify = f;
    return app;
};

function keyboardkey(key) {
    tivo.command("KEYBOARD " + key + "\r");
}

function channel(number) {
    tivo.command("SETCH " + number.toString() + "\r");
}

function sleep(time, callback) {
    var stop = new Date().getTime();
    while (new Date().getTime() < stop + time) {
        ;
    }
    callback();
}

/**
 * Plugin
 */
var tivo = new Tivo();
tivo.init();

function Tivo() {
    var device = null;
    var self = this;
    var locked = false;
    var tvready = false;

    /**
     * init (REQUIRED)
     */
    this.init = function () {
        if (!nconf.get('tivo:address') || !nconf.get('tivo:port')) {
            logger('** NOTICE ** Tivo settings not set in config file!');
            return;
        }

        if (device && device.writable) { return; }
        if (device) { device.destroy(); }

        device = new net.Socket();
        device.on('error', function (err) {
            logger("Tivo connection error: " + err.description);
            device.destroy();
            setTimeout(function () { self.init() }, 4000);
        });

        device.on('close', function () {
            logger('Tivo connection closed.');
            device.destroy();
            setTimeout(function () { self.init() }, 4000);
        });

        device.on('data', function (data) {
            data.toString('utf8').split(/\r?\n/).forEach(function (item) {
                read(item);
            });
        });

        device.connect(nconf.get('tivo:port'), nconf.get('tivo:address'), function () {
            logger('Connected to tivo at ' + nconf.get('tivo:address') + ':' + nconf.get('tivo:port'));
        });
    }

    this.command = function (cmd) {
        if (locked) { return; }
        write(cmd);
    }

    this.watchnetflix = function () {
        tivo.command("TELEPORT TIVO\r");
        setTimeout(keyboardkey.bind(null, "DOWN"), 1000);
        setTimeout(keyboardkey.bind(null, "DOWN"), 1250);
        setTimeout(keyboardkey.bind(null, "DOWN"), 1500);
        setTimeout(keyboardkey.bind(null, "RIGHT"), 2000);
        setTimeout(keyboardkey.bind(null, "DOWN"), 2250);
        setTimeout(keyboardkey.bind(null, "DOWN"), 2500);
        setTimeout(keyboardkey.bind(null, "DOWN"), 2750);
        setTimeout(keyboardkey.bind(null, "SELECT"), 3250);
    }

    this.watchfootball = function () {
        tivo.command("TELEPORT LIVETV\r");
        setTimeout(changeChannel.bind(null, "1038"), 250);
    }

    this.search = function (cmd) {
        tivo.command("TELEPORT TIVO\r");
        setTimeout(keyboardkey.bind(null, "DOWN"), 1000);
        setTimeout(keyboardkey.bind(null, "DOWN"), 1500);
        setTimeout(keyboardkey.bind(null, "DOWN"), 2000);
        setTimeout(keyboardkey.bind(null, "RIGHT"), 2500);
        setTimeout(keyboardkey.bind(null, "SELECT"), 3000);

        for (var i = 0; i < cmd.toString().length - 1; i++) {
            if (cmd.slice(i, i + 1) == " ") {
                logger("sending '" + cmd.slice(i, i + 1).toUpperCase() + "'");
                setTimeout(keyboardkey.bind(null, "SPACE"), 3000 + 50 * i);
            }
            else {
                setTimeout(keyboardkey.bind(null, cmd.slice(i, i + 1).toUpperCase()), 3000 + 50 * i);
            }
        }
    }

    function changeChannel(number) {
        if (tvready) {
            logger("TV is ready, sending the channel number");
            tivo.command("IRCODE NUM1\r");
            tivo.command("IRCODE NUM0\r");
            tivo.command("IRCODE NUM3\r");
            tivo.command("IRCODE NUM8\r");
            tvready = false;
        }
        else {
            logger("TV is not ready, waiting another 250ms");
            setTimeout(changeChannel.bind(null, number), 250);
        }
    }

    /**
    * read
    */
    function read(data) {
        if (data.length == 0) { return; }
        logger("RX < " + data);
        if (data.indexOf("LIVETV_READY") > -1) {
            // We are waiting for the live tv ready signal before sending channel number
            tvready = true;
        }
    }

    /**
     * Writing to device
     * @param cmd
     */
    function write(cmd) {
        if (!device || !device.writable) {
            logger('Tivo not connected.');
            return;
        }

        if (!cmd || cmd.length == 0) { return; }
        //logger('TX > '+cmd);
        device.write(cmd + '\n');
    }

}