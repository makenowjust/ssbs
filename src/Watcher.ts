import path from "path";

import chokidar from "chokidar";
import chalk from "chalk";
import { injectable } from "inversify";
import { Observable } from "rxjs";

import { Options } from "./Options";
import { Logger, LoggerFactory } from "./Logger";

export interface FileUpdate {
  id: number;
  event: string;
  filepath: string;
}

@injectable()
export class Watcher {
  public readonly logger: Logger;
  public readonly opts: Options;

  public readonly watcher!: chokidar.FSWatcher;

  constructor(loggerFactory: LoggerFactory, opts: Options) {
    this.logger = loggerFactory.create("watcher");
    this.opts = opts;
  }

  public async start(): Promise<void> {
    (this as any).watcher = chokidar.watch(this.opts.dir);
    await new Promise((resolve, reject) => {
      this.watcher.once("ready", resolve);
      this.watcher.once("error", reject);
    });

    const dir = path.relative(process.cwd(), this.opts.dir) || ".";
    this.logger.info(`watch directory ${chalk.underline(dir)}`);
  }

  public watch(): Observable<FileUpdate> {
    return new Observable<FileUpdate>(observer => {
      let id = 0;
      const handler = (event: string, filepath: string) => {
        observer.next({ id, event, filepath });
        id += 1;
      };

      this.watcher.on("all", handler);
      return () => this.watcher.off("all", handler);
    });
  }
}
