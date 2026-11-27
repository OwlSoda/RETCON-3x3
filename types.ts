
export interface TileData {
  id: number;
  imageUrl: string | null;
  isLoading: boolean;
  scale: number;
  positionX: number;
  positionY: number;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export type NamingScheme = 'DEFAULT' | 'TIMESTAMP' | 'MINIMAL' | 'CHRONO';

export interface ExportConfig {
  format: ExportFormat;
  quality: number;
  namingScheme: NamingScheme;
}
