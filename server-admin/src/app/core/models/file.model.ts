export interface FileImage {
  src: string;
  width?: number;
  height?: number;
}

export interface FileRecord {
  id?: number;
  name: string;
  path: string;
  size: number;
  mtime: number;
  parsedName?: string | null;
  type?: string | null;
  imdb_id?: string | null;
  season?: number | null;
  episode?: number | null;
  resolution?: string | null;
  source?: string | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  audioChannels?: string | null;
  languages?: string | string[] | null;
  releaseGroup?: string | null;
  flags?: string | string[] | null;
  edition?: string | null;
  imdbName?: string | null;
  imdbYear?: number | null;
  imdbType?: string | null;
  yearRange?: string | null;
  image?: string | FileImage | null;
  starring?: string | null;
  similarity?: number | null;
  watch_folder_id?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
