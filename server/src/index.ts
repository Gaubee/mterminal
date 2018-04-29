import { createSocket } from 'dgram';
import { WSSManager } from './WSSManager';
const RECIPIENT_PORT = 4511;
const DEFAULT_BIND_UDP_PORT = 4600;
const SERVER_LISTEN_UDP_PORT = DEFAULT_BIND_UDP_PORT - 1;
/// 1. 解析命令行参数
const sip_arg = process.argv.find(arg => arg.startsWith("-sip=")) || "-sip=0.0.0.0";//0.0.0.0代表着处理全部收到的
const cache_arg = process.argv.find(arg => arg.startsWith("-cache=")) || "";
if (!sip_arg) {
    console.warn("input the -sip=192.168.*.*");
    // process.exit(1);
}
const SENDER_IP = sip_arg.substr(5).trim();
const CACHE_LOGS_LINE = parseInt(sip_arg.substr(7).trim()) || 1000;

/// 2. 启动http服务，提供wss的监听，提供public的文件服务，提供wss-api服务
const ws_server_manager = new WSSManager({ cache_logs_line: CACHE_LOGS_LINE });

/// 3. 启动udp服务，并进行广播，获取主程序的配置响应
const socket = createSocket("udp4");
socket.on("message", (msg, rinfo) => {
    if (msg.length === 4)
        console.log("get msg", msg.toString(), rinfo);
    if (rinfo.port === SERVER_LISTEN_UDP_PORT) {
        const msg_str = msg.toString();
        if (msg_str.startsWith("PONG:")) {
            const [bind_udp_port, process_name] = msg_str.substr(5).split(":");
            ws_server_manager.heartbeat(bind_udp_port, process_name);
        }/*  else if (msg_str.startsWith("BONG:")) {
            const bind_udp_port = msg_str.substr(5);
            ws_server_manager.remove(bind_udp_port);
        } */
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
    console.log("udp listen in ", socket_address);
    socket.setBroadcast(true);
    socket.send("PING", SERVER_LISTEN_UDP_PORT, "");
});
