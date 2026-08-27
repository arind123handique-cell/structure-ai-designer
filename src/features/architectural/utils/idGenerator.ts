/**
 * Stable Element ID Generator for Architectural BIM Elements
 * Format: W-001, D-001, WIN-001, O-001, R-001, DIM-001
 */

export class ArchitecturalIdGenerator {
  public static generateWallId(existingIds: string[] = []): string {
    return this.nextPrefixedId('W', existingIds);
  }

  public static generateDoorId(existingIds: string[] = []): string {
    return this.nextPrefixedId('D', existingIds);
  }

  public static generateWindowId(existingIds: string[] = []): string {
    return this.nextPrefixedId('WIN', existingIds);
  }

  public static generateOpeningId(existingIds: string[] = []): string {
    return this.nextPrefixedId('O', existingIds);
  }

  public static generateRoomId(existingIds: string[] = []): string {
    return this.nextPrefixedId('R', existingIds);
  }

  public static generateDimensionId(existingIds: string[] = []): string {
    return this.nextPrefixedId('DIM', existingIds);
  }

  private static nextPrefixedId(prefix: string, existingIds: string[] = []): string {
    const list = Array.isArray(existingIds) ? existingIds : [];
    const regex = new RegExp(`^${prefix}-(\\d+)$`);
    let maxNum = 0;

    for (const id of list) {
      if (typeof id === 'string') {
        const match = id.match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    const formatted = String(nextNum).padStart(3, '0');
    return `${prefix}-${formatted}`;
  }
}
