import { Structure } from '../../models/structure';

/**
 * Base class for structure parsers providing default implementations
 * for trajectory methods. Subclasses should override these methods
 * if they support trajectory parsing/serialization.
 */
export abstract class BaseStructureParser {
  abstract parse(content: string): Structure;
  abstract serialize(structure: Structure): string;

  /**
   * Parse trajectory from content. Default implementation returns single structure.
   * Override in subclasses that support multi-frame formats.
   */
  parseTrajectory(content: string): Structure[] {
    return [this.parse(content)];
  }

  /**
   * Serialize trajectory to string. Default implementation serializes first structure only.
   * Override in subclasses that support multi-frame export.
   */
  serializeTrajectory(structures: Structure[]): string {
    if (structures.length === 0) {
      throw new Error('No structures to serialize');
    }
    return this.serialize(structures[0]);
  }
}
