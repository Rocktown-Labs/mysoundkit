import { DurableObject } from "cloudflare:workers";

const VERSION_KEY = "version";

interface BattleDirectorySocketMessage {
  battleId: string;
  type: "battle_directory_changed";
  version: number;
}

export class BattleDirectoryDurableObject extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }
    if (request.method === "GET" && url.pathname === "/version") {
      return Response.json({ version: await this.version() });
    }
    if (request.method === "POST" && url.pathname === "/publish") {
      const body = (await request.json().catch(() => null)) as {
        battleId?: string;
      } | null;
      if (!body?.battleId) {
        return Response.json(
          { message: "Battle id is required." },
          { status: 400 }
        );
      }
      return Response.json({ version: await this.publish(body.battleId) });
    }
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  async publish(battleId: string): Promise<number> {
    const nextVersion = (await this.version()) + 1;
    await this.ctx.storage.put(VERSION_KEY, nextVersion);
    const message: BattleDirectorySocketMessage = {
      battleId,
      type: "battle_directory_changed",
      version: nextVersion,
    };
    const encoded = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(encoded);
      } catch {
        socket.close(1011, "Unable to deliver battle directory update.");
      }
    }
    return nextVersion;
  }

  private async version(): Promise<number> {
    return (await this.ctx.storage.get<number>(VERSION_KEY)) ?? 0;
  }

  private handleWebSocket(request: Request): Response {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return Response.json(
        { message: "Expected WebSocket upgrade." },
        { status: 426 }
      );
    }

    const pair = new WebSocketPair(),
      [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, ["public-battle-directory"]);
    this.ctx.waitUntil(
      this.version().then((version) => {
        server.send(
          JSON.stringify({
            battleId: "",
            type: "battle_directory_changed",
            version,
          } satisfies BattleDirectorySocketMessage)
        );
      })
    );
    return new Response(null, { status: 101, webSocket: client });
  }
}
