import { injectable, inject } from "inversify";

import { Logger, LoggerFactory } from "./Logger";
import { Options } from "./Options";
import { Watcher } from "./Watcher";
import { Server } from "./Server";

// Create a new `Promise` which doesn't resolve forever.
const forever = () => new Promise(() => undefined);

@injectable()
export class Application {
  public logger: Logger;
  public opts: Options;
  public server: Server;
  public watcher: Watcher;

  constructor(
    loggerFactory: LoggerFactory,
    opts: Options,
    server: Server,
    watcher: Watcher
  ) {
    this.opts = opts;
    this.logger = loggerFactory.create("server");
    this.server = server;
    this.watcher = watcher;
  }

  public async start(): Promise<void> {
    await this.watcher.start();
    await this.server.start();

    await forever();
  }
}
