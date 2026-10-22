#include "ground_hooks.h"

#include <D2RLPlugin/api.h>

#ifdef _MSC_VER

#include "ground_label.h"

#include <windows.h>

#include <atomic>
#include <cstdint>
#include <cstring>
#include <string>

// What D2R's name code looks like on build 93847, found by reading the Chronicle Ground Flag plugin
// and checked against the running game. A game patch moves all of it, so Install() refuses any other
// build and the hooks only install when the game still has the bytes they expect.
namespace {

constexpr char SupportedBuildVersion[] = "3.3.0";
constexpr char SupportedBuildName[]    = "93847";

/** The function that builds an item's name: (unit, name buffer, capacity, ...). */
constexpr uint64_t NameHookRva = 0xCBEB0;
constexpr uint8_t  NameHookBytes[] { 0x40, 0x53, 0x55, 0x56, 0x57 };
/** A spot in the function that builds the label shown for an item on the ground. */
constexpr uint64_t LabelHookRva = 0xC08D9;
constexpr uint8_t  LabelHookBytes[] { 0x4C, 0x8D, 0x85, 0xE0, 0x01, 0x00, 0x00 };

// A game unit: its type, the row of the item table (Items.txt, all three kinds of item together),
// the item data and its mode. Ground items have mode 3.
constexpr uint32_t UnitTypeItem      = 4;
constexpr uint8_t  UnitModeOnGround  = 3;
constexpr size_t   UnitTxtOffset     = 0x04;
constexpr size_t   UnitDataOffset    = 0x10;
constexpr size_t   UnitModeOffset    = 0x1BD;
// The item data: quality, flags and the UniqueItems or SetItems row
constexpr size_t   DataFlagsOffset     = 0x18;
constexpr size_t   DataFileIndexOffset = 0x34;
constexpr uint32_t ItemFlagEthereal    = 0x00400000;
/** Where a row of the item table keeps the four-byte item code. */
constexpr uint32_t ItemRowCodeOffset = 128;

const D2RL::PluginContext*    g_context = nullptr;
const D2RL::DataTableService* g_tables  = nullptr;
std::atomic<bool>             g_enabled { true };

using NameFn = uintptr_t(__fastcall*)(void* unit, char* name, int capacity, void* extra);
NameFn g_nameOriginal = nullptr;

}

extern "C" {
void* g_arcaneGroundLabelOriginal = nullptr;
void  ArcaneGroundLabelStub();
void  ArcaneGroundLabelHook(void* unit, char* name, int capacity);
}

