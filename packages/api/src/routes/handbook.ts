import crypto from "node:crypto";

import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { handbookDownloadLeadRepository } from "../repositories.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /handbook/download-leads
 *
 * Backs the email-gated PDF download at docs/site/handbook/download.mdx.
 * Deliberately mounted before this app's caller-auth middleware (see
 * app.ts) -- a visitor downloading the handbook has no Parmana
 * credential yet, that is the entire point of this route existing.
 * Records the email address, does not send a verification email --
 * see migration 20260916150000_add_handbook_download_leads.sql's own
 * comment for why that is a deliberate, not accidental, scope
 * boundary.
 */
export function createHandbookRouter(): Router {
  const router = Router();

  router.post(
    "/download-leads",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const email = req.body?.email;

        if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
          res.status(400).json({
            error: "A valid email address is required.",
          });
          return;
        }

        await handbookDownloadLeadRepository.create({
          handbookDownloadLeadId: crypto.randomUUID(),
          email: email.trim().toLowerCase(),
          capturedAt: new Date(),
        });

        res.status(201).json({
          downloadUrl: "/parmana-handbook.pdf",
        });
        return;
      } catch (error) {
        next(error);
        return;
      }
    },
  );

  return router;
}
