# Asking the user

Use the host's blocking question tool already in the current tool list (match by capability, not by a host-specific name). Presence in the current tool list is proof the tool exists; never call a user-facing question tool to discover whether it exists. If a matching tool is listed but unloaded, use the host's tool-discovery primitive to load that capability: do not search for another host's tool name. Fall back to numbered options on the host's chat surface only when no such tool is in the list or a real question call errors. Never skip the question silently.
