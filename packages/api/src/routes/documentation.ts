import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findSpecFile(): string {
  let current = __dirname;

  while (true) {
    const candidate = join(current, "openapi", "openapi.bundled.yaml");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      throw new Error(
        "openapi/openapi.bundled.yaml not found. Run `npm run bundle:openapi`.",
      );
    }

    current = parent;
  }
}

const spec = parse(readFileSync(findSpecFile(), "utf8"));

const router = Router();

router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(spec));

export default router;
