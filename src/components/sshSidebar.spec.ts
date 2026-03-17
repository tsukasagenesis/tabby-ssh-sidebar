import { ProfileGroup } from './profileGroup.component'

// Helper: create a mock SSH profile
function makeProfile(overrides: any = {}) {
    return {
        id: overrides.id ?? 'p1',
        name: overrides.name ?? 'Server 1',
        type: overrides.type ?? 'ssh',
        group: overrides.group ?? undefined,
        isBuiltin: overrides.isBuiltin ?? false,
        isTemplate: overrides.isTemplate ?? false,
        icon: overrides.icon ?? undefined,
        color: overrides.color ?? undefined,
        options: {
            host: overrides.host ?? 'example.com',
            user: overrides.user ?? 'admin',
            port: overrides.port ?? 22,
            ...overrides.options,
        },
    }
}

// ─── Sorting ───

describe('Profile sorting', () => {
    const profiles = [
        makeProfile({ id: '1', name: 'Zebra', host: 'z.example.com' }),
        makeProfile({ id: '2', name: 'Alpha', host: 'a.example.com' }),
        makeProfile({ id: '3', name: 'Middle', host: 'm.example.com' }),
    ]

    test('sorts by name alphabetically', () => {
        const sorted = [...profiles].sort((a, b) => a.name.localeCompare(b.name))
        expect(sorted.map(p => p.name)).toEqual(['Alpha', 'Middle', 'Zebra'])
    })

    test('sorts by host alphabetically', () => {
        const sorted = [...profiles].sort((a, b) => {
            const hostA = a.options?.host || ''
            const hostB = b.options?.host || ''
            return hostA.localeCompare(hostB)
        })
        expect(sorted.map(p => p.options.host)).toEqual([
            'a.example.com', 'm.example.com', 'z.example.com'
        ])
    })

    test('sorts by recent — active connections first, then recent, then alphabetical', () => {
        const activeIds = ['3']
        const recentIds = ['1']

        const sorted = [...profiles].sort((a, b) => {
            const aActive = activeIds.includes(a.id)
            const bActive = activeIds.includes(b.id)
            if (aActive && !bActive) return -1
            if (!aActive && bActive) return 1

            const aIndex = recentIds.indexOf(a.id)
            const bIndex = recentIds.indexOf(b.id)
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
            if (aIndex !== -1) return -1
            if (bIndex !== -1) return 1
            return a.name.localeCompare(b.name)
        })

        expect(sorted.map(p => p.name)).toEqual(['Middle', 'Zebra', 'Alpha'])
    })
})

// ─── Filtering ───

describe('Profile filtering', () => {
    function matchesFilter(profile: any, filter: string): boolean {
        if (!filter) return true
        const filterLower = filter.toLowerCase()
        const parts = [
            profile.name,
            profile.options?.host,
            profile.options?.user,
            profile.options?.port != null ? String(profile.options.port) : '',
        ]
        return parts.filter(Boolean).join(' ').toLowerCase().includes(filterLower)
    }

    const profile = makeProfile({ name: 'Production DB', host: 'db.prod.internal', user: 'deploy', port: 5432 })

    test('shows all profiles when filter is empty', () => {
        expect(matchesFilter(profile, '')).toBe(true)
    })

    test('matches by name (case-insensitive)', () => {
        expect(matchesFilter(profile, 'production')).toBe(true)
        expect(matchesFilter(profile, 'PROD')).toBe(true)
    })

    test('matches by host', () => {
        expect(matchesFilter(profile, 'db.prod')).toBe(true)
        expect(matchesFilter(profile, 'internal')).toBe(true)
    })

    test('matches by user', () => {
        expect(matchesFilter(profile, 'deploy')).toBe(true)
    })

    test('matches by port', () => {
        expect(matchesFilter(profile, '5432')).toBe(true)
    })

    test('rejects non-matching filter', () => {
        expect(matchesFilter(profile, 'staging')).toBe(false)
    })
})

// ─── Grouping ───

