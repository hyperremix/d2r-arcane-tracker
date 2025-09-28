import type { DatabaseItem, EtherealType, ItemType } from 'electron/types/grail';

/**
 * Builder class for creating DatabaseItem test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class DatabaseItemBuilder {
  private item: DatabaseItem = {
    id: 'default-item-id',
    name: 'Default Item',
    type: 'unique',
    category: 'armor',
    sub_category: 'helms',
    set_name: undefined,
    ethereal_type: 'none',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  /**
   * Create a new builder instance
   */
  static new(): DatabaseItemBuilder {
    return new DatabaseItemBuilder();
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
  withType(type: ItemType): this {
    this.item.type = type;
    return this;
  }

  /**
   * Set the item category
   */
  withCategory(category: string): this {
    this.item.category = category;
    return this;
  }

  /**
   * Set the item subcategory
   */
  withSubCategory(subCategory: string): this {
    this.item.sub_category = subCategory;
    return this;
  }

  /**
   * Set the set name (for set items)
   */
  withSetName(setName: string): this {
    this.item.set_name = setName;
    return this;
  }

  /**
   * Remove the set name (for non-set items)
   */
  withoutSetName(): this {
    this.item.set_name = undefined;
    return this;
  }

  /**
   * Set the ethereal type
   */
  withEtherealType(etherealType: EtherealType): this {
    this.item.ethereal_type = etherealType;
    return this;
  }

  /**
   * Set the created timestamp
   */
  withCreatedAt(createdAt: string): this {
    this.item.created_at = createdAt;
    return this;
  }

  /**
   * Set the updated timestamp
   */
  withUpdatedAt(updatedAt: string): this {
    this.item.updated_at = updatedAt;
    return this;
  }

  /**
   * Set as unique item (common test case)
   */
  asUnique(): this {
    this.item.type = 'unique';
    return this;
  }

  /**
   * Set as set item (common test case)
   */
  asSet(): this {
    this.item.type = 'set';
    return this;
  }

  /**
   * Set as rune item (common test case)
   */
  asRune(): this {
    this.item.type = 'rune';
    return this;
  }

  /**
   * Set as runeword item (common test case)
   */
  asRuneword(): this {
    this.item.type = 'runeword';
    return this;
  }

  /**
   * Set as armor item (common test case)
   */
  asArmor(): this {
    this.item.category = 'armor';
    return this;
  }

  /**
   * Set as weapon item (common test case)
   */
  asWeapon(): this {
    this.item.category = 'weapons';
    return this;
  }

  /**
   * Set as jewelry item (common test case)
   */
  asJewelry(): this {
    this.item.category = 'jewelry';
    return this;
  }

  /**
   * Set as charm item (common test case)
   */
  asCharm(): this {
    this.item.category = 'charms';
    return this;
  }

  /**
   * Set as rune category item (common test case)
   */
  asRuneCategory(): this {
    this.item.category = 'runes';
    return this;
  }

  /**
   * Set as runeword category item (common test case)
   */
  asRunewordCategory(): this {
    this.item.category = 'runewords';
    return this;
  }

  /**
   * Set as helm item (common test case)
   */
  asHelm(): this {
    this.item.sub_category = 'helms';
    return this;
  }

  /**
   * Set as armor item (common test case)
   */
  asArmorSubCategory(): this {
    this.item.sub_category = 'armor';
    return this;
  }

  /**
   * Set as shield item (common test case)
   */
  asShield(): this {
    this.item.sub_category = 'shields';
    return this;
  }

  /**
   * Set as sword item (common test case)
   */
  asSword(): this {
    this.item.sub_category = 'swords';
    return this;
  }

  /**
   * Set as bow item (common test case)
   */
  asBow(): this {
    this.item.sub_category = 'bows';
    return this;
  }

  /**
   * Set as amulet item (common test case)
   */
  asAmulet(): this {
    this.item.sub_category = 'amulets';
    return this;
  }

  /**
   * Set as ring item (common test case)
   */
  asRing(): this {
    this.item.sub_category = 'rings';
    return this;
  }

  /**
   * Set as small charm item (common test case)
   */
  asSmallCharm(): this {
    this.item.sub_category = 'small_charms';
    return this;
  }

  /**
   * Set as large charm item (common test case)
   */
  asLargeCharm(): this {
    this.item.sub_category = 'large_charms';
    return this;
  }

  /**
   * Set as grand charm item (common test case)
   */
  asGrandCharm(): this {
    this.item.sub_category = 'grand_charms';
    return this;
  }

  /**
   * Set as Shako (common unique helm test case)
   */
  asShako(): this {
    return this.withId('shako')
      .withName('shako')
      .asUnique()
      .asArmor()
      .asHelm()
      .withEtherealType('none');
  }

  /**
   * Set as Windforce (common unique bow test case)
   */
  asWindforce(): this {
    return this.withId('windforce')
      .withName('windforce')
      .asUnique()
      .asWeapon()
      .asBow()
      .withEtherealType('none');
  }

  /**
   * Set as Tal Rasha's Set (common set test case)
   */
  asTalRashasSet(): this {
    return this.withId('tal-rashas-set')
      .withName("Tal Rasha's Set")
      .asSet()
      .asArmor()
      .withSetName("Tal Rasha's Set")
      .withEtherealType('none');
  }

  /**
   * Build and return the DatabaseItem
   */
  build(): DatabaseItem {
    return { ...this.item };
  }

  /**
   * Build multiple items with the same base configuration
   */
  buildMany(count: number): DatabaseItem[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.item,
      id: `${this.item.id}-${index}`,
      name: `${this.item.name} ${index + 1}`,
    }));
  }
}
