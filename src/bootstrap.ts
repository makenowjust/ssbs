import { Container, interfaces } from "inversify";

import { LoggerFactory } from "./Logger";
import { IOptions, Options } from "./Options";
import { Server } from "./Server";
import { Watcher } from "./Watcher";

export const bootstrap = async <T extends { start(): Promise<void> }>(
  opts: IOptions,
  constructor: interfaces.Newable<T>
): Promise<void> => {
  const container = new Container({ defaultScope: "Singleton" });
  container.bind<LoggerFactory>(LoggerFactory).toSelf();
  container.bind<Options>(Options).toConstantValue(new Options(opts));
  container.bind<Server>(Server).toSelf();
  container.bind<Watcher>(Watcher).toSelf();

  const app = container.resolve(constructor);
  await app.start();
};