describe('Profile grouping', () => {
    function buildGroups(profiles: any[], pinnedIds: string[], configGroups: any[] = []): ProfileGroup[] {
        const profileGroupCollapsed: Record<string, boolean> = {}

        const grouped: { [key: string]: any[] } = {}
        for (const profile of profiles) {
            const groupId = profile.group || 'ungrouped'
            if (!grouped[groupId]) grouped[groupId] = []
            grouped[groupId].push(profile)
        }

        let groups: ProfileGroup[] = Object.entries(grouped).map(([groupId, profs]) => {
            let groupName = groupId
            if (groupId !== 'ungrouped') {
                const configGroup = configGroups.find(g => g.id === groupId)
                if (configGroup) groupName = configGroup.name
            } else {
                groupName = 'Ungrouped'
            }
            return { id: groupId, name: groupName, profiles: profs, collapsed: profileGroupCollapsed[groupId] ?? false }
        })

        if (pinnedIds.length > 0) {
            const pinnedProfileObjects = profiles.filter(p => p.id && pinnedIds.includes(p.id))
            if (pinnedProfileObjects.length > 0) {
                groups.forEach(group => {
                    group.profiles = group.profiles.filter(p => !p.id || !pinnedIds.includes(p.id))
                })
                groups.unshift({
                    id: 'favorites',
                    name: '\u2B50 Favorites',
                    profiles: pinnedProfileObjects,
                    collapsed: false,
                })
            }
        }

        groups = groups.filter(g => g.profiles.length > 0)
        groups.sort((a, b) => {
            if (a.id === 'favorites') return -1
            if (b.id === 'favorites') return 1
            if (a.id === 'ungrouped') return -1
            if (b.id === 'ungrouped') return 1
            return a.name.localeCompare(b.name)
        })

        return groups
    }

    test('groups profiles by group property', () => {
        const profiles = [
            makeProfile({ id: '1', name: 'A', group: 'web' }),
            makeProfile({ id: '2', name: 'B', group: 'web' }),
            makeProfile({ id: '3', name: 'C', group: 'db' }),
        ]
        const groups = buildGroups(profiles, [])
        expect(groups.map(g => g.id)).toEqual(['db', 'web'])
        expect(groups.find(g => g.id === 'web')!.profiles.length).toBe(2)
    })

    test('puts ungrouped profiles in Ungrouped group', () => {
        const profiles = [
            makeProfile({ id: '1', name: 'A' }),
            makeProfile({ id: '2', name: 'B', group: 'web' }),
        ]
        const groups = buildGroups(profiles, [])
        expect(groups[0].id).toBe('ungrouped')
        expect(groups[0].name).toBe('Ungrouped')
    })

    test('creates Favorites group at top when profiles are pinned', () => {
        const profiles = [
            makeProfile({ id: '1', name: 'A', group: 'web' }),
            makeProfile({ id: '2', name: 'B', group: 'web' }),
        ]
        const groups = buildGroups(profiles, ['1'])
        expect(groups[0].id).toBe('favorites')
        expect(groups[0].name).toBe('\u2B50 Favorites')
        expect(groups[0].profiles.length).toBe(1)
        expect(groups[0].profiles[0].id).toBe('1')
        // Pinned profile removed from original group
        expect(groups.find(g => g.id === 'web')!.profiles.length).toBe(1)
    })

    test('removes empty groups', () => {
        const profiles = [
            makeProfile({ id: '1', name: 'A', group: 'web' }),
        ]
        // Pin the only profile in the group — web should be removed
        const groups = buildGroups(profiles, ['1'])
        expect(groups.length).toBe(1)
        expect(groups[0].id).toBe('favorites')
    })

    test('resolves group names from config groups', () => {
        const profiles = [
            makeProfile({ id: '1', name: 'A', group: 'grp-abc' }),
        ]
        const configGroups = [{ id: 'grp-abc', name: 'My Servers' }]
        const groups = buildGroups(profiles, [], configGroups)
        expect(groups[0].name).toBe('My Servers')
    })

    test('sorts groups: favorites → ungrouped → alphabetical', () => {
        const profiles = [
            makeProfile({ id: '1', name: 'A' }),
            makeProfile({ id: '2', name: 'B', group: 'zulu' }),
            makeProfile({ id: '3', name: 'C', group: 'alpha' }),
            makeProfile({ id: '4', name: 'D', group: 'alpha' }),
        ]
        const groups = buildGroups(profiles, ['3'])
        expect(groups.map(g => g.id)).toEqual(['favorites', 'ungrouped', 'alpha', 'zulu'])
    })
})

// ─── SSH Command Generation ───

