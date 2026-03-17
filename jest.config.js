module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.spec.ts'],
    moduleNameMapper: {
        '^tabby-core$': '<rootDir>/src/__mocks__/tabby-core.ts',
        '^tabby-ssh$': '<rootDir>/src/__mocks__/tabby-ssh.ts',
        '^@angular/core$': '<rootDir>/src/__mocks__/angular-core.ts',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
        }],
    },
}
