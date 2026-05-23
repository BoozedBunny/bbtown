import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('updateBuildingTransform', () => {
  it('should properly escape regex special characters in buildingId', async () => {
    // Save original NODE_ENV and cwd
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const originalCwd = process.cwd();

    // Create a temporary directory structure for the test
    const tempDir = path.join(process.cwd(), 'tests', 'temp-town');
    const townDirPath = path.join(tempDir, 'app', 'town', '[townId]');

    fs.mkdirSync(townDirPath, { recursive: true });

    // Mock the config file
    const mockConfigPath = path.join(townDirPath, 'town-config.ts');
    const initialContent = `
export const HARDCODED_BUILDINGS = [
  {
    id: "1",
    position: [0.00, 0.00, 0.00],
    rotationY: 0,
  },
  {
    id: ".*",
    position: [1.00, 1.00, 1.00],
    rotationY: 90,
  }
];
    `;
    fs.writeFileSync(mockConfigPath, initialContent, 'utf-8');

    // Mock process.cwd()
    process.cwd = () => tempDir;

    try {
      // Import dynamically so it picks up the mocked process.cwd if it evaluates it lazily
      // Note: The action uses process.cwd() inside the function, so it will pick up our mock
      const { updateBuildingTransform } = await import('../app/actions/dev.ts');

      // Try to update the building with ID ".*" (Regex injection vector)
      // If it's vulnerable, it might match the first building "1" since ".*" matches anything
      await updateBuildingTransform('.*', [5.00, 5.00, 5.00], 180);

      const updatedContent = fs.readFileSync(mockConfigPath, 'utf-8');

      // The building with ID "1" should NOT be modified
      assert.ok(updatedContent.includes('id: "1",\n    position: [0.00, 0.00, 0.00],\n    rotationY: 0,'), 'Building 1 should not be modified');

      // The building with ID ".*" SHOULD be modified
      assert.ok(updatedContent.includes('id: ".*",\n    position: [5.00, 5.00, 5.00],\n    rotationY: 180,'), 'Building ".*" should be modified');

    } finally {
      // Restore everything
      process.env.NODE_ENV = originalNodeEnv;
      process.cwd = () => originalCwd;

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
