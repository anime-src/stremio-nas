import nameToImdb from 'name-to-imdb';
import { filenameParse } from '@ctrl/video-filename-parser';
import config from '../config';
import logger from '../config/logger';
import cache from './cache.service';

// oleoo is an ES module, need to use dynamic import
let oleoo: any = null;
(async () => {
  try {
    oleoo = (await import('oleoo')).default;
  } catch (error: any) {
    logger.error('Failed to load oleoo module', { error: error.message });
  }
})();

interface ImdbMetadata {
  imdbName?: string;
  imdbYear?: number;
  imdbType?: string;
  yearRange?: string;
  image?: object | null;
  starring?: string;
  similarity?: number;
}

interface ProcessedFileInfo {
  parsedName: string;
  type: string;
  imdb_id: string | null;
  season: number | null;
  episode: number | null;
  resolution: string | null;
  source: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  audioChannels: string | null;
  languages: string | null;
  releaseGroup: string | null;
  flags: string | null;
  edition: string | null;
  imdbName?: string | null;
  imdbYear?: number | null;
  imdbType?: string | null;
  yearRange?: string | null;
  image?: string | null;
  starring?: string | null;
  similarity?: number | null;
}

/**
 * IMDB lookup service with caching
 */
class ImdbService {
  /**
   * Parse filename and get IMDB ID
   * @param filePath - Full file path
   * @param fileName - File name
   * @param fileSize - File size in bytes
   * @returns Parsed video information
   */
  async processFile(_filePath: string, fileName: string, _fileSize: number): Promise<ProcessedFileInfo> {
    // Check cache first
    const cacheKey = `imdb:${fileName}`;
    const cached = cache.get(cacheKey, config.cache.imdbTTL);
    if (cached) {
      return cached;
    }

    try {
      // Ensure oleoo is loaded (ES module)
      if (!oleoo) {
        oleoo = (await import('oleoo')).default;
      }
      
      // Step 1: Use oleoo to detect if it's a movie or TV show
      const oleooResult = oleoo.parse(fileName, { strict: false });
      const isTv = oleooResult.type === 'tvshow';
      
      logger.debug('Oleoo type detection', { 
        fileName, 
        type: oleooResult.type, 
        isTv 
      });
      
      // Step 2: Parse with ctrl parser using detected type
      const parsed = filenameParse(fileName, isTv);
      
      // Determine type (convert tvshow to series for consistency)
      const type = isTv ? 'series' : 'movie';
      
      // Extract season/episode info (prefer oleoo for accuracy)
      const parsedAny = parsed as any; // Type assertion for dynamic properties
      const season = oleooResult.season || (parsedAny.seasons && parsedAny.seasons.length > 0 ? parsedAny.seasons[0] : null);
      const episode = oleooResult.episode ? parseInt(oleooResult.episode, 10) : (parsedAny.episodes && parsedAny.episodes.length > 0 ? parsedAny.episodes[0] : null);
      
      // Extract title and year (prefer ctrl parser for clean title)
      const title = parsed.title || oleooResult.title || fileName;
      const year = parsed.year ? parseInt(parsed.year, 10) : (oleooResult.year ? parseInt(oleooResult.year, 10) : null);

      // Extract and merge metadata from both parsers
      const metadata = this._mergeMetadata(oleooResult, parsed);

      logger.debug('Parsed video info', {
        fileName,
        title,
        type,
        year,
        season,
        episode,
        resolution: metadata.resolution,
        source: metadata.source
      });

      // Only process movies and series
      if (!config.imdb.interestingTypes.includes(type)) {
        const result: ProcessedFileInfo = {
          parsedName: title,
          type: type,
          imdb_id: null,
          season: season,
          episode: episode,
          ...metadata
        };
        cache.set(cacheKey, result);
        return result;
      }

      // Look up IMDB ID and metadata
      const { imdbId, metadata: imdbMetadata } = await this._lookupImdb(title, year, type);
      
      const result: ProcessedFileInfo = {
        parsedName: title,
        type: type,
        imdb_id: imdbId || null,
        season: season,
        episode: episode,
        ...metadata,
        // Add IMDB metadata if available
        ...(imdbMetadata && {
          imdbName: imdbMetadata.imdbName,
          imdbYear: imdbMetadata.imdbYear,
          imdbType: imdbMetadata.imdbType,
          yearRange: imdbMetadata.yearRange,
          image: imdbMetadata.image ? JSON.stringify(imdbMetadata.image) : null,
          starring: imdbMetadata.starring,
          similarity: imdbMetadata.similarity
        })
      };

      // Cache the result
      cache.set(cacheKey, result);
      
      return result;
    } catch (error: any) {
      logger.warn('Error processing file for IMDB', { 
        fileName, 
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      logger.debug('Full error details', { error: error.toString(), stack: error.stack });
      return {
        parsedName: fileName,
        type: 'unknown',
        imdb_id: null,
        season: null,
        episode: null,
        resolution: null,
        source: null,
        videoCodec: null,
        audioCodec: null,
        audioChannels: null,
        languages: null,
        releaseGroup: null,
        flags: null,
        edition: null
      };
    }
  }

  /**
   * Merge metadata from both parsers
   * @private
   */
  private _mergeMetadata(oleooResult: any, ctrlParsed: any): {
    resolution: string | null;
    source: string | null;
    videoCodec: string | null;
    audioCodec: string | null;
    audioChannels: string | null;
    languages: string | null;
    releaseGroup: string | null;
    flags: string | null;
    edition: string | null;
  } {
    // Resolution: Prefer @ctrl parser (more detailed), fallback to oleoo
    const resolution = ctrlParsed.resolution || oleooResult.resolution || null;
    
    // Source: Prefer oleoo (standardized), fallback to @ctrl
    const source = oleooResult.source || (ctrlParsed.sources && ctrlParsed.sources.length > 0 ? ctrlParsed.sources[0] : null) || null;
    
    // Video Codec: Merge both (oleoo encoding + ctrl videoCodec)
    const videoCodec = oleooResult.encoding || ctrlParsed.videoCodec || null;
    
    // Audio: Use @ctrl (audioCodec + audioChannels), fallback to oleoo dub
    const audioCodec = ctrlParsed.audioCodec || (oleooResult.dub ? oleooResult.dub.split('-')[0] : null) || null;
    const audioChannels = ctrlParsed.audioChannels || (oleooResult.dub && oleooResult.dub.includes('-') ? oleooResult.dub.split('-')[1] : null) || null;
    
    // Languages: Merge arrays from both parsers, deduplicate
    const languages = this._mergeLanguages(oleooResult.languages, ctrlParsed.languages);
    
    // Release Group: Prefer oleoo, fallback to @ctrl
    const releaseGroup = oleooResult.group || ctrlParsed.group || null;
    
    // Flags/Edition: Merge arrays from both parsers
    const flags = this._mergeFlags(oleooResult.flags, ctrlParsed.revision, ctrlParsed.edition);
    // Edition: Only include keys where value is truthy
    const edition = ctrlParsed.edition && typeof ctrlParsed.edition === 'object'
      ? Object.keys(ctrlParsed.edition)
          .filter(key => ctrlParsed.edition[key])
          .join(', ') || null
      : null;

    return {
      resolution,
      source,
      videoCodec,
      audioCodec,
      audioChannels,
      languages: languages.length > 0 ? JSON.stringify(languages) : null,
      releaseGroup,
      flags: flags.length > 0 ? JSON.stringify(flags) : null,
      edition
    };
  }

  /**
   * Merge language arrays from both parsers
   * @private
   */
  private _mergeLanguages(oleooLangs: string[] | undefined, ctrlLangs: any[] | undefined): string[] {
    const merged = new Set<string>();
    
    if (oleooLangs && Array.isArray(oleooLangs)) {
      oleooLangs.forEach(lang => merged.add(lang));
    }
    
    if (ctrlLangs && Array.isArray(ctrlLangs)) {
      ctrlLangs.forEach((lang: any) => {
        // ctrl parser returns Language objects, extract code
        const langCode = typeof lang === 'string' ? lang : lang.code || lang.name;
        if (langCode) merged.add(langCode);
      });
    }
    
    return Array.from(merged);
  }

  /**
   * Merge flags from both parsers
   * @private
   */
  private _mergeFlags(oleooFlags: string[] | undefined, ctrlRevision: any, ctrlEdition: any): string[] {
    const flags = new Set<string>();
    
    if (oleooFlags && Array.isArray(oleooFlags)) {
      oleooFlags.forEach(flag => flags.add(flag));
    }
    
    if (ctrlRevision && ctrlRevision.version > 1) {
      flags.add('PROPER');
    }
    
    if (ctrlEdition && typeof ctrlEdition === 'object') {
      Object.keys(ctrlEdition).forEach(key => {
        if (ctrlEdition[key]) flags.add(key.toUpperCase());
      });
    }
    
    return Array.from(flags);
  }

  /**
   * Lookup IMDB ID using name-to-imdb library
   * Returns both IMDB ID and metadata
   * @private
   */
  private _lookupImdb(name: string, year: number | null, type: string): Promise<{ imdbId: string | null; metadata: ImdbMetadata | null }> {
    return new Promise((resolve) => {
      nameToImdb({
        name,
        year: year || undefined,
        type,
      }, (err: Error | null, imdbId: string | null, inf: any) => {
        if (err) {
          logger.debug('IMDB lookup failed', { name, year, type, error: err.message });
          resolve({ imdbId: null, metadata: null });
        } else {
          logger.debug('IMDB lookup success', { 
            name, 
            imdbId, 
            match: inf?.match,
            hasMeta: !!inf?.meta 
          });
          
          // Extract useful metadata from inf.meta
          const metadata: ImdbMetadata | null = inf?.meta ? {
            imdbName: inf.meta.name,
            imdbYear: inf.meta.year,
            imdbType: inf.meta.type,
            yearRange: inf.meta.yearRange,
            image: inf.meta.image,
            starring: inf.meta.starring,
            similarity: inf.meta.similarity
          } : null;
          
          resolve({ imdbId, metadata });
        }
      });
    });
  }
}

export default new ImdbService();
