declare module 'name-to-imdb' {
  interface NameToImdbOptions {
    name: string;
    year?: number;
    type?: string;
  }

  interface ImdbInfo {
    match?: string;
    meta?: {
      name?: string;
      year?: number;
      type?: string;
      yearRange?: string;
      image?: object;
      starring?: string;
      similarity?: number;
    };
  }

  type NameToImdbCallback = (
    err: Error | null,
    imdbId: string | null,
    inf?: ImdbInfo
  ) => void;

  function nameToImdb(
    options: NameToImdbOptions,
    callback: NameToImdbCallback
  ): void;

  export default nameToImdb;
}
