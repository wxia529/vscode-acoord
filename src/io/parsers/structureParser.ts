import { Structure } from '../../models/structure';

/**
 * Parser interface for different file formats
 */
export interface StructureParser {
  parse(content: string): Structure;
  serialize(structure: Structure): string;
  parseTrajectory?(content: string): Structure[];
  serializeTrajectory?(structures: Structure[]): string;
}
