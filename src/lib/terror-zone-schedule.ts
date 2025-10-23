/**
 * Terror Zone Schedule Utility
 * 
 * This utility provides access to the D2R single-player terror zone schedule.
 * Since the exact algorithm used by the game could not be reverse-engineered,
 * this implementation uses pre-computed schedule data from the community.
 * 
 * @see docs/TERROR_ZONE_REVERSE_ENGINEERING_SUMMARY.md for details
 */

/**
 * Represents a terror zone from desecratedzones.json
 */
export interface TerrorZone {
	id: number;
	name: string;
	levels: Array<{
		level_id: number;
		waypoint_level_id?: number;
	}>;
}

/**
 * Schedule entry mapping a timestamp to a terror zone
 */
export interface TerrorZoneScheduleEntry {
	timestamp: Date;
	zoneId: number;
	zoneName: string;
}

/**
 * Terror Zone definitions from desecratedzones.json
 */
export const TERROR_ZONES: Record<number, TerrorZone> = {
	1: {
		id: 1,
		name: "Burial Grounds, Crypt, Mausoleum",
		levels: [
			{ level_id: 17, waypoint_level_id: 3 }, // Burial Grounds (Cold Plains WP)
			{ level_id: 18 }, // The Crypt
			{ level_id: 19 }, // Mausoleum
		],
	},
	2: {
		id: 2,
		name: "Cathedral, Catacombs",
		levels: [
			{ level_id: 33, waypoint_level_id: 32 }, // Cathedral (Inner Cloister WP)
			{ level_id: 34 }, // Catacombs Level 1
			{ level_id: 35 }, // Catacombs Level 2
			{ level_id: 36 }, // Catacombs Level 3
			{ level_id: 37 }, // Catacombs Level 4
		],
	},
	3: {
		id: 3,
		name: "Cold Plains, Cave",
		levels: [
			{ level_id: 3, waypoint_level_id: 3 }, // Cold Plains
			{ level_id: 9 }, // Cave Level 1
			{ level_id: 13 }, // Cave Level 2
		],
	},
	4: {
		id: 4,
		name: "Dark Wood, Underground Passage",
		levels: [
			{ level_id: 5, waypoint_level_id: 5 }, // Dark Wood
			{ level_id: 10 }, // Underground Passage Level 1
			{ level_id: 14 }, // Underground Passage Level 2
		],
	},
	5: {
		id: 5,
		name: "Blood Moor, Den of Evil",
		levels: [
			{ level_id: 2, waypoint_level_id: 1 }, // Blood Moor (Rogue Encampment WP)
			{ level_id: 8 }, // Den of Evil
		],
	},
	6: {
		id: 6,
		name: "Barracks, Jail",
		levels: [
			{ level_id: 28, waypoint_level_id: 27 }, // Barracks (Outer Cloister WP)
			{ level_id: 29 }, // Jail Level 1
			{ level_id: 30 }, // Jail Level 2
			{ level_id: 31 }, // Jail Level 3
		],
	},
	7: {
		id: 7,
		name: "The Secret Cow Level",
		levels: [
			{ level_id: 39, waypoint_level_id: 1 }, // Moo Moo Farm (Rogue Encampment WP)
		],
	},
	8: {
		id: 8,
		name: "Stony Field",
		levels: [{ level_id: 4, waypoint_level_id: 4 }], // Stony Field
	},
	9: {
		id: 9,
		name: "Black Marsh, The Hole",
		levels: [
			{ level_id: 6, waypoint_level_id: 6 }, // Black Marsh
			{ level_id: 11 }, // Hole Level 1
			{ level_id: 15 }, // Hole Level 2
		],
	},
	10: {
		id: 10,
		name: "Forgotten Tower",
		levels: [
			{ level_id: 20, waypoint_level_id: 6 }, // Forgotten Tower (Black Marsh WP)
			{ level_id: 21 }, // Tower Cellar Level 1
			{ level_id: 22 }, // Tower Cellar Level 2
			{ level_id: 23 }, // Tower Cellar Level 3
			{ level_id: 24 }, // Tower Cellar Level 4
			{ level_id: 25 }, // Tower Cellar Level 5
		],
	},
	11: {
		id: 11,
		name: "Pit",
		levels: [
			{ level_id: 12, waypoint_level_id: 27 }, // Pit Level 1 (Outer Cloister WP)
			{ level_id: 16 }, // Pit Level 2
		],
	},
	12: {
		id: 12,
		name: "Tristram",
		levels: [{ level_id: 38, waypoint_level_id: 4 }], // Tristram (Stony Field WP)
	},
	13: {
		id: 13,
		name: "Lut Gholein Sewers",
		levels: [
			{ level_id: 47, waypoint_level_id: 40 }, // Sewers Level 1 (Lut Gholein WP)
			{ level_id: 48 }, // Sewers Level 2
			{ level_id: 49 }, // Sewers Level 3
		],
	},
	14: {
		id: 14,
		name: "Rocky Waste, Stony Tomb",
		levels: [
			{ level_id: 41, waypoint_level_id: 40 }, // Rocky Waste (Lut Gholein WP)
			{ level_id: 55 }, // Stony Tomb Level 1
			{ level_id: 59 }, // Stony Tomb Level 2
		],
	},
	15: {
		id: 15,
		name: "Dry Hills, Halls of the Dead",
		levels: [
			{ level_id: 42, waypoint_level_id: 42 }, // Dry Hills
			{ level_id: 56 }, // Halls of the Dead Level 1
			{ level_id: 57 }, // Halls of the Dead Level 2
			{ level_id: 60 }, // Halls of the Dead Level 3
		],
	},
	16: {
		id: 16,
		name: "Far Oasis",
		levels: [{ level_id: 43, waypoint_level_id: 43 }], // Far Oasis
	},
	17: {
		id: 17,
		name: "Lost City, Valley of Snakes, Claw Viper Temple",
		levels: [
			{ level_id: 44, waypoint_level_id: 44 }, // Lost City
			{ level_id: 45 }, // Valley of Snakes
			{ level_id: 58 }, // Claw Viper Temple Level 1
			{ level_id: 61 }, // Claw Viper Temple Level 2
		],
	},
	18: {
		id: 18,
		name: "Ancient Tunnels",
		levels: [{ level_id: 65, waypoint_level_id: 44 }], // Ancient Tunnels (Lost City WP)
	},
	19: {
		id: 19,
		name: "Tal Rasha's Tombs, Tal Rasha's Chamber",
		levels: [
			{ level_id: 66, waypoint_level_id: 46 }, // Tal Rasha's Tomb (Canyon of the Magi WP)
			{ level_id: 67 },
			{ level_id: 68 },
			{ level_id: 69 },
			{ level_id: 70 },
			{ level_id: 71 },
			{ level_id: 72 },
			{ level_id: 73 }, // Tal Rasha's Chamber
		],
	},
	20: {
		id: 20,
		name: "Arcane Sanctuary",
		levels: [{ level_id: 74, waypoint_level_id: 74 }], // Arcane Sanctuary
	},
	21: {
		id: 21,
		name: "Spider Forest, Spider Cavern",
		levels: [
			{ level_id: 76, waypoint_level_id: 76 }, // Spider Forest
			{ level_id: 85 }, // Spider Cavern
		],
	},
	22: {
		id: 22,
		name: "Great Marsh",
		levels: [{ level_id: 77, waypoint_level_id: 77 }], // Great Marsh
	},
	23: {
		id: 23,
		name: "Flayer Jungle, Flayer Dungeon",
		levels: [
			{ level_id: 78, waypoint_level_id: 78 }, // Flayer Jungle
			{ level_id: 88 }, // Flayer Dungeon Level 1
			{ level_id: 89 }, // Flayer Dungeon Level 2
			{ level_id: 91 }, // Flayer Dungeon Level 3
		],
	},
	24: {
		id: 24,
		name: "Kurast Bazaar, Ruined Temple, Disused Fane",
		levels: [
			{ level_id: 80, waypoint_level_id: 80 }, // Kurast Bazaar
			{ level_id: 94 }, // Ruined Temple
			{ level_id: 95 }, // Disused Fane
		],
	},
	25: {
		id: 25,
		name: "Travincal",
		levels: [{ level_id: 83, waypoint_level_id: 83 }], // Travincal
	},
	26: {
		id: 26,
		name: "Durance of Hate",
		levels: [
			{ level_id: 100 }, // Durance of Hate Level 1
			{ level_id: 101, waypoint_level_id: 101 }, // Durance of Hate Level 2
			{ level_id: 102 }, // Durance of Hate Level 3
		],
	},
	27: {
		id: 27,
		name: "Outer Steppes, Plains of Despair",
		levels: [
			{ level_id: 104, waypoint_level_id: 103 }, // Outer Steppes (Pandemonium Fortress WP)
			{ level_id: 105 }, // Plains of Despair
		],
	},
	28: {
		id: 28,
		name: "City of the Damned, River of Flame",
		levels: [
			{ level_id: 106, waypoint_level_id: 106 }, // City of the Damned
			{ level_id: 107 }, // River of Flame
		],
	},
	29: {
		id: 29,
		name: "Chaos Sanctuary",
		levels: [{ level_id: 108, waypoint_level_id: 107 }], // Chaos Sanctuary (River of Flame WP)
	},
	30: {
		id: 30,
		name: "Bloody Foothills, Frigid Highlands, Abaddon",
		levels: [
			{ level_id: 110 }, // Bloody Foothills
			{ level_id: 111, waypoint_level_id: 111 }, // Frigid Highlands
			{ level_id: 125 }, // Abaddon
		],
	},
	31: {
		id: 31,
		name: "Arreat Plateau, Pit of Acheron",
		levels: [
			{ level_id: 112, waypoint_level_id: 112 }, // Arreat Plateau
			{ level_id: 126 }, // Pit of Acheron
		],
	},
	32: {
		id: 32,
		name: "Crystalline Passage, Frozen River",
		levels: [
			{ level_id: 113, waypoint_level_id: 113 }, // Crystalline Passage
			{ level_id: 114 }, // Frozen River
		],
	},
	33: {
		id: 33,
		name: "Nihlathak's Temple, Temple Halls",
		levels: [
			{ level_id: 121, waypoint_level_id: 109 }, // Nihlathak's Temple (Harrogath WP)
			{ level_id: 122 }, // Halls of Anguish
			{ level_id: 123 }, // Halls of Pain
			{ level_id: 124 }, // Halls of Vaught
		],
	},
	34: {
		id: 34,
		name: "Glacial Trail, Drifter Cavern",
		levels: [
			{ level_id: 115, waypoint_level_id: 115 }, // Glacial Trail
			{ level_id: 116 }, // Drifter Cavern
		],
	},
	35: {
		id: 35,
		name: "Ancient's Way, Icy Cellar",
		levels: [
			{ level_id: 118, waypoint_level_id: 118 }, // Ancient's Way
			{ level_id: 119 }, // Icy Cellar
		],
	},
	36: {
		id: 36,
		name: "Worldstone Keep, Throne of Destruction, Worldstone Chamber",
		levels: [
			{ level_id: 128 }, // Worldstone Keep Level 1
			{ level_id: 129, waypoint_level_id: 129 }, // Worldstone Keep Level 2
			{ level_id: 130 }, // Worldstone Keep Level 3
			{ level_id: 131 }, // Throne of Destruction
			{ level_id: 132 }, // Worldstone Chamber
		],
	},
};

