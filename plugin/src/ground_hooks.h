#pragma once

namespace D2RL {
struct PluginContext;
}

namespace ArcaneTracker::GroundHooks {

/**
 * Hooks the two places in D2R that build the label of a ground item, so the grail status goes into
 * the name (see GroundLabelSuffix). The hooks sit at fixed addresses of D2R 3.3.0 (build 93847) and
 * are left out on any other build.
 * @returns Whether the hooks are in place
 */
auto Install(const D2RL::PluginContext* context) -> bool;

/** Turns the labels on or off; the hooks stay in place. */
void SetEnabled(bool enabled);

}
