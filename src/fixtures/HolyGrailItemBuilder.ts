import type {
  ArmorSubCategory,
  CharmSubCategory,
  EtherealType,
  Item,
  ItemCategory,
  ItemSet,
  ItemType,
  JewelrySubCategory,
  RuneSubCategory,
  RunewordSubCategory,
  WeaponSubCategory,
} from 'electron/types/grail';

/**
 * Builder class for creating Item test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class HolyGrailItemBuilder {
  private item: Item = {
    id: 'default-item',
    name: 'Default Item',
    link: 'https://example.com/default-item',
    type: 'unique',
    category: 'weapons',
    subCategory: '2h_swords',
    treasureClass: 'normal',
    etherealType: 'none',
  };

  /**
   * Create a new builder instance
   */
  static new(): HolyGrailItemBuilder {
    return new HolyGrailItemBuilder();
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
  withCategory(category: ItemCategory): this {
    this.item.category = category;
    return this;
  }

  /**
   * Set the weapon subcategory
   */
  withWeaponSubCategory(subCategory: WeaponSubCategory): this {
    this.item.category = 'weapons';
    this.item.subCategory = subCategory;
    return this;
  }

  /**
   * Set the armor subcategory
   */
  withArmorSubCategory(subCategory: ArmorSubCategory): this {
    this.item.category = 'armor';
    this.item.subCategory = subCategory;
    return this;
  }

  /**
   * Set the jewelry subcategory
   */
  withJewelrySubCategory(subCategory: JewelrySubCategory): this {
    this.item.category = 'jewelry';
    this.item.subCategory = subCategory;
    return this;
  }

  /**
   * Set the charm subcategory
   */
  withCharmSubCategory(subCategory: CharmSubCategory): this {
    this.item.category = 'charms';
    this.item.subCategory = subCategory;
    return this;
  }

  /**
   * Set the rune subcategory
   */
  withRuneSubCategory(subCategory: RuneSubCategory): this {
    this.item.category = 'runes';
    this.item.subCategory = subCategory;
    return this;
  }

  /**
   * Set the runeword subcategory
   */
  withRunewordSubCategory(subCategory: RunewordSubCategory): this {
    this.item.category = 'runewords';
    this.item.subCategory = subCategory;
    return this;
  }

  /**
   * Set the ethereal type
   */
  withEtherealType(etherealType: EtherealType): this {
    this.item.etherealType = etherealType;
    return this;
  }

  /**
   * Set the set name (for set items)
   */
  withSetName(setName: string | undefined): this {
    this.item.setName = setName as ItemSet | undefined;
    return this;
  }

  /**
   * Remove the set name (for non-set items)
   */
  withoutSetName(): this {
    delete this.item.setName;
    return this;
  }

  /**
   * Build and return the Item
   */
  build(): Item {
    return { ...this.item };
  }

  /**
   * Build multiple items with the same base configuration
   */
  buildMany(count: number): Item[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.item,
      id: `${this.item.id}-${index}`,
      name: `${this.item.name} ${index + 1}`,
    }));
  }
}
