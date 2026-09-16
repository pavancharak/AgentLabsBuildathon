import crypto from "node:crypto";

import { Router } from "express";
import type { NextFunction, Request, Response } from "express";

import { handbookDownloadLeadRepository } from "../repositories.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The PDF lives on the docs site's own domain (a Mintlify deployment,
 * a different origin from this API), never on this API's domain, so
 * a redirect target must be an absolute URL, not a relative one.
 */
const PDF_URL = "https://docs.parmanasystems.com/parmana-handbook.pdf";

async function captureLead(email: unknown): Promise<string | null> {
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    return null;
  }

  await handbookDownloadLeadRepository.create({
    handbookDownloadLeadId: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    capturedAt: new Date(),
  });

  return email.trim().toLowerCase();
}

/**
 * POST /handbook/download-leads and GET /handbook/download-leads
 *
 * Backs the email-gated PDF download at docs/site/handbook/download.mdx.
 * Deliberately mounted before this app's caller-auth middleware (see
 * app.ts) -- a visitor downloading the handbook has no Parmana
 * credential yet, that is the entire point of this route existing.
 * Records the email address, does not send a verification email --
 * see migration 20260916150000_add_handbook_download_leads.sql's own
 * comment for why that is a deliberate, not accidental, scope
 * boundary.
 *
 * Two verbs, same underlying capture, for two different callers:
 * GET (query param, ?email=...) backs a plain HTML <form method="get">
 * on the download page with no client-side JavaScript at all -- the
 * docs site host may sandbox or strip inline <script> tags, a plain
 * form submission has no such dependency, the browser navigates
 * directly and follows this route's 302 to the real file. POST (JSON
 * body) remains available for a programmatic caller that wants a
 * downloadUrl back in a response body instead of a redirect.
 */
export function createHandbookRouter(): Router {
  const router = Router();

  router.get(
    "/download-leads",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const captured = await captureLead(req.query.email);

        if (!captured) {
          res.status(400).send("A valid email address is required.");
          return;
        }

        res.redirect(302, PDF_URL);
        return;
      } catch (error) {
        next(error);
        return;
      }
    },
  );

  router.post(
    "/download-leads",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const captured = await captureLead(req.body?.email);

        if (!captured) {
          res.status(400).json({
            error: "A valid email address is required.",
          });
          return;
        }

        res.status(201).json({
          downloadUrl: PDF_URL,
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
