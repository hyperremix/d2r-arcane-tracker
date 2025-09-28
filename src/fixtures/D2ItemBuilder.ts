import type { D2Item } from 'electron/types/grail';

/**
 * Builder class for creating D2Item test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class D2ItemBuilder {
  private item: D2Item = {
    id: 'default-item',
    name: 'Default Item',
    type: 'misc',
    quality: 'normal',
    level: 1,
    ethereal: false,
    sockets: 0,
    timestamp: new Date('2024-01-01T00:00:00.000Z'),
    characterName: 'DefaultCharacter',
    location: 'inventory',
  };

  /**
   * Create a new builder instance
   */
  static new(): D2ItemBuilder {
    return new D2ItemBuilder();
  }

  /**
   * Set the item ID
   */
  withId(id: string): this {
    this.item.id = id;
    return this;
  }

  /**
   * Set the item name
   */
  withName(name: string): this {
    this.item.name = name;
    return this;
  }

  /**
   * Set the item type
   */
  withType(type: string): this {
    this.item.type = type;
    return this;
  }

  /**
   * Set the item quality
   */
  withQuality(quality: D2Item['quality']): this {
    this.item.quality = quality;
    return this;
  }

  /**
   * Set the item level
   */
  withLevel(level: number): this {
    this.item.level = level;
    return this;
  }

  /**
   * Set the item as ethereal
   */
  asEthereal(): this {
    this.item.ethereal = true;
    return this;
  }

  /**
   * Set the item as non-ethereal
   */
  asNonEthereal(): this {
    this.item.ethereal = false;
    return this;
  }

  /**
   * Set the ethereal state based on boolean value
   */
  withEthereal(ethereal: boolean): this {
    this.item.ethereal = ethereal;
    return this;
  }

  /**
   * Set the number of sockets
   */
  withSockets(sockets: number): this {
    this.item.sockets = sockets;
    return this;
  }

  /**
   * Set the timestamp
   */
  withTimestamp(timestamp: Date): this {
    this.item.timestamp = timestamp;
    return this;
  }

  /**
   * Set the character name
   */
  withCharacterName(characterName: string): this {
    this.item.characterName = characterName;
    return this;
  }

  /**
   * Set the item location
   */
  withLocation(location: D2Item['location']): this {
    this.item.location = location;
    return this;
  }

  /**
   * Set as a unique helm item (common test case)
   */
  asUniqueHelm(): this {
    this.item.quality = 'unique';
    this.item.type = 'helms';
    return this;
  }

  /**
   * Set as a unique bow item (common test case)
   */
  asUniqueBow(): this {
    this.item.quality = 'unique';
    this.item.type = 'bows';
    return this;
  }

  /**
   * Set as a set armor item (common test case)
   */
  asSetArmor(): this {
    this.item.quality = 'set';
    this.item.type = 'armor';
    return this;
  }

  /**
   * Set as a rare weapon item (common test case)
   */
  asRareWeapon(): this {
    this.item.quality = 'rare';
    this.item.type = 'weapon';
    return this;
  }

  /**
   * Build and return the D2Item
   */
  build(): D2Item {
    return { ...this.item };
  }

  /**
   * Build multiple items with the same base configuration
   */
  buildMany(count: number): D2Item[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.item,
      id: `${this.item.id}-${index}`,
      name: `${this.item.name} ${index + 1}`,
    }));
  }
}
