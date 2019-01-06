import { Container, interfaces } from "inversify";

import { LoggerCreator } from "./Logger";
import { IOptions, Options } from "./Options";
import { Server } from "./Server";
import { Watcher } from "./Watcher";

export const bootstrap = async <T extends { start(): Promise<void> }>(
  opts: IOptions,
  constructor: interfaces.Newable<T>
): Promise<void> => {
  const container = new Container();
  container.bind<LoggerCreator>(LoggerCreator).to(LoggerCreator);
  container.bind<Options>(Options).toConstantValue(new Options(opts));
  container.bind<Server>(Server).to(Server);
  container
    .bind<Watcher>(Watcher)
    .to(Watcher)
    .inSingletonScope();

  const app = container.resolve(constructor);
  await app.start();
};
