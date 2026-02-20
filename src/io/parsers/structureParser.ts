import { Structure } from '../../models/structure';

/**
 * Parser interface for different file formats
 */
export interface StructureParser {
  parse(content: string): Structure;
  serialize(structure: Structure): string;
}
