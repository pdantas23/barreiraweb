import { describe, it, expect, vi } from "vitest";
import {
  createFriendService,
  createInMemoryFriendStore,
  type FriendStore,
} from "./friendships.js";

// --- Harness ---------------------------------------------------------------

type OnlineMap = Record<string, boolean>;

const makeRegistry = (online: OnlineMap) => ({
  isOnline: (u: string) => !!online[u],
  socketsOf: (u: string) => (online[u] ? [`s-${u}`] : []),
});

const setup = (opts: {
  usernames: string[];
  online?: OnlineMap;
  inGame?: string[];
  room?: { code: string; password: string | null } | null;
}) => {
  const store = createInMemoryFriendStore(opts.usernames);
  const emit = vi.fn();
  const inGameSet = new Set(opts.inGame ?? []);
  const sendInvitePush = vi.fn();
  const createInviteRoom = vi.fn(() =>
    opts.room === undefined ? { code: "ABC123", password: "pw" } : opts.room,
  );
  const service = createFriendService({
    store,
    registry: makeRegistry(opts.online ?? {}),
    emitToUser: emit,
    isInGame: (u) => inGameSet.has(u),
    createInviteRoom,
    sendInvitePush,
  });
  return { store, emit, service, createInviteRoom, sendInvitePush };
};

// Atalhos pra semear amizades no store em memória.
const seedAccepted = async (store: FriendStore, a: string, b: string) => {
  await store.upsertRequest(a, b);
  await store.setStatus(a, b, "accepted");
};
const seedPending = async (store: FriendStore, requester: string, receiver: string) => {
  await store.upsertRequest(requester, receiver);
};

// --- sendFriendRequest -----------------------------------------------------

describe("sendFriendRequest", () => {
  it("envia pedido e notifica o alvo online", async () => {
    const { store, emit, service } = setup({ usernames: ["alice", "bob"], online: { bob: true } });
    await service.sendFriendRequest("alice", "bob");
    expect(await store.getDirected("alice", "bob")).toMatchObject({ status: "pending" });
    expect(emit).toHaveBeenCalledWith("bob", "friendRequestReceived", { fromUsername: "alice" });
  });

  it("erro se já são amigos", async () => {
    const { store, service } = setup({ usernames: ["alice", "bob"] });
    await seedAccepted(store, "alice", "bob");
    await expect(service.sendFriendRequest("alice", "bob")).rejects.toMatchObject({
      code: "already-friends",
    });
  });

  it("erro se já existe pedido pendente", async () => {
    const { store, service } = setup({ usernames: ["alice", "bob"] });
    await seedPending(store, "alice", "bob");
    await expect(service.sendFriendRequest("alice", "bob")).rejects.toMatchObject({
      code: "request-pending",
    });
  });

  it("erro ao se adicionar (self)", async () => {
    const { service } = setup({ usernames: ["alice"] });
    await expect(service.sendFriendRequest("alice", "alice")).rejects.toMatchObject({
      code: "self-friend",
    });
  });

  it("erro se username não existe", async () => {
    const { service } = setup({ usernames: ["alice"] });
    await expect(service.sendFriendRequest("alice", "ghost")).rejects.toMatchObject({
      code: "friend-not-found",
    });
  });
});

// --- accept / decline ------------------------------------------------------

describe("acceptFriendRequest / declineFriendRequest", () => {
  it("aceitar marca accepted e notifica quem pediu", async () => {
    const { store, emit, service } = setup({ usernames: ["alice", "bob"], online: { alice: true } });
    await seedPending(store, "alice", "bob"); // alice pediu pra bob
    await service.acceptFriendRequest("bob", "alice");
    expect(await store.getDirected("alice", "bob")).toMatchObject({ status: "accepted" });
    expect(emit).toHaveBeenCalledWith("alice", "friendStatusChanged", expect.objectContaining({ username: "bob" }));
  });

  it("recusar marca declined", async () => {
    const { store, service } = setup({ usernames: ["alice", "bob"] });
    await seedPending(store, "alice", "bob");
    await service.declineFriendRequest("bob", "alice");
    expect(await store.getDirected("alice", "bob")).toMatchObject({ status: "declined" });
  });

  it("erro ao aceitar sem pedido pendente", async () => {
    const { service } = setup({ usernames: ["alice", "bob"] });
    await expect(service.acceptFriendRequest("bob", "alice")).rejects.toMatchObject({
      code: "no-friend-request",
    });
  });
});

// --- removeFriend ----------------------------------------------------------

describe("removeFriend", () => {
  it("remove a amizade dos dois lados", async () => {
    const { store, service } = setup({ usernames: ["alice", "bob"] });
    await seedAccepted(store, "alice", "bob");
    await service.removeFriend("alice", "bob");
    expect(await store.listAccepted("alice")).toEqual([]);
    expect(await store.listAccepted("bob")).toEqual([]);
  });
});

// --- getFriends ------------------------------------------------------------

