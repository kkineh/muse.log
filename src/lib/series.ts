export const SERIES_PREFIX = 'series:';

export const isSeriesTag = (name: string) => name.toLowerCase().startsWith(SERIES_PREFIX);

export const seriesLabel = (name: string) => name.slice(SERIES_PREFIX.length).trim();
