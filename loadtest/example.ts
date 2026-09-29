import { Client, Room } from "@colyseus/sdk";
import { cli, Options } from "@colyseus/loadtest";

export async function main(options: Options) {
  const client = new Client(options.endpoint);
  // QuizRoom needs a nickname, unique within the room.
  const room: Room = await client.joinOrCreate(options.roomName, {
    name: `Bot ${Math.floor(Math.random() * 10000)}`,
  });

  console.log("joined successfully!");

  room.onMessage("message-type", (payload: any) => {
    // logic
  });

  room.onStateChange((state: any) => {
    console.log("state change:", state);
  });

  room.onLeave((code: number) => {
    console.log("left");
  });
}

cli(main);
