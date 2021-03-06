import { createSocket } from 'dgram';
import { WSSManager } from './WSSManager';
const debug = require("debug")("mter");
// 远程默认的端口是从4600开始累加的
const DEFAULT_BIND_UDP_PORT = 4600;
/// 1. 解析命令行参数
const optimist = require("optimist")
    .usage('Usage: $0 -s [string] -c [num]')
    .default('m', '225.1.2.7')
    .default('s', '0.0.0.0')
    .default('c', 1000)
    .default('b', false)
    .default('u', 4511)
    .default('r', DEFAULT_BIND_UDP_PORT - 1)
    .default('w', 4510)
    .alias('m', 'membership')
    .alias('s', 'server-ip')
    .alias('h', 'help')
    .alias('c', 'cache-logs-line')
    .alias('b', 'background')
    .alias('u', 'udp-port')
    .alias('r', 'remote-udp-port')
    .alias('w', 'web-port')
    .describe('s', 'join a multicast group')
    .describe('s', 'remote server ip address')
    .describe('c', 'number of cached log lines')
    .describe('b', 'just run in background. and no open browser.')
    .describe('h', 'help info')
    .describe('u', 'current process binding udp port')
    .describe('r', 'remote processes heartbeat udp port')
    .describe('w', 'current process binding http-web port')
const argv = optimist.argv;
if (argv.h) {
    optimist.showHelp();
    process.exit(0);
}

const MTER_MEMBERSHIP = argv.m;
const SENDER_IP = argv.s;
const CACHE_LOGS_LINE = argv.c;
const WEB_PORT = argv.w
const SERVER_LISTEN_UDP_PORT = argv.r;
const RECIPIENT_PORT = argv.u;

/// 2. 启动http服务，提供wss的监听，提供public的文件服务，提供wss-api服务
const ws_server_manager = new WSSManager({ cache_logs_line: CACHE_LOGS_LINE, port: WEB_PORT });

/// 3. 启动udp服务，并进行广播，获取主程序的配置响应
const socket = createSocket("udp4");
socket.on("message", (msg, rinfo) => {
    // debug("get msg", msg.toString(), rinfo);
    if (rinfo.port === SERVER_LISTEN_UDP_PORT) {
        const msg_str = msg.toString();
        if (msg_str.startsWith("PONG:")) {
            const [bind_udp_port, process_name] = msg_str.substr(5).split(":");
            ws_server_manager.heartbeat(bind_udp_port, process_name);
        }
        return;
    }
    if (ws_server_manager.has(rinfo.port.toString())
        && (SENDER_IP === "0.0.0.0" || rinfo.address === SENDER_IP)) {
        // xtrem中，必须使用\r\n的EOL
        const str_msg = msg.toString().replace(/\n/g, '\r\n');
        ws_server_manager.sendMsg(rinfo.port.toString(), str_msg);
    }
});
socket.bind(RECIPIENT_PORT);
socket.on("listening", () => {
    const socket_address = socket.address();
    debug("udp listen in %o", socket_address, "membership:", MTER_MEMBERSHIP);
    socket.addMembership(MTER_MEMBERSHIP);
    socket.send("PING", SERVER_LISTEN_UDP_PORT, "");
});


if (!argv.b) {
    const opn = require("opn");
    const web_url = `http://127.0.0.1:${WEB_PORT}/`;
    opn(web_url);
    debug("OPEND %s", web_url)
}