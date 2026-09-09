import Module from "node:module";
import tls from "node:tls";
import net from "node:net";
import { Readable, Writable } from "node:stream";

export function createCfSocketsShim() {
  return {
    connect({ hostname, port }, options = {}) {
      const isSecure = options.secureTransport === "on";
      let socket;
      let openedResolve, openedReject;
      const opened = new Promise((res, rej) => {
        openedResolve = res;
        openedReject = rej;
      });

      if (isSecure) {
        socket = tls.connect({ host: hostname, port, servername: hostname }, () => {
          openedResolve();
        });
      } else {
        socket = net.connect({ host: hostname, port }, () => {
          openedResolve();
        });
      }

      socket.on("error", (err) => {
        openedReject(err);
      });

      const readable = Readable.toWeb(socket);
      const writable = Writable.toWeb(socket);

      return {
        opened,
        readable,
        writable,
        async close() {
          socket.destroy();
        },
        startTls() {
          const tlsSocket = tls.connect({
            socket,
            host: hostname,
            servername: hostname,
          });
          return {
            opened: Promise.resolve(),
            readable: Readable.toWeb(tlsSocket),
            writable: Writable.toWeb(tlsSocket),
            async close() {
              tlsSocket.destroy();
            },
          };
        },
      };
    },
  };
}

const originalRequire = Module.prototype.require;
const shim = createCfSocketsShim();

Module.prototype.require = function (id) {
  if (id === "cloudflare:sockets") {
    return shim;
  }
  return originalRequire.apply(this, arguments);
};