namespace {

/** Reads game memory without ever crashing the game: false when the address can't be read. */
bool SafeCopy(const void* from, void* to, size_t size) {
	__try {
		std::memcpy(to, from, size);
		return true;
	} __except (EXCEPTION_EXECUTE_HANDLER) {
		return false;
	}
}

template <typename T>
bool Read(const void* base, size_t offset, T& value) {
	return SafeCopy(static_cast<const uint8_t*>(base) + offset, &value, sizeof(T));
}

/** The item code of a row of the item table. */
bool ItemCode(uint32_t row, uint32_t& code) {
	D2RL::DataTables::RowView view {};
	view.structSize = D2RL::DataTables::RowViewSize;
	if (g_tables->getRow(g_context, D2RL::DataTables::Bank::Rotw, D2RL::DataTables::TableId::Items, row, &view) != D2RL::DataTables::Result::Success || view.row == nullptr
	    || view.rowSize < ItemRowCodeOffset + sizeof(code)) {
		return false;
	}
	std::memcpy(&code, static_cast<const uint8_t*>(view.row) + ItemRowCodeOffset, sizeof(code));
	return true;
}

/** Adds the text to the end of the name, unless it is there already or doesn't fit. */
void Append(char* name, int capacity, const std::string& text) {
	size_t used = 0;
	while (used < static_cast<size_t>(capacity) && name[used] != '\0') {
		++used;
	}
	if (used == 0 || used >= static_cast<size_t>(capacity) || static_cast<size_t>(capacity) - used <= text.size()) {
		return;
	}
	if (used >= text.size() && std::memcmp(name + used - text.size(), text.data(), text.size()) == 0) {
		return;
	}
	std::memcpy(name + used, text.c_str(), text.size() + 1);
}

/** Puts the grail status of a ground item into its name. */
void Decorate(void* unit, char* name, int capacity) {
	if (!g_enabled || unit == nullptr || name == nullptr || capacity <= 0) {
		return;
	}
	try {
		uint32_t type = 0;
		uint8_t  mode = 0;
		uint32_t row  = 0;
		uint64_t data = 0;
		if (!Read(unit, 0, type) || type != UnitTypeItem || !Read(unit, UnitModeOffset, mode) || mode != UnitModeOnGround || !Read(unit, UnitTxtOffset, row)
		    || !Read(unit, UnitDataOffset, data) || data == 0) {
			return;
		}
		uint32_t quality = 0;
		uint32_t flags   = 0;
		uint32_t record  = 0;
		uint32_t code    = 0;
		const void* itemData = reinterpret_cast<const void*>(data);
		if (!Read(itemData, 0, quality) || !Read(itemData, DataFlagsOffset, flags) || !Read(itemData, DataFileIndexOffset, record) || !ItemCode(row, code)) {
			return;
		}
		const auto suffix = ArcaneTracker::GroundLabelSuffix(static_cast<D2RL::Items::Quality>(quality), static_cast<int32_t>(record), code, (flags & ItemFlagEthereal) != 0);
		if (suffix) {
			Append(name, capacity, *suffix);
		}
	} catch (...) {
		// Never let an exception reach the game
	}
}

uintptr_t __fastcall NameHook(void* unit, char* name, int capacity, void* extra) {
	const uintptr_t result = g_nameOriginal(unit, name, capacity, extra);
	Decorate(unit, name, capacity);
	return result;
}

}

extern "C" void ArcaneGroundLabelHook(void* unit, char* name, int capacity) {
	Decorate(unit, name, capacity);
}

namespace ArcaneTracker::GroundHooks {

void SetEnabled(bool enabled) {
	g_enabled = enabled;
}

auto Install(const D2RL::PluginContext* context) -> bool {
	const char* version = D2RL::GetBuildVersion(context);
	const char* build   = D2RL::GetBuildName(context);
	if (version == nullptr || build == nullptr || std::strcmp(version, SupportedBuildVersion) != 0 || std::strcmp(build, SupportedBuildName) != 0) {
		context->LogInfo("Grail status on ground items needs D2R 3.3.0 (build 93847); it is left out on this game version.");
		return false;
	}
	if (context->QueryService(&g_tables) != D2RL::ServiceQueryResult::Success || !D2RL::HasDataTableServiceField(g_tables, D2RL::DataTableServiceRequiredSize)) {
		g_tables = nullptr;
		context->LogWarn("Grail status on ground items needs the data table service, which this D2RLoader version lacks.");
		return false;
	}
	g_context = context;
	if (!context->InstallInlineHook(NameHookRva, NameHookBytes, sizeof(NameHookBytes), reinterpret_cast<void*>(&NameHook), reinterpret_cast<void**>(&g_nameOriginal))) {
		context->LogWarn("Could not hook D2R's item name code; ground items get no grail status.");
		return false;
	}
	if (!context->InstallInlineHook(LabelHookRva, LabelHookBytes, sizeof(LabelHookBytes), reinterpret_cast<void*>(&ArcaneGroundLabelStub), &g_arcaneGroundLabelOriginal)) {
		context->LogWarn("Could not hook D2R's ground label code; the grail status only shows while holding Alt.");
	}
	return true;
}

}

#else

namespace ArcaneTracker::GroundHooks {

// The hooks need MSVC's structured exceptions and a MASM stub
void SetEnabled(bool) {}

auto Install(const D2RL::PluginContext* context) -> bool {
	context->LogInfo("This build of the plugin has no grail status on ground items.");
	return false;
}

}

#endif
