# mter

## usage

```
npm i -g mter
```

usually you can run just like:
```
mter
```

for more information, you can run with `--help` flag.
```
mter --help
# you will see:
Options:
  -s, --server-ip        remote server ip address                      [default: "0.0.0.0"]
  -c, --cache-logs-line  number of cached log lines                    [default: 1000]
  -b, --background       just run in background. and no open browser.  [default: false]
  -h, --help             help info
  -u, --udp-port         current process binding udp port              [default: 4511]
  -r, --remote-udp-port  remote processes heartbeat udp port           [default: 4599]
  -w, --web-port         current process binding http-web port         [default: 4510]
```

and in remote server (your applaction). you can use [mter-rs](https://www.npmjs.com/package/mter-rs) to capture the logs.