#!/usr/bin/env tsx

import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Simple mock for electron app
const mockElectron = {
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        // Use the same path as the main application
        // On macOS: ~/Library/Application Support/d2r-arcane-tracker
        // On Windows: %APPDATA%/d2r-arcane-tracker
        // On Linux: ~/.config/d2r-arcane-tracker
        const os = require('node:os');
        const platform = os.platform();

        let basePath: string;
        if (platform === 'darwin') {
          basePath = path.join(
            os.homedir(),
            'Library',
            'Application Support',
            '@hyperremix',
            'd2r-arcane-tracker',
          );
        } else if (platform === 'win32') {
          basePath = path.join(
            os.homedir(),
            'AppData',
            'Roaming',
            '@hyperremix',
            'd2r-arcane-tracker',
          );
        } else {
          basePath = path.join(os.homedir(), '.config', '@hyperremix', 'd2r-arcane-tracker');
        }

        return basePath;
      }
      return '';
    },
  },
};

// Override electron module resolution by setting up global mocking
(globalThis as { __electron_mock__?: typeof mockElectron }).__electron_mock__ = mockElectron;

// Import types
type CharacterClass =
  | 'amazon'
  | 'assassin'
  | 'barbarian'
  | 'druid'
  | 'necromancer'
  | 'paladin'
  | 'sorceress';
type Difficulty = 'normal' | 'nightmare' | 'hell';

interface TestCharacter {
  name: string;
  characterClass: CharacterClass;
  level: number;
  difficulty: Difficulty;
  hardcore: boolean;
  expansion: boolean;
  completionTarget: number; // percentage of items to mark as found
}

