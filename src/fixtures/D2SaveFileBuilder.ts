import type { D2SaveFile } from 'electron/services/saveFileMonitor';

export class D2SaveFileBuilder {
  private saveFile: D2SaveFile = {
    name: 'DefaultCharacter',
    path: '/path/to/default.d2s',
    lastModified: new Date('2024-01-01T00:00:00Z'),
    characterClass: 'Amazon',
    level: 1,
    hardcore: false,
    expansion: true,
  };

  static new(): D2SaveFileBuilder {
    return new D2SaveFileBuilder();
  }

  withName(name: string): this {
    this.saveFile.name = name;
    return this;
  }

  withPath(path: string): this {
    this.saveFile.path = path;
    return this;
  }

  withLastModified(lastModified: Date): this {
    this.saveFile.lastModified = lastModified;
    return this;
  }

  withCharacterClass(characterClass: string): this {
    this.saveFile.characterClass = characterClass;
    return this;
  }

  withLevel(level: number): this {
    this.saveFile.level = level;
    return this;
  }

  withHardcore(hardcore: boolean): this {
    this.saveFile.hardcore = hardcore;
    return this;
  }

  withExpansion(expansion: boolean): this {
    this.saveFile.expansion = expansion;
    return this;
  }

  // Convenience methods for common character types
  asAmazon(): this {
    return this.withCharacterClass('Amazon');
  }

  asBarbarian(): this {
    return this.withCharacterClass('Barbarian');
  }

  asNecromancer(): this {
    return this.withCharacterClass('Necromancer');
  }

  asPaladin(): this {
    return this.withCharacterClass('Paladin');
  }

  asSorceress(): this {
    return this.withCharacterClass('Sorceress');
  }

  asDruid(): this {
    return this.withCharacterClass('Druid');
  }

  asAssassin(): this {
    return this.withCharacterClass('Assassin');
  }

  // Convenience methods for character types
  asHardcore(): this {
    return this.withHardcore(true);
  }

  asSoftcore(): this {
    return this.withHardcore(false);
  }

  asExpansion(): this {
    return this.withExpansion(true);
  }

  asClassic(): this {
    return this.withExpansion(false);
  }

  // Convenience methods for levels
  atLevel(level: number): this {
    return this.withLevel(level);
  }

  // Build methods
  build(): D2SaveFile {
    return { ...this.saveFile };
  }

  buildMany(count: number): D2SaveFile[] {
    return Array.from({ length: count }, (_, i) =>
      D2SaveFileBuilder.new()
        .withName(`${this.saveFile.name}-${i}`)
        .withPath(`${this.saveFile.path.replace('.d2s', `-${i}.d2s`)}`)
        .withLastModified(this.saveFile.lastModified)
        .withCharacterClass(this.saveFile.characterClass)
        .withLevel(this.saveFile.level)
        .withHardcore(this.saveFile.hardcore)
        .withExpansion(this.saveFile.expansion)
        .build(),
    );
  }
}
