/** @type {import("ts-jest").JestConfigWithTsJest} */
module.exports = {
	testEnvironment: "node",
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{
				tsconfig: {
					module: "commonjs",
					target: "es2020",
					esModuleInterop: true,
					strict: true,
					isolatedModules: true,
				},
			},
		],
	},
	testMatch: ["**/tests/**/*.test.ts"],
	moduleFileExtensions: ["ts", "js", "json"],
};