describe("getFriends", () => {
  it("retorna amigos com status + pedidos pendentes nos dois sentidos", async () => {
    const { store, service } = setup({
      usernames: ["alice", "bob", "carol", "dave", "erin"],
      online: { bob: true, carol: false },
      inGame: ["bob"],
    });
    await seedAccepted(store, "alice", "bob"); // bob online + in-game
    await seedAccepted(store, "alice", "carol"); // carol offline
    await seedPending(store, "dave", "alice"); // incoming
    await seedPending(store, "alice", "erin"); // outgoing

    const data = await service.getFriends("alice");
    const byName = Object.fromEntries(data.friends.map((f) => [f.username, f.status]));
    expect(byName).toEqual({ bob: "in-game", carol: "offline" });
    expect(data.incomingRequests).toEqual(["dave"]);
    expect(data.outgoingRequests).toEqual(["erin"]);
  });
});

// --- sendGameInvite --------------------------------------------------------

describe("sendGameInvite", () => {
  it("envia convite pro amigo online e livre", async () => {
    const { store, emit, service } = setup({ usernames: ["alice", "bob"], online: { bob: true } });
    await seedAccepted(store, "alice", "bob");
    await service.sendGameInvite("alice", "bob");
    expect(emit).toHaveBeenCalledWith(
      "bob",
      "gameInviteReceived",
      expect.objectContaining({ fromUsername: "alice" }),
    );
  });

  it("erro se amigo offline (e dispara push best-effort)", async () => {
    const { store, service, sendInvitePush } = setup({ usernames: ["alice", "bob"], online: { bob: false } });
    await seedAccepted(store, "alice", "bob");
    await expect(service.sendGameInvite("alice", "bob")).rejects.toMatchObject({ code: "friend-offline" });
    expect(sendInvitePush).toHaveBeenCalledWith("bob", "alice");
  });

  it("erro se amigo em partida", async () => {
    const { store, service } = setup({ usernames: ["alice", "bob"], online: { bob: true }, inGame: ["bob"] });
    await seedAccepted(store, "alice", "bob");
    await expect(service.sendGameInvite("alice", "bob")).rejects.toMatchObject({ code: "friend-in-game" });
  });

  it("erro se não são amigos", async () => {
    const { service } = setup({ usernames: ["alice", "bob"], online: { bob: true } });
    await expect(service.sendGameInvite("alice", "bob")).rejects.toMatchObject({ code: "not-friends" });
  });

  it("anti-spam: 2 convites passam, o 3º na janela é bloqueado", async () => {
    const { store, service } = setup({ usernames: ["alice", "bob"], online: { bob: true } });
    await seedAccepted(store, "alice", "bob");
    await service.sendGameInvite("alice", "bob"); // 1
    await service.sendGameInvite("alice", "bob"); // 2
    await expect(service.sendGameInvite("alice", "bob")).rejects.toMatchObject({ code: "invite-cooldown" }); // 3
  });
});

// --- respondGameInvite -----------------------------------------------------

describe("respondGameInvite", () => {
  it("aceitar cria sala e notifica ambos", async () => {
    const { store, emit, service, createInviteRoom } = setup({
      usernames: ["alice", "bob"],
      online: { alice: true, bob: true },
    });
    await seedAccepted(store, "alice", "bob");
    await service.sendGameInvite("alice", "bob");
    const res = await service.respondGameInvite("bob", "alice", true);
    expect(createInviteRoom).toHaveBeenCalledWith("alice", "bob");
    expect(res).toMatchObject({ code: "ABC123", password: "pw" }); // convidado recebe a sala
    expect(emit).toHaveBeenCalledWith(
      "alice",
      "gameInviteResponse",
      expect.objectContaining({ fromUsername: "bob", accept: true, code: "ABC123" }),
    ); // convidante notificado
  });

  it("recusar notifica quem enviou", async () => {
    const { store, emit, service } = setup({
      usernames: ["alice", "bob"],
      online: { alice: true, bob: true },
    });
    await seedAccepted(store, "alice", "bob");
    await service.sendGameInvite("alice", "bob");
    const res = await service.respondGameInvite("bob", "alice", false);
    expect(res).toBeNull();
    expect(emit).toHaveBeenCalledWith("alice", "gameInviteResponse", {
      fromUsername: "bob",
      accept: false,
    });
  });

  it("erro se não há convite pendente", async () => {
    const { service } = setup({ usernames: ["alice", "bob"], online: { alice: true, bob: true } });
    await expect(service.respondGameInvite("bob", "alice", true)).rejects.toMatchObject({
      code: "no-invite-pending",
    });
  });
});

// --- friendStatusChanged (presença) ---------------------------------------

describe("friendStatusChanged", () => {
  it("notifica amigos online ao conectar/desconectar", async () => {
    const { store, emit, service } = setup({
      usernames: ["alice", "bob", "carol"],
      online: { bob: true, carol: false },
    });
    await seedAccepted(store, "alice", "bob");
    await seedAccepted(store, "alice", "carol");

    await service.notifyFriendsOfStatus("alice", "online"); // conectou
    expect(emit).toHaveBeenCalledWith("bob", "friendStatusChanged", { username: "alice", status: "online" });
    // carol está offline → não recebe.
    expect(emit).not.toHaveBeenCalledWith("carol", "friendStatusChanged", expect.anything());

    emit.mockClear();
    await service.notifyFriendsOfStatus("alice", "offline"); // desconectou
    expect(emit).toHaveBeenCalledWith("bob", "friendStatusChanged", { username: "alice", status: "offline" });
  });
});
