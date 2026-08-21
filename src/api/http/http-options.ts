export interface HttpTransport {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export interface HttpApiOptions {
  transport: HttpTransport;
  basePath?: string;
}
