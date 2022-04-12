import { Server } from "http";
import { RequestAdapter } from "./request-adapter";
import { RequestMeta } from "./request-meta";
import { ResponseMeta } from "./response-meta";

import { ServerConfig } from "./server-config";

export type RequestHandler<DataAdapter = unknown> = (
  adapter: RequestAdapter<DataAdapter>
) => Promise<RequestAdapter<DataAdapter>>;

export type ServerCommandHandlers<DataAdapter = unknown> = {
  install?: RequestHandler<DataAdapter>;
  publish?: RequestHandler<DataAdapter>;
  view?: RequestHandler<DataAdapter>;
  adduser?: RequestHandler<DataAdapter>;
  logout?: RequestHandler<DataAdapter>;
  whoami?: RequestHandler<DataAdapter>;
};

export type Command = keyof ServerCommandHandlers;

export type ApiVersion = string;

export type ApiPath = string;

export type ServerApiHandlers<DataAdapter = unknown> = Record<
  ApiVersion,
  Record<ApiPath, RequestHandler<DataAdapter>>
>;

export class NpmServer<DataAdapter = unknown> {
  public server: Server;
  public config: ServerConfig = new ServerConfig();
  public data: DataAdapter;
  public commandHandlers: ServerCommandHandlers<DataAdapter> = {};
  public apiHandlers: ServerApiHandlers<DataAdapter> = {};

  constructor(
    server: Server,
    data: DataAdapter,
    options?: {
      config?: ServerConfig;
      commandHandlers?: ServerCommandHandlers<DataAdapter>;
      apiHandlers?: ServerApiHandlers<DataAdapter>;
    }
  ) {
    this.server = server;
    this.data = data;
    this.config = options?.config ?? this.config;
    this.commandHandlers = options?.commandHandlers ?? this.commandHandlers;
    this.apiHandlers = options?.apiHandlers ?? this.apiHandlers;

    this.server.addListener("request", async (request, response) => {
      const req: RequestMeta = new RequestMeta(request);
      const res: ResponseMeta = new ResponseMeta(response);
      const adapter: RequestAdapter<DataAdapter> = new RequestAdapter({
        req,
        res,
        config: this.config,
        data: this.data,
      });

      if (req.command) return await this.handleCommand(adapter);
      else if (req.api) return await this.handleApi(adapter);

      return await res.sendBadRequest();
    });
  }

  private async handleCommand(
    adapter: RequestAdapter<DataAdapter>
  ): Promise<RequestAdapter<DataAdapter>> {
    const handler = this.commandHandlers[adapter.req.command as Command];

    if (handler) {
      return await handler(adapter);
    }

    await adapter.res.sendBadRequest();
    return adapter;
  }

  private async handleApi(
    adapter: RequestAdapter<DataAdapter>
  ): Promise<RequestAdapter<DataAdapter>> {
    const apiVersionHandlers = this.apiHandlers[adapter.req.api?.version ?? ""];
    const apiPathHandler = apiVersionHandlers[adapter.req.api?.path ?? ""];

    if (apiPathHandler) {
      return await apiPathHandler(adapter);
    }

    await adapter.res.sendBadRequest();
    return adapter;
  }

  static createHandler<DataAdapter = unknown>(
    handler: RequestHandler<DataAdapter>
  ): RequestHandler<DataAdapter> {
    return async (adapter) => {
      if (adapter.res.isResponse) {
        return adapter;
      }

      return await handler(adapter);
    };
  }
}
