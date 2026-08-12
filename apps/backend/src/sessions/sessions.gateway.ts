import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { SessionsService } from "./sessions.service";
import { SessionTickEvent } from "./adapters/mock-charger-adapter";
import { SessionEndedEvent } from "./session-ended.event";
import { ExtensionRequestEvent } from "../extension-requests/extension-request.event";

interface JwtPayload {
  sub: number;
  email: string;
}

// Same reasoning as the REST API's CORS stance (main.ts): browser-only
// restriction, bearer-token auth (not cookies), no session-hijack angle.
@WebSocketGateway({ cors: { origin: "*" } })
export class SessionsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.emit("error", { message: "Missing auth token" });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
    } catch {
      client.emit("error", { message: "Invalid or expired token" });
      client.disconnect(true);
    }
  }

  /**
   * A subscriber must be either the driver on the booking or the owner of
   * the charger — this is the only place that's checked, and it's
   * deliberately re-checked on every subscribe call (not cached), so
   * there's no open channel anyone with a session id could listen to.
   */
  @SubscribeMessage("subscribe")
  async handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: number }) {
    const userId = client.data.userId as number | undefined;
    if (!userId) {
      client.emit("error", { message: "Not authenticated" });
      return;
    }

    const auth = await this.sessionsService.findSessionForAuth(data.sessionId);
    if (!auth || (auth.driverId !== userId && auth.ownerId !== userId)) {
      client.emit("error", { message: "Not authorized for this session" });
      return;
    }

    client.join(`session:${data.sessionId}`);
    client.emit("subscribed", { sessionId: data.sessionId });
  }

  @OnEvent("session.tick")
  handleTick(payload: SessionTickEvent) {
    this.server.to(`session:${payload.sessionId}`).emit("tick", payload);
  }

  /**
   * Same room every subscriber already joined for ticks — driver and host
   * connections both receive this in the same broadcast, at the same
   * moment, not from two separate calls.
   */
  @OnEvent("session.ended")
  handleEnded(payload: SessionEndedEvent) {
    this.server.to(`session:${payload.sessionId}`).emit("session:ended", payload);
  }

  // Extension requests reuse this same room rather than a new channel —
  // driver and host both get all three events from one broadcast, same as
  // tick/session:ended above.
  @OnEvent("extension.requested")
  handleExtensionRequested(payload: ExtensionRequestEvent) {
    this.server.to(`session:${payload.sessionId}`).emit("extension:requested", payload);
  }

  @OnEvent("extension.approved")
  handleExtensionApproved(payload: ExtensionRequestEvent) {
    this.server.to(`session:${payload.sessionId}`).emit("extension:approved", payload);
  }

  @OnEvent("extension.declined")
  handleExtensionDeclined(payload: ExtensionRequestEvent) {
    this.server.to(`session:${payload.sessionId}`).emit("extension:declined", payload);
  }
}