describe('SSH command generation', () => {
    function buildSSHCommand(profile: any): string {
        const user = profile.options?.user || 'root'
        const host = profile.options?.host || 'unknown'
        const port = profile.options?.port || 22

        let command = `ssh ${user}@${host}`
        if (port !== 22) {
            command += ` -p ${port}`
        }
        return command
    }

    test('generates basic SSH command', () => {
        const profile = makeProfile({ user: 'admin', host: 'server.com' })
        expect(buildSSHCommand(profile)).toBe('ssh admin@server.com')
    })

    test('includes port when non-default', () => {
        const profile = makeProfile({ user: 'root', host: 'server.com', port: 2222 })
        expect(buildSSHCommand(profile)).toBe('ssh root@server.com -p 2222')
    })

    test('omits port flag for port 22', () => {
        const profile = makeProfile({ user: 'deploy', host: 'server.com', port: 22 })
        expect(buildSSHCommand(profile)).not.toContain('-p')
    })

    test('defaults to root user when user is missing', () => {
        const profile = { options: { host: 'server.com' } }
        expect(buildSSHCommand(profile)).toBe('ssh root@server.com')
    })
})

// ─── Description Generation ───

describe('Profile description', () => {
    function getDescription(profile: any): string | null {
        if (profile.options) {
            const user = profile.options.user || 'root'
            const host = profile.options.host || 'unknown'
            const port = profile.options.port || 22
            return `${user}@${host}${port !== 22 ? ':' + port : ''}`
        }
        return null
    }

    test('generates user@host description', () => {
        const profile = makeProfile({ user: 'admin', host: 'example.com' })
        expect(getDescription(profile)).toBe('admin@example.com')
    })

    test('includes port when non-default', () => {
        const profile = makeProfile({ user: 'admin', host: 'example.com', port: 2222 })
        expect(getDescription(profile)).toBe('admin@example.com:2222')
    })

    test('omits port for default 22', () => {
        const profile = makeProfile({ user: 'admin', host: 'example.com', port: 22 })
        expect(getDescription(profile)).toBe('admin@example.com')
    })

    test('returns null for profile without options', () => {
        expect(getDescription({})).toBeNull()
    })
})

// ─── Connection Count Text ───

describe('Connection count text', () => {
    function getConnectionCountText(total: number, active: number): string {
        if (active === 0) {
            return `${total} connection${total !== 1 ? 's' : ''}`
        }
        return `${total} connection${total !== 1 ? 's' : ''} (${active} active)`
    }

    test('shows total only when no active connections', () => {
        expect(getConnectionCountText(5, 0)).toBe('5 connections')
    })

    test('shows singular form for 1 connection', () => {
        expect(getConnectionCountText(1, 0)).toBe('1 connection')
    })

    test('shows active count when connections are active', () => {
        expect(getConnectionCountText(10, 3)).toBe('10 connections (3 active)')
    })

    test('handles zero total', () => {
        expect(getConnectionCountText(0, 0)).toBe('0 connections')
    })
})

// ─── Profile Filtering (SSH only) ───

describe('SSH profile filtering', () => {
    function isSSHProfile(profile: any): boolean {
        if (profile.type !== 'ssh') return false
        if (profile.isTemplate) return false
        if (!profile.options?.host) return false
        return true
    }

    test('accepts valid SSH profile', () => {
        expect(isSSHProfile(makeProfile())).toBe(true)
    })

    test('rejects non-SSH profiles', () => {
        expect(isSSHProfile(makeProfile({ type: 'local' }))).toBe(false)
    })

    test('rejects templates', () => {
        const p = makeProfile()
        p.isTemplate = true
        expect(isSSHProfile(p)).toBe(false)
    })

    test('rejects profiles without host', () => {
        expect(isSSHProfile({ ...makeProfile(), options: {} })).toBe(false)
    })
})

// ─── Blacklist ───

describe('Profile blacklist', () => {
    function isProfileBlacklisted(profileId: string | undefined, blacklist: string[]): boolean {
        return !!(profileId && blacklist.includes(profileId))
    }

    test('returns true for blacklisted profile', () => {
        expect(isProfileBlacklisted('p1', ['p1', 'p2'])).toBe(true)
    })

    test('returns false for non-blacklisted profile', () => {
        expect(isProfileBlacklisted('p3', ['p1', 'p2'])).toBe(false)
    })

    test('returns false for undefined id', () => {
        expect(isProfileBlacklisted(undefined, ['p1'])).toBe(false)
    })
})
