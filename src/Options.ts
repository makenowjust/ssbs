import { injectable } from "inversify";

export interface IOptions {
  readonly host: string;
  readonly port: number;
  readonly dir: string;
  readonly delay: number;
  readonly open: boolean;
}

@injectable()
export class Options implements IOptions {
  public readonly host: string;
  public readonly port: number;
  public readonly delay: number;
  public readonly dir: string;
  public readonly open: boolean;

  constructor(opts: IOptions) {
    this.host = opts.host;
    this.port = opts.port;
    this.delay = opts.delay;
    this.dir = opts.dir;
    this.open = opts.open;
  }
}
