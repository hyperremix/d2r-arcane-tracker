import type { D2SItem } from 'electron/types/grail';

/**
 * Builder class for creating D2SItem test fixtures
 * Follows the builder pattern for flexible test data creation
 * Used in itemDetection tests to create real D2S library item structures
 */
export class D2SItemBuilder {
  private item: D2SItem = {};

  /**
   * Create a new builder instance
   */
  static new(): D2SItemBuilder {
    return new D2SItemBuilder();
  }

  /**
   * Set the item ID
   */
  withId(id: string | number): this {
    this.item.id = id;
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
   * Remove the item type
   */
  withoutType(): this {
    delete this.item.type;
    return this;
  }

  /**
   * Set the item type name
   */
  withTypeName(typeName: string): this {
    this.item.type_name = typeName;
    return this;
  }

  /**
   * Remove the item type name
   */
  withoutTypeName(): this {
    delete this.item.type_name;
    return this;
  }

  /**
   * Set the item code
   */
  withCode(code: string): this {
    this.item.code = code;
    return this;
  }

  /**
   * Remove the item code
   */
  withoutCode(): this {
    delete this.item.code;
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
   * Set the unique item name
   */
  withUniqueName(uniqueName: string): this {
    this.item.unique_name = uniqueName;
    return this;
  }

  /**
   * Set the set item name
   */
  withSetName(setName: string): this {
    this.item.set_name = setName;
    return this;
  }

  /**
   * Set the rare item name
   */
  withRareName(rareName: string): this {
    this.item.rare_name = rareName;
    return this;
  }

  /**
   * Set the rare item name 2
   */
  withRareName2(rareName2: string): this {
    this.item.rare_name2 = rareName2;
    return this;
  }

  /**
   * Set the runeword name
   */
  withRunewordName(runewordName: string): this {
    this.item.runeword_name = runewordName;
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
   * Set the ethereal flag (0 = normal, 1 = ethereal)
   */
  withEthereal(ethereal: number): this {
    this.item.ethereal = ethereal;
    return this;
  }

  /**
   * Set the item quality (1=normal, 2=magic, 3=rare, 4=set, 5=unique, 6=crafted)
   */
  withQuality(quality: number): this {
    this.item.quality = quality;
    return this;
  }

  /**
   * Set the item location
   */
  withLocation(location: string): this {
    this.item.location = location;
    return this;
  }

  /**
   * Set the equipped flag
   */
  withEquipped(equipped: boolean): this {
    this.item.equipped = equipped;
    return this;
  }

  /**
   * Set the socketed count
   */
  withSocketed(socketed: number): this {
    this.item.socketed = socketed;
    return this;
  }

  /**
   * Remove the socketed count
   */
  withoutSocketed(): this {
    delete this.item.socketed;
    return this;
  }

  /**
   * Set the socket count
   */
  withSocketCount(socketCount: number): this {
    this.item.socket_count = socketCount;
    return this;
  }

  /**
   * Remove the socket count
   */
  withoutSocketCount(): this {
    delete this.item.socket_count;
    return this;
  }

  /**
   * Set the socketed items
   */
  withSocketedItems(socketedItems: D2SItem[]): this {
    this.item.socketed_items = socketedItems;
    return this;
  }

  /**
   * Set the gems array
   */
  withGems(gems: unknown[]): this {
    this.item.gems = gems;
    return this;
  }

  /**
   * Remove the gems array
   */
  withoutGems(): this {
    delete this.item.gems;
    return this;
  }

  /**
   * Set the magic attributes
   */
  withMagicAttributes(attributes: Array<{ name: string; value?: unknown }>): this {
    this.item.magic_attributes = attributes;
    return this;
  }

  // Convenience methods for common item types

  /**
   * Create a unique helm item (Shako)
   */
  asUniqueHelm(): this {
    return this.withType('ushk')
      .withUniqueName('Shako')
      .withLevel(62)
      .withQuality(5)
      .withEthereal(0);
  }

  /**
   * Create a unique bow item (Windforce)
   */
  asUniqueBow(): this {
    return this.withType('hyd')
      .withUniqueName('Windforce')
      .withLevel(64)
      .withQuality(5)
      .withEthereal(0);
  }

  /**
   * Create a rune item
   */
  asRune(runeType: string = 'r30'): this {
    return this.withType(runeType).withLevel(63).withQuality(6).withEthereal(0);
  }

  /**
   * Create a set armor item
   */
  asSetArmor(): this {
    return this.withType('armo')
      .withSetName('Angelic Raiment')
      .withLevel(12)
      .withQuality(4)
      .withEthereal(0);
  }

  /**
   * Create a rare item
   */
  asRareItem(): this {
    return this.withType('swor')
      .withRareName('Rare Sword')
      .withLevel(30)
      .withQuality(3)
      .withEthereal(0);
  }

  /**
   * Create a runeword item
   */
  asRuneword(): this {
    return this.withType('armo')
      .withRunewordName('Enigma')
      .withLevel(65)
      .withQuality(6)
      .withEthereal(0);
  }

  /**
   * Create a rainbow facet item
   */
  asRainbowFacet(): this {
    return this.withType('jew')
      .withUniqueName('Rainbow Facet')
      .withLevel(49)
      .withQuality(5)
      .withEthereal(0)
      .withMagicAttributes([{ name: 'item_skillondeath' }, { name: 'passive_cold_mastery' }]);
  }

  /**
   * Create an equipped item
   */
  asEquipped(): this {
    return this.withLocation('equipped').withEquipped(true);
  }

  /**
   * Create a socketed item
   */
  asSocketed(socketCount: number = 2): this {
    return this.withSocketed(socketCount).withSocketCount(socketCount);
  }

  /**
   * Create an ethereal item
   */
  asEthereal(): this {
    return this.withEthereal(1);
  }

  /**
   * Build and return the D2SItem
   */
  build(): D2SItem {
    return { ...this.item };
  }

  /**
   * Build multiple items with the same base configuration
   */
  buildMany(count: number): D2SItem[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.item,
      id: `${this.item.id || 'item'}-${index}`,
    }));
  }
}
