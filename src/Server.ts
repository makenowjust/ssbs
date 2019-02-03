import path from "path";

import chalk from "chalk";
import * as express from "express";
import fs from "fs-extra";
import { injectable, inject } from "inversify";
import { JSDOM } from "jsdom";
import Koa from "koa";
import logger from "koa-logger";
import onFinished from "on-finished";
import opn from "opn";
import route from "koa-route";
import send from "koa-send";
import serveIndex from "serve-index";

import { Logger, LoggerFactory } from "./Logger";
import { Options } from "./Options";
import { Watcher } from "./Watcher";

const INJECT_SCRIPT = (delay: number) => `
// This \`<script>\` element is injected by ssbs.
(() => {
  const watch = new EventSource('/_ssbs/watch');

  watch.onopen = () => {
    console.log('[ssbs] connect watch stream');
  };

  watch.onerror = () => {
    console.log('[ssbs] failed on watch stream connection');
  };

  let timerID = null;
  watch.onmessage = event => {
    const data = JSON.parse(event.data);
    console.log('[ssbs] file ' + data.event + '  detected: ' + event.filename);

    if (timerID !== null) {
      clearTimeout(timerID);
    }
    timerID = setTimeout(() => {
      console.log('[ssbs] reload');
      location.reload(true);
    }, ${delay});
  };
})();
`;

@injectable()
export class Server {
  public logger: Logger;
  public opts: Options;
  public watcher: Watcher;

  public readonly app: Koa;
  public readonly index: express.Handler;

  constructor(loggerFactory: LoggerFactory, opts: Options, watcher: Watcher) {
    this.opts = opts;
    this.logger = loggerFactory.create("server");
    this.watcher = watcher;

    this.app = new Koa();
    this.index = serveIndex(this.opts.dir);
    this.setup();
  }

  public async start(): Promise<void> {
    await new Promise(resolve =>
      this.app.listen(this.opts.port, this.opts.host, resolve)
    );

    const url = `http://${this.opts.host}:${this.opts.port}/`;
    this.logger.info(`listen at ${chalk.underline(url)}`);
    if (this.opts.open) {
      await opn(url);
    }
  }

  // Set up `this.app`.
  private setup(): void {
    this.app.use(logger());
    this.app.use(route.get("/_ssbs/watch", this.handleWatch));
    this.app.use(this.handlePath);
  }

  private readonly handleWatch = async (ctx: Koa.Context): Promise<void> => {
    ctx.respond = false;
    ctx.res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    ctx.res.write(":ok\n\n");

    const observable = this.watcher.watch();
    const subscription = observable.subscribe({
      next({ id, ...data }) {
        ctx.res.write(`id: ${id}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });

    onFinished(ctx.res, () => {
      subscription.unsubscribe();
    });
  };

  private readonly handlePath = async (
    ctx: Koa.Context,
    next: () => Promise<void>
  ): Promise<void> => {
    if (ctx.method !== "GET" && ctx.method !== "HEAD") {
      return next();
    }

    const filepath = path.join(this.opts.dir, ctx.path);
    const stat = await fs.stat(filepath);

    if (stat.isDirectory()) {
      return this.handleDirectory(ctx, filepath);
    } else if (stat.isFile()) {
      return this.handleFile(ctx, filepath);
    }

    return next();
  };

  private async handleDirectory(
    ctx: Koa.Context,
    filepath: string
  ): Promise<void> {
    if (!ctx.path.endsWith("/")) {
      ctx.redirect(`${ctx.path}/`);
      return;
    }

    const indexFilepath = path.join(filepath, "index.html");

    try {
      const stat = await fs.stat(indexFilepath);
      if (stat.isFile()) {
        return this.handleHTML(ctx, indexFilepath);
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    await new Promise((_resolve, reject) => {
      ctx.status = 200;
      this.index(ctx.req as any, ctx.res as any, reject);
    });
  }

  private async handleFile(ctx: Koa.Context, filepath: string): Promise<void> {
    const ext = path.extname(filepath);
    if (ext === ".html") {
      return this.handleHTML(ctx, filepath);
    }

    await send(ctx, ctx.path, { root: this.opts.dir });
  }

  private async handleHTML(ctx: Koa.Context, filepath: string): Promise<void> {
    const dom = new JSDOM(await fs.readFile(filepath, "utf8"));
    const document = dom.window.document;
    const script = document.createElement("script");
    script.textContent = INJECT_SCRIPT(this.opts.delay);
    document.head.appendChild(script);

    ctx.status = 200;
    ctx.body = dom.serialize();

    this.logger.info(
      `detect HTML file '${chalk.underline(
        path.relative(process.cwd(), filepath)
      )}'`
    );
  }
}