interface DatabaseItem {
  id: string;
  name: string;
  type: string;
  category: string;
  sub_category: string;
  set_name?: string;
  ethereal_type: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseCharacter {
  id: string;
  name: string;
  character_class: string;
  level: number;
  difficulty: string;
  hardcore: boolean;
  expansion: boolean;
  save_file_path?: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseProgress {
  id: string;
  character_id: string;
  item_id: string;
  found: boolean;
  found_date?: string;
  manually_added: boolean;
  difficulty?: string;
  notes?: string;
  is_ethereal: boolean;
  created_at: string;
  updated_at: string;
}

interface SimplifiedGrailDatabase {
  getAllItems(): DatabaseItem[];
  getAllCharacters(): DatabaseCharacter[];
  getProgressByCharacter(characterId: string): DatabaseProgress[];
  insertCharacter(character: DatabaseCharacter): void;
  deleteCharacter(id: string): void;
  upsertProgress(progress: DatabaseProgress): void;
  getItemById(itemId: string): DatabaseItem | undefined;
}

const TEST_CHARACTERS: TestCharacter[] = [
  {
    name: 'Conan',
    characterClass: 'barbarian',
    level: 85,
    difficulty: 'hell',
    hardcore: true,
    expansion: true,
    completionTarget: 60,
  },
  {
    name: 'Morrigan',
    characterClass: 'sorceress',
    level: 78,
    difficulty: 'hell',
    hardcore: false,
    expansion: true,
    completionTarget: 35,
  },
  {
    name: 'Tyrael',
    characterClass: 'paladin',
    level: 45,
    difficulty: 'nightmare',
    hardcore: false,
    expansion: true,
    completionTarget: 15,
  },
  {
    name: 'Diana',
    characterClass: 'amazon',
    level: 92,
    difficulty: 'hell',
    hardcore: true,
    expansion: true,
    completionTarget: 80,
  },
  {
    name: 'Rathma',
    characterClass: 'necromancer',
    level: 67,
    difficulty: 'hell',
    hardcore: false,
    expansion: true,
    completionTarget: 40,
  },
  {
    name: 'Cain',
    characterClass: 'druid',
    level: 25,
    difficulty: 'normal',
    hardcore: false,
    expansion: true,
    completionTarget: 5,
  },
];

async function clearExistingTestData(db: SimplifiedGrailDatabase): Promise<void> {
  console.log('🧹 Clearing existing test characters and progress...');

  try {
    // Delete existing progress first (due to foreign key constraints)
    const existingCharacters = db.getAllCharacters();
    for (const char of existingCharacters) {
      const progress = db.getProgressByCharacter(char.id);
      console.log(`   Removing ${progress.length} progress entries for ${char.name}`);
    }

    // Clear characters (this should cascade to progress due to foreign keys)
    db.getAllCharacters().forEach((char) => {
      db.deleteCharacter(char.id);
    });
    console.log('✅ Existing test data cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear existing test data:', error);
    throw error;
  }
}

async function createTestCharacters(db: SimplifiedGrailDatabase): Promise<string[]> {
  console.log('👥 Creating test characters...');
  const characterIds: string[] = [];

  try {
    for (const testChar of TEST_CHARACTERS) {
      const characterId = randomUUID();
      characterIds.push(characterId);

      try {
        db.insertCharacter({
          id: characterId,
          name: testChar.name,
          character_class: testChar.characterClass,
          level: testChar.level,
          difficulty: testChar.difficulty,
          hardcore: testChar.hardcore,
          expansion: testChar.expansion,
          save_file_path: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        console.log(
          `   ✅ Created ${testChar.name} (${testChar.characterClass}, level ${testChar.level})`,
        );
      } catch (error) {
        console.error(`❌ Failed to create character ${testChar.name}:`, error);
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Failed to create test characters:', error);
    throw error;
  }

  return characterIds;
}

function generateFoundDate(): Date {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return new Date(sixMonthsAgo.getTime() + Math.random() * (Date.now() - sixMonthsAgo.getTime()));
}

function determineItemId(item: DatabaseItem, _db: SimplifiedGrailDatabase): string {
  // Always use base item ID
  return item.id;
}

function determineIsEthereal(item: DatabaseItem): boolean {
  if (item.type === 'unique' && item.ethereal_type === 'optional') {
    // 30% chance for ethereal version
    return Math.random() < 0.3;
  } else if (item.ethereal_type === 'only') {
    // Always ethereal for ethereal-only items
    return true;
  }
  return false;
}

function generateDifficulty(characterDifficulty: Difficulty): Difficulty {
  if (characterDifficulty === 'hell') {
    return (['normal', 'nightmare', 'hell'] as Difficulty[])[Math.floor(Math.random() * 3)];
  } else if (characterDifficulty === 'nightmare') {
    return (['normal', 'nightmare'] as Difficulty[])[Math.floor(Math.random() * 2)];
  }
  return 'normal';
}

function generateNotes(item: DatabaseItem): string | undefined {
  if (item.type === 'unique' && Math.random() < 0.1) {
    const noteOptions = [
      'Great roll on stats!',
      'Perfect ethereal find',
      'Found in Chaos Sanctuary',
      'Dropped by Mephisto',
      'First unique of this type',
      'Finally completed the set!',
    ];
    return noteOptions[Math.floor(Math.random() * noteOptions.length)];
  }
  return undefined;
}

async function createProgressForItem(
  db: SimplifiedGrailDatabase,
  item: DatabaseItem,
  characterId: string,
  testChar: TestCharacter,
): Promise<void> {
  try {
    const foundDate = generateFoundDate();
    const manuallyAdded = Math.random() < 0.2;
    const itemId = determineItemId(item, db);
    const isEthereal = determineIsEthereal(item);
    const foundDifficulty = generateDifficulty(testChar.difficulty);
    const notes = generateNotes(item);
    const progressId = randomUUID();

    // Validate that the item exists in the database before creating progress
    const targetItem = db.getItemById(itemId);
    if (!targetItem) {
      console.warn(
        `⚠️  Skipping progress entry for non-existent item: ${itemId} (original: ${item.id})`,
      );
      return;
    }

    db.upsertProgress({
      id: progressId,
      character_id: characterId,
      item_id: itemId,
      found: true,
      found_date: foundDate.toISOString(),
      manually_added: manuallyAdded,
      difficulty: foundDifficulty,
      notes,
      is_ethereal: isEthereal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    // Skip duplicate entries (might happen with ethereal/normal variants)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      console.log(`     ⚠️  Skipping duplicate progress entry for ${item.name}`);
      return;
    }
    console.error(`❌ Failed to create progress entry for ${testChar.name} - ${item.name}:`, error);
    throw error;
  }
}

async function seedGrailProgress(
  db: SimplifiedGrailDatabase,
  allItems: DatabaseItem[],
  characterIds: string[],
): Promise<void> {
  console.log('📊 Seeding grail progress...');

  try {
    for (let i = 0; i < TEST_CHARACTERS.length; i++) {
      const testChar = TEST_CHARACTERS[i];
      const characterId = characterIds[i];

      console.log(`   Processing ${testChar.name}...`);

      try {
        // Calculate how many items this character should have found
        const targetCount = Math.floor((allItems.length * testChar.completionTarget) / 100);

        // Shuffle items and take a random subset
        const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);
        const foundItems = shuffledItems.slice(0, targetCount);

        console.log(
          `   Creating ${foundItems.length} progress entries (${testChar.completionTarget}% completion)`,
        );

        for (const item of foundItems) {
          await createProgressForItem(db, item, characterId, testChar);
        }

        console.log(`   ✅ Completed progress seeding for ${testChar.name}`);
      } catch (error) {
        console.error(`❌ Failed to process character ${testChar.name}:`, error);
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Failed to seed grail progress:', error);
    throw error;
  }
}

async function printSummary(db: SimplifiedGrailDatabase): Promise<void> {
  console.log('\n📈 Test data seeding summary:');
  try {
    const finalCharacters = db.getAllCharacters();
    for (const char of finalCharacters) {
      try {
        const progress = db.getProgressByCharacter(char.id);
        const foundCount = progress.filter((p) => p.found).length;
        console.log(`   ${char.name}: ${foundCount} items found`);
      } catch (error) {
        console.error(`❌ Failed to get progress summary for ${char.name}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Failed to generate seeding summary:', error);
  }
}

async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  let db: SimplifiedGrailDatabase;

  // Use the same path as the main application
  const userDataPath = mockElectron.app.getPath('userData');
  const dbPath = path.join(userDataPath, 'grail.db');

  try {
    // Since we can't easily mock the electron import, let's try a simpler approach
    // We'll create a mock database class that connects to sqlite directly
    const Database = require('better-sqlite3');

    // Ensure the user data directory exists
    await mkdir(userDataPath, { recursive: true });

    console.log(`📁 Using database at: ${dbPath}`);

    // Create a simplified database class for seeding
    class SimplifiedGrailDatabaseClass implements SimplifiedGrailDatabase {
      private db: InstanceType<typeof Database>;

      constructor() {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
      }

      getAllItems() {
        try {
          const result = this.db
            .prepare('SELECT * FROM items ORDER BY category, sub_category, name')
            .all();
          console.log(`📦 Retrieved ${result.length} items from database`);
          return result;
        } catch (error) {
          console.error('❌ Failed to get all items:', error);
          throw error;
        }
      }

      getAllCharacters() {
        try {
          const result = this.db
            .prepare('SELECT * FROM characters WHERE deleted_at IS NULL ORDER BY updated_at DESC')
            .all();
          console.log(`👥 Retrieved ${result.length} characters from database`);
          return result;
        } catch (error) {
          console.error('❌ Failed to get all characters:', error);
          throw error;
        }
      }

      getProgressByCharacter(characterId: string) {
        try {
          const result = this.db
            .prepare('SELECT * FROM grail_progress WHERE character_id = ?')
            .all(characterId);
          return result;
        } catch (error) {
          console.error(`❌ Failed to get progress for character ${characterId}:`, error);
          throw error;
        }
      }

      insertCharacter(character: DatabaseCharacter) {
        try {
          const stmt = this.db.prepare(`
            INSERT INTO characters (id, name, character_class, level, difficulty, hardcore, expansion, save_file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            character.id,
            character.name,
            character.character_class,
            character.level,
            character.difficulty,
            character.hardcore ? 1 : 0,
            character.expansion ? 1 : 0,
            character.save_file_path || null,
          );
        } catch (error) {
          console.error(`❌ Failed to insert character ${character.name}:`, error);
          throw error;
        }
      }

      deleteCharacter(id: string) {
        try {
          const result = this.db
            .prepare('UPDATE characters SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(id);
          if (result.changes === 0) {
            console.warn(`⚠️  No character found with ID ${id} to delete`);
          }
        } catch (error) {
          console.error(`❌ Failed to delete character ${id}:`, error);
          throw error;
        }
      }

      getItemById(itemId: string) {
        try {
          const result = this.db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
          return result as DatabaseItem | undefined;
        } catch (error) {
          console.error(`❌ Failed to get item ${itemId}:`, error);
          throw error;
        }
      }

      upsertProgress(progress: DatabaseProgress) {
        try {
          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO grail_progress (id, character_id, item_id, found, found_date, manually_added, difficulty, notes, is_ethereal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            progress.id,
            progress.character_id,
            progress.item_id,
            progress.found ? 1 : 0,
            progress.found_date || null,
            progress.manually_added ? 1 : 0,
            progress.difficulty || null,
            progress.notes || null,
            progress.is_ethereal ? 1 : 0,
          );
        } catch (error) {
          console.error(
            `❌ Failed to upsert progress for character ${progress.character_id}, item ${progress.item_id}:`,
            error,
          );
          throw error;
        }
      }
    }

    db = new SimplifiedGrailDatabaseClass();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }

  try {
    // Clear existing test data
    await clearExistingTestData(db);

    // Get all available items for progress seeding
    const allItems = db.getAllItems();
    console.log(`📦 Found ${allItems.length} items in database`);

    if (allItems.length === 0) {
      console.error('❌ No items found in database!');
      console.error(
        '   Please run the application first to seed the database with items from grail.ts',
      );
      console.error(
        '   The database should be populated with Holy Grail items before running this script.',
      );
      process.exit(1);
    }

    // Log some statistics about available items
    const etherealCapableItems = allItems.filter(
      (item) => item.ethereal_type === 'optional' || item.ethereal_type === 'only',
    );
    const normalCapableItems = allItems.filter(
      (item) => item.ethereal_type === 'none' || item.ethereal_type === 'optional',
    );
    console.log(
      `   📊 Normal-capable items: ${normalCapableItems.length}, Ethereal-capable items: ${etherealCapableItems.length}`,
    );

    // Seed test characters
    const characterIds = await createTestCharacters(db);

    // Seed grail progress
    await seedGrailProgress(db, allItems, characterIds);

    // Print summary
    await printSummary(db);

    console.log('\n✅ Test data seeding completed successfully!');
    console.log('🎮 You can now test the application with realistic data.');
    console.log(`📁 Database location: ${dbPath}`);
    console.log('\n💡 Note: The database uses existing Holy Grail items from the application.');
    console.log('   Make sure to run the application first to populate the items database.');
  } catch (error) {
    console.error('❌ Failed to seed test data:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedTestData().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