/**
 * Gets a terror zone by its ID
 */
export function getTerrorZone(zoneId: number): TerrorZone | undefined {
	return TERROR_ZONES[zoneId];
}

/**
 * Gets all terror zones
 */
export function getAllTerrorZones(): TerrorZone[] {
	return Object.values(TERROR_ZONES);
}

/**
 * Rounds a date down to the nearest hour
 */
export function roundToHour(date: Date): Date {
	const rounded = new Date(date);
	rounded.setMinutes(0, 0, 0);
	return rounded;
}

/**
 * Gets the time remaining until the next terror zone rotation
 */
export function getTimeUntilNextRotation(currentTime: Date = new Date()): number {
	const nextHour = new Date(currentTime);
	nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
	return nextHour.getTime() - currentTime.getTime();
}

/**
 * Formats milliseconds as a human-readable time string
 */
export function formatTimeRemaining(ms: number): string {
	const minutes = Math.floor(ms / (1000 * 60));
	const seconds = Math.floor((ms % (1000 * 60)) / 1000);
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Note: For actual terror zone schedule lookups, you'll need to integrate
 * with either:
 * 1. Pre-computed CSV data from d2emu.com/tz-sp
 * 2. An API endpoint that provides current terror zone
 * 3. Allow users to manually input their current terror zone
 * 
 * The algorithm used by D2R could not be reverse-engineered from available data.
 * See docs/TERROR_ZONE_REVERSE_ENGINEERING_SUMMARY.md for details.
 */

