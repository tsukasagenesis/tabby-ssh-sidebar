/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2d ago").
 * Returns null if the timestamp is falsy.
 */
export function formatTimeAgo(timestamp: number | undefined | null): string | null {
    if (!timestamp) return null
    const diffMs = Date.now() - timestamp
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}d ago`
    return new Date(timestamp).toLocaleDateString()
}

/**
 * Check if a profile matches a text filter.
 * Searches across name, host, user, and port.
 */
export function matchesProfileFilter(
    profile: { name?: string, options?: { host?: string, user?: string, port?: number } },
    filterLower: string,
): boolean {
    const parts = [
        profile.name,
        profile.options?.host,
        profile.options?.user,
        profile.options?.port != null ? String(profile.options.port) : '',
    ]
    return parts.filter(Boolean).join(' ').toLowerCase().includes(filterLower)
}
